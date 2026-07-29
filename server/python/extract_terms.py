import json
import math
import os
import re
import sys
import time
from collections import Counter, defaultdict

from term_candidates import (
    CandidateGenerator,
    RAILWAY_HINTS,
    fallback_candidates,
    normalize_text,
    split_sentence_records,
)

GIT_LFS_POINTER_PREFIX = b"version https://git-lfs.github.com/spec/v1"


def report_progress(percent, stage, **details):
    payload = {
        "type": "progress",
        "percent": max(0, min(100, int(percent))),
        "stage": stage,
        **details,
    }
    print(f"PROGRESS:{json.dumps(payload, ensure_ascii=False)}", file=sys.stderr, flush=True)


def validate_model_weights(model_dir):
    weight_files = [
        name for name in os.listdir(model_dir)
        if name.endswith(".safetensors")
        or name.startswith("pytorch_model") and name.endswith(".bin")
    ]
    weight_indexes = [
        "model.safetensors.index.json",
        "pytorch_model.bin.index.json",
    ]

    if not weight_files and not any(
        os.path.isfile(os.path.join(model_dir, name)) for name in weight_indexes
    ):
        raise FileNotFoundError(
            f"BERT model weights not found at {model_dir}. "
            "Expected model.safetensors or pytorch_model.bin."
        )

    for name in weight_files:
        path = os.path.join(model_dir, name)
        with open(path, "rb") as weight_file:
            header = weight_file.read(200)
        if header.startswith(GIT_LFS_POINTER_PREFIX):
            expected_size = re.search(rb"(?:^|\n)size (\d+)(?:\n|$)", header)
            size_detail = (
                f" (expected {int(expected_size.group(1))} bytes)"
                if expected_size else ""
            )
            raise RuntimeError(
                f"BERT model weights at {path} are a Git LFS pointer{size_detail}, "
                "not the model data. Run `git lfs install` and `git lfs pull`, "
                "then restart the server."
            )


def validate_model_files(model_dir):
    if not os.path.isfile(os.path.join(model_dir, "config.json")):
        raise FileNotFoundError(
            f"BERT model not found at {model_dir}. Expected config.json and save_pretrained() files."
        )
    tokenizer_files = ("tokenizer.json", "tokenizer_config.json", "vocab.txt")
    if not any(os.path.isfile(os.path.join(model_dir, name)) for name in tokenizer_files):
        raise FileNotFoundError(
            f"BERT tokenizer not found at {model_dir}. Expected tokenizer files from save_pretrained()."
        )
    validate_model_weights(model_dir)


def load_model(model_dir, required=False):
    try:
        validate_model_files(model_dir)
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        configured_threads = int(os.environ.get("BERT_TORCH_THREADS", "0"))
        if configured_threads > 0:
            torch.set_num_threads(configured_threads)
        tokenizer = AutoTokenizer.from_pretrained(model_dir)
        model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        model.eval()
        load_model.torch = torch
        return tokenizer, model, "bert"
    except Exception as error:
        if required:
            raise RuntimeError(f"Could not load BERT model from {model_dir}: {error}") from error
        return None, None, "demo"


def heuristic_score(candidate, frequency):
    score = 0.42
    if len(candidate) >= 4:
        score += 0.14
    if re.search(r"[一-龥].*[一-龥]", candidate):
        score += 0.1
    if re.search(r"[ァ-ヴー]", candidate):
        score += 0.08
    if any(hint in candidate for hint in RAILWAY_HINTS):
        score += 0.22
    if frequency >= 2:
        score += min(0.12, math.log2(frequency) * 0.04)
    return round(min(score, 0.98), 4)


