"""Fine-tune the classifier from human Approved/Rejected review exports.

Designed for a CUDA Kaggle runtime. It deliberately writes a new checkpoint and
never replaces the production model directory unless --overwrite is explicit.
"""

import argparse
import json
import os
import random
import shutil
from collections import Counter

from evaluate_bert import build_report, read_rows, term_label_id
from term_candidates import normalize_text


def grouped_split(rows, validation_ratio, seed, max_contexts_per_term):
    by_term = {}
    for row in rows:
        by_term.setdefault((row["term"], row["labelId"]), []).append(row)
    rng = random.Random(seed)
    train_keys = []
    validation_keys = []
    for label in (0, 1):
        keys = [key for key in by_term if key[1] == label]
        rng.shuffle(keys)
        validation_count = max(1, round(len(keys) * validation_ratio)) if len(keys) > 1 else 0
        validation_keys.extend(keys[:validation_count])
        train_keys.extend(keys[validation_count:])

    def expand(keys):
        result = []
        for key in keys:
            values = by_term[key][:]
            rng.shuffle(values)
            result.extend(values[:max_contexts_per_term])
        return result

    return expand(train_keys), expand(validation_keys)


def add_boundary_hard_negatives(train_rows):
    positives = {row["term"] for row in train_rows if row["labelId"] == 1}
    generated = []
    seen = {(row["term"], row["context"], row["labelId"]) for row in train_rows}
    for row in train_rows:
        term = row["term"]
        if row["labelId"] != 1 or len(term) < 4:
            continue
        for fragment in (term[:-1], term[1:]):
            fragment = normalize_text(fragment)
            key = (fragment, row["context"], 0)
            if len(fragment) < 2 or fragment in positives or key in seen:
                continue
            seen.add(key)
            generated.append({
                **row,
                "term": fragment,
                "labelId": 0,
                "label": "negative",
                "reviewStatus": "synthetic_boundary_fragment",
            })
    return train_rows + generated, len(generated)


def metrics_from_logits(logits, labels, positive_id):
    import torch
    probabilities = torch.softmax(torch.tensor(logits), dim=-1)[:, positive_id].tolist()
    return build_report(
        [{"labelId": int(label), "term": str(index)} for index, label in enumerate(labels)],
        probabilities,
        0.5,
    ), probabilities


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="CSV/JSONL exported from the review web")
    parser.add_argument("--base-model", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--gradient-accumulation", type=int, default=2)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--validation-ratio", type=float, default=0.2)
    parser.add_argument("--max-contexts-per-term", type=int, default=3)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-hard-negatives", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    import torch
    from torch.utils.data import DataLoader, Dataset
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    output_dir = os.path.abspath(args.output_dir)
    if os.path.isdir(output_dir) and os.listdir(output_dir):
        if not args.overwrite:
            raise FileExistsError(f"Output directory is not empty: {output_dir}")
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    rows = read_rows(args.input)
    train_rows, validation_rows = grouped_split(
        rows,
        args.validation_ratio,
        args.seed,
        max(1, args.max_contexts_per_term),
    )
    if not train_rows or not validation_rows:
        raise ValueError("Need at least two reviewed terms in each class for a train/validation split.")
    hard_negative_count = 0
    if not args.no_hard_negatives:
        train_rows, hard_negative_count = add_boundary_hard_negatives(train_rows)

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    model = AutoModelForSequenceClassification.from_pretrained(args.base_model)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    positive_id = term_label_id(model)

    class PairDataset(Dataset):
        def __init__(self, values):
            self.values = values

        def __len__(self):
            return len(self.values)

        def __getitem__(self, index):
            return self.values[index]

    def collate(batch):
        inputs = tokenizer(
            [row["context"] for row in batch],
            [row["term"] for row in batch],
            padding=True,
            truncation=True,
            max_length=args.max_length,
            return_tensors="pt",
        )
        inputs["labels"] = torch.tensor([row["labelId"] for row in batch], dtype=torch.long)
        return inputs

    generator = torch.Generator().manual_seed(args.seed)
    train_loader = DataLoader(
        PairDataset(train_rows),
        batch_size=max(1, args.batch_size),
        shuffle=True,
        generator=generator,
        collate_fn=collate,
    )
    validation_loader = DataLoader(
        PairDataset(validation_rows),
        batch_size=max(1, args.batch_size),
        shuffle=False,
        collate_fn=collate,
    )
    counts = Counter(row["labelId"] for row in train_rows)
    class_weights = torch.tensor(
        [len(train_rows) / max(1, 2 * counts[index]) for index in range(2)],
        dtype=torch.float,
        device=device,
    )
    criterion = torch.nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    accumulation = max(1, args.gradient_accumulation)

    def evaluate():
        model.eval()
        probabilities = []
        labels = []
        with torch.inference_mode():
            for batch in validation_loader:
                batch = {key: value.to(device) for key, value in batch.items()}
                batch_labels = batch.pop("labels")
                logits = model(**batch).logits
                probabilities.extend(torch.softmax(logits, dim=-1)[:, positive_id].cpu().tolist())
                labels.extend(batch_labels.cpu().tolist())
        return build_report(
            [
                {"labelId": label, "term": row["term"]}
                for label, row in zip(labels, validation_rows)
            ],
            probabilities,
            0.5,
        )

    history = []
    best_f1 = -1.0
    best_state = None
    for epoch in range(args.epochs):
        model.train()
        optimizer.zero_grad(set_to_none=True)
        running_loss = 0.0
        for step, batch in enumerate(train_loader, start=1):
            batch = {key: value.to(device) for key, value in batch.items()}
            labels = batch.pop("labels")
            logits = model(**batch).logits
            loss = criterion(logits, labels) / accumulation
            loss.backward()
            running_loss += loss.item() * accumulation
            if step % accumulation == 0 or step == len(train_loader):
                optimizer.step()
                optimizer.zero_grad(set_to_none=True)
        report = evaluate()
        report["epoch"] = epoch + 1
        report["trainingLoss"] = round(running_loss / max(1, len(train_loader)), 6)
        history.append(report)
        print(json.dumps(report, ensure_ascii=False))
        if report["f1Term"] > best_f1:
            best_f1 = report["f1Term"]
            best_state = {name: tensor.detach().cpu().clone() for name, tensor in model.state_dict().items()}

    if best_state is not None:
        model.load_state_dict(best_state)
    model.save_pretrained(output_dir, safe_serialization=True)
    tokenizer.save_pretrained(output_dir)
    final_report = {
        "baseModel": os.path.abspath(args.base_model),
        "outputDir": output_dir,
        "device": str(device),
        "trainExamples": len(train_rows),
        "validationExamples": len(validation_rows),
        "hardNegativesAdded": hard_negative_count,
        "trainUniqueTerms": len({row["term"] for row in train_rows}),
        "validationUniqueTerms": len({row["term"] for row in validation_rows}),
        "history": history,
        "bestEpoch": max(history, key=lambda item: item["f1Term"]),
    }
    with open(os.path.join(output_dir, "review_training_report.json"), "w", encoding="utf-8") as handle:
        json.dump(final_report, handle, ensure_ascii=False, indent=2)
    print(json.dumps(final_report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
