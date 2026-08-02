"""Evaluate a saved BERT term classifier on human-reviewed CSV/JSONL data."""

import argparse
import csv
import json
import os
import sys

from term_candidates import normalize_text


POSITIVE_LABELS = {"1", "positive", "term", "approved", "true"}
NEGATIVE_LABELS = {"0", "negative", "non_term", "not_term", "rejected", "false"}


def parse_label(row):
    raw = normalize_text(row.get("label") or row.get("reviewStatus") or "").lower()
    if raw in POSITIVE_LABELS:
        return 1
    if raw in NEGATIVE_LABELS:
        return 0
    return None


def read_rows(file_path):
    if file_path.lower().endswith(".jsonl"):
        with open(file_path, "r", encoding="utf-8-sig") as handle:
            raw_rows = [json.loads(line) for line in handle if line.strip()]
    else:
        last_error = None
        for encoding in ("utf-8-sig", "utf-8", "cp932", "shift_jis"):
            try:
                with open(file_path, "r", encoding=encoding, newline="") as handle:
                    raw_rows = list(csv.DictReader(handle))
                break
            except UnicodeDecodeError as error:
                last_error = error
        else:
            raise last_error

    rows = []
    seen = set()
    for row in raw_rows:
        term = normalize_text(row.get("term") or row.get("candidate") or "")
        context = normalize_text(row.get("context") or row.get("sentence") or "")
        label = parse_label(row)
        if not term or not context or label is None:
            continue
        key = (term, context, label)
        if key in seen:
            continue
        seen.add(key)
        rows.append({**row, "term": term, "context": context, "labelId": label})
    return rows


def classification_metrics(labels, probabilities, threshold):
    predictions = [int(probability >= threshold) for probability in probabilities]
    tp = sum(prediction == 1 and label == 1 for prediction, label in zip(predictions, labels))
    tn = sum(prediction == 0 and label == 0 for prediction, label in zip(predictions, labels))
    fp = sum(prediction == 1 and label == 0 for prediction, label in zip(predictions, labels))
    fn = sum(prediction == 0 and label == 1 for prediction, label in zip(predictions, labels))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    accuracy = (tp + tn) / len(labels) if labels else 0.0
    return {
        "threshold": round(threshold, 4),
        "accuracy": round(accuracy, 4),
        "precisionTerm": round(precision, 4),
        "recallTerm": round(recall, 4),
        "f1Term": round(f1, 4),
        "confusionMatrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
    }


def best_threshold(labels, probabilities):
    candidates = [value / 100 for value in range(5, 100)]
    return max(
        (classification_metrics(labels, probabilities, threshold) for threshold in candidates),
        key=lambda metrics: (metrics["f1Term"], metrics["precisionTerm"], metrics["threshold"]),
    )


def term_label_id(model):
    label2id = getattr(model.config, "label2id", {}) or {}
    for name, label_id in label2id.items():
        if normalize_text(name).upper() in {"TERM", "POSITIVE", "LABEL_1"}:
            return int(label_id)
    return 1


def predict_rows(rows, model_dir, batch_size=16, max_length=256):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.eval()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    positive_id = term_label_id(model)
    probabilities = []

    with torch.inference_mode():
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]
            inputs = tokenizer(
                [row["context"] for row in batch],
                [row["term"] for row in batch],
                padding=True,
                truncation=True,
                max_length=max_length,
                return_tensors="pt",
            )
            inputs = {key: value.to(device) for key, value in inputs.items()}
            logits = model(**inputs).logits
            probabilities.extend(torch.softmax(logits, dim=-1)[:, positive_id].cpu().tolist())
            print(
                f"Evaluated {min(start + len(batch), len(rows))}/{len(rows)} pairs",
                file=sys.stderr,
                flush=True,
            )
    return probabilities, str(device)


def build_report(rows, probabilities, threshold):
    labels = [row["labelId"] for row in rows]
    report = classification_metrics(labels, probabilities, threshold)
    report.update({
        "examples": len(rows),
        "positiveExamples": sum(labels),
        "negativeExamples": len(labels) - sum(labels),
        "uniqueTerms": len({row["term"] for row in rows}),
        "brierScore": round(
            sum((probability - label) ** 2 for probability, label in zip(probabilities, labels))
            / len(labels),
            4,
        ),
        "recommendedThreshold": best_threshold(labels, probabilities),
    })
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Human-reviewed CSV or JSONL export")
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--threshold", type=float, default=0.9)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--output")
    args = parser.parse_args()

    rows = read_rows(args.input)
    if not rows:
        raise ValueError("No approved/rejected rows with both term and context were found.")
    probabilities, device = predict_rows(
        rows,
        os.path.abspath(args.model_dir),
        max(1, args.batch_size),
        args.max_length,
    )
    report = {
        "modelDir": os.path.abspath(args.model_dir),
        "input": os.path.abspath(args.input),
        "device": device,
        **build_report(rows, probabilities, args.threshold),
    }
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(output + "\n")
    print(output)


if __name__ == "__main__":
    main()