def score_pairs_with_model(rows, tokenizer, model):
    torch = load_model.torch
    batch_size = max(1, int(os.environ.get("BERT_BATCH_SIZE", "8")))
    unique_pairs = list(dict.fromkeys((row["sentence"], row["term"]) for row in rows))
    scores = {}

    with torch.inference_mode():
        for start in range(0, len(unique_pairs), batch_size):
            batch = unique_pairs[start:start + batch_size]
            inputs = tokenizer(
                [pair[0] for pair in batch],
                [pair[1] for pair in batch],
                padding=True,
                truncation=True,
                max_length=256,
                return_tensors="pt",
            )
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)[:, 1].tolist()
            for pair, score in zip(batch, probs):
                scores[pair] = round(float(score), 4)

            completed = min(start + len(batch), len(unique_pairs))
            percent = 35 + round(55 * completed / max(1, len(unique_pairs)))
            report_progress(
                percent,
                "scoring_candidates",
                completed=completed,
                total=len(unique_pairs),
                batchSize=batch_size,
            )

    for row in rows:
        row["score"] = scores[(row["sentence"], row["term"])]
    return {
        "scoredPairs": len(unique_pairs),
        "batchSize": batch_size,
        "torchThreads": torch.get_num_threads(),
    }


def is_overlap(a, b):
    return max(a["start_char"], b["start_char"]) < min(a["end_char"], b["end_char"])


def resolve_overlaps(rows):
    grouped = defaultdict(list)
    for row in rows:
        grouped[row["sentence_id"]].append(row)

    selected = []
    for group in grouped.values():
        ordered = sorted(
            group,
            key=lambda r: (r["end_char"] - r["start_char"], r["score"], r["frequency"]),
            reverse=True,
        )
        kept = []
        for row in ordered:
            if not any(is_overlap(row, other) for other in kept):
                kept.append(row)
        selected.extend(kept)
    return selected


def prune_candidates_before_scoring(rows):
    grouped = defaultdict(list)
    for row in rows:
        grouped[row["sentence_id"]].append(row)

    selected = []
    for group in grouped.values():
        ordered = sorted(
            group,
            key=lambda row: (
                row["end_char"] - row["start_char"],
                row["frequency"],
                row["term"],
            ),
            reverse=True,
        )
        kept = []
        for row in ordered:
            if not any(is_overlap(row, other) for other in kept):
                kept.append(row)
        selected.extend(kept)
    return selected


def add_unique_page(pages, page):
    if page is not None and page not in pages:
        pages.append(page)


def main():
    payload = json.load(sys.stdin)
    text = normalize_text(payload.get("text", ""))
    threshold = float(payload.get("threshold", 0.9))
    model_dir = payload.get("modelDir", "")
    file_name = payload.get("fileName", "document")

    domain_dictionary_path = payload.get("domainDictionaryPath") or None
    generator = CandidateGenerator(domain_dictionary_path)

    if payload.get("action") == "health":
        validate_model_files(model_dir)
        generator.validate_runtime()
        print(json.dumps({
            "available": True,
            "mode": "bert",
            "modelDir": model_dir,
            "check": "model_files",
        }, ensure_ascii=False))
        return

    if payload.get("action") == "candidates":
        records = split_sentence_records(text)
        print(json.dumps({
            "sentences": records,
            "candidates": [
                {**candidate, "sentence": record["sentence"], "page": record["page"]}
                for record in records
                for candidate in generator.generate(record["sentence"])
            ],
        }, ensure_ascii=False))
        return

    require_model = bool(payload.get("requireModel", False))
    report_progress(2, "loading_model")
    model_load_started = time.perf_counter()
    tokenizer, model, mode = load_model(model_dir, required=require_model)
    model_load_seconds = time.perf_counter() - model_load_started

    report_progress(10, "reading_document")
    sentence_records = split_sentence_records(text)
    counts = Counter()

    candidate_generator = generator.generate if mode == "bert" else fallback_candidates
    candidates_by_sentence = []
    candidate_generation_started = time.perf_counter()
    for index, record in enumerate(sentence_records):
        candidates = candidate_generator(record["sentence"])
        candidates_by_sentence.append(candidates)
        for candidate in candidates:
            counts[candidate["candidate"]] += 1
        if index % 20 == 0 or index + 1 == len(sentence_records):
            report_progress(
                10 + round(20 * (index + 1) / max(1, len(sentence_records))),
                "extracting_candidates",
                completed=index + 1,
                total=len(sentence_records),
            )
    candidate_generation_seconds = time.perf_counter() - candidate_generation_started

    candidate_rows = []
    for index, record in enumerate(sentence_records):
        sentence = record["sentence"]
        page = record["page"]
        seen = set()
        for candidate in candidates_by_sentence[index]:
            term = candidate["candidate"]
            key = (term, candidate["start_char"], candidate["end_char"])
            if key in seen:
                continue
            seen.add(key)

            candidate_rows.append({
                "term": term,
                "candidate": term,
                "frequency": counts[term],
                "sentence": sentence,
                "sentence_id": f"{file_name}_s{index}",
                "page": page,
                "pages": [page] if page is not None else [],
                "start_char": candidate["start_char"],
                "end_char": candidate["end_char"],
                "source": candidate["source"],
                "group": "new_potential_term" if term not in RAILWAY_HINTS else "railway_dictionary_hint"
            })

    before_pruning = len(candidate_rows)
    candidate_rows = prune_candidates_before_scoring(candidate_rows)
    report_progress(
        34,
        "preparing_batches",
        completed=len(candidate_rows),
        total=before_pruning,
    )

    scoring_started = time.perf_counter()
    if mode == "bert":
        scoring_stats = score_pairs_with_model(candidate_rows, tokenizer, model)
    else:
        for row in candidate_rows:
            row["score"] = heuristic_score(row["term"], counts[row["term"]])
        report_progress(90, "scoring_candidates", completed=len(candidate_rows), total=len(candidate_rows))
        scoring_stats = {
            "scoredPairs": len(candidate_rows),
            "batchSize": None,
            "torchThreads": None,
        }
    scoring_seconds = time.perf_counter() - scoring_started

    all_candidates = [row for row in candidate_rows if row["score"] >= threshold]

    report_progress(94, "aggregating_results")
    resolved = resolve_overlaps(all_candidates)
    resolved.sort(key=lambda row: (-row["score"], row["term"]))

    unique = {}
    for row in resolved:
        current = unique.get(row["term"])
        occurrence = {
            "sentence": row["sentence"],
            "page": row.get("page"),
            "startChar": row.get("start_char"),
            "endChar": row.get("end_char"),
            "score": row["score"],
        }
        if not current:
            unique[row["term"]] = row.copy()
            unique[row["term"]]["frequency"] = 1
            unique[row["term"]]["examples"] = [row["sentence"]]
            unique[row["term"]]["occurrences"] = [occurrence]
        else:
            current["frequency"] += 1
            current["score"] = max(current["score"], row["score"])
            add_unique_page(current["pages"], row.get("page"))
            current["occurrences"].append(occurrence)
            if len(current["examples"]) < 3 and row["sentence"] not in current["examples"]:
                current["examples"].append(row["sentence"])

    terms = sorted(unique.values(), key=lambda row: (-row["score"], -row["frequency"], row["term"]))
    for idx, row in enumerate(terms, start=1):
        row["id"] = idx
        row["score"] = round(row["score"], 4)
        row["pages"] = sorted(row.get("pages", []))
        row["page"] = row["pages"][0] if row["pages"] else None

    report_progress(100, "complete")
    print(json.dumps({
        "mode": mode,
        "threshold": threshold,
        "sentenceCount": len(sentence_records),
        "termCount": len(terms),
        "terms": terms[:300],
        "diagnostics": {
            "modelLoadSeconds": round(model_load_seconds, 3),
            "candidateGenerationSeconds": round(candidate_generation_seconds, 3),
            "scoringSeconds": round(scoring_seconds, 3),
            "sentences": len(sentence_records),
            "candidatesBeforePruning": before_pruning,
            "candidatesAfterPruning": len(candidate_rows),
            "layoutBoundaries": text.count("[[BLOCK]]"),
            "domainDictionaryTerms": len(generator.domain_terms),
            **scoring_stats,
        },
        "summary": {
            "highConfidence": sum(1 for row in terms if row["score"] >= 0.9),
            "mediumConfidence": sum(1 for row in terms if 0.7 <= row["score"] < 0.9),
            "reviewNeeded": sum(1 for row in terms if row["score"] < 0.7)
        }
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
