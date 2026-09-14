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
    split_structured_page_records,
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


def build_isotonic_calibrator(config):
    bins = config.get("bins", []) if isinstance(config, dict) else []
    points = []
    total = positives = 0
    for item in bins:
        weight = max(0, int(item.get("weight", 0)))
        positive = max(0, min(weight, int(item.get("positives", 0))))
        raw_score = float(item.get("rawScore", 0))
        if weight:
            points.append({"x": raw_score, "weight": weight, "positives": positive})
            total += weight
            positives += positive
    negatives = total - positives
    if total < 30 or positives < 8 or negatives < 8:
        return None, {
            "applied": False, "method": "identity", "samples": total,
            "positives": positives, "negatives": negatives,
            "reason": "insufficient_review_labels",
        }

    blocks = []
    for point in sorted(points, key=lambda item: item["x"]):
        blocks.append({
            "minX": point["x"], "maxX": point["x"],
            "weight": point["weight"], "positives": point["positives"],
        })
        while len(blocks) >= 2:
            left, right = blocks[-2], blocks[-1]
            if left["positives"] / left["weight"] <= right["positives"] / right["weight"]:
                break
            blocks[-2:] = [{
                "minX": left["minX"], "maxX": right["maxX"],
                "weight": left["weight"] + right["weight"],
                "positives": left["positives"] + right["positives"],
            }]

    calibrator = [
        {"x": (block["minX"] + block["maxX"]) / 2, "y": block["positives"] / block["weight"]}
        for block in blocks
    ]
    return calibrator, {
        "applied": True, "method": "isotonic_review_v1", "samples": total,
        "positives": positives, "negatives": negatives, "blocks": len(calibrator),
    }


def calibrated_score(raw_score, calibrator):
    if not calibrator:
        return raw_score
    if raw_score <= calibrator[0]["x"]:
        return calibrator[0]["y"]
    if raw_score >= calibrator[-1]["x"]:
        return calibrator[-1]["y"]
    for left, right in zip(calibrator, calibrator[1:]):
        if left["x"] <= raw_score <= right["x"]:
            width = right["x"] - left["x"]
            if width <= 0:
                return right["y"]
            ratio = (raw_score - left["x"]) / width
            return left["y"] + ratio * (right["y"] - left["y"])
    return raw_score


def assess_source_quality(pages, text, layout_stats):
    if not pages:
        score = 1.0 if len(text) >= 100 else 0.7 if text else 0.0
        return {"score": score, "level": "good" if score >= 0.8 else "warning", "kind": "plain_text"}

    page_count = len(pages)
    pages_with_text = sum(1 for page in pages if page.get("segments"))
    diagnostics = [page.get("diagnostics") or {} for page in pages]
    input_items = sum(int(item.get("inputItems", 0)) for item in diagnostics)
    duplicates = sum(int(item.get("duplicateItemsRemoved", 0)) for item in diagnostics)
    boilerplate = sum(int(item.get("repeatedBoilerplateRemoved", 0)) for item in diagnostics)
    segments = sum(len(page.get("segments") or []) for page in pages)
    characters = sum(len(segment.get("text", "")) for page in pages for segment in page.get("segments") or [])
    structural = int(layout_stats.get("structuralNoiseFiltered", 0))
    coverage = pages_with_text / max(1, page_count)
    density = min(1.0, characters / max(1, page_count * 120))
    duplicate_ratio = duplicates / max(1, input_items)
    noise_ratio = (boilerplate + structural) / max(1, segments + boilerplate)
    score = round(max(0.0, min(1.0,
        0.45 * coverage + 0.25 * density
        + 0.2 * (1 - min(1.0, duplicate_ratio * 4))
        + 0.1 * (1 - min(1.0, noise_ratio * 2))
    )), 4)
    warnings = []
    if coverage < 0.9:
        warnings.append("pages_without_text")
    if density < 0.5:
        warnings.append("low_text_density")
    if duplicate_ratio > 0.1:
        warnings.append("overlapping_text_layers")
    if noise_ratio > 0.2:
        warnings.append("high_structural_noise")
    return {
        "score": score, "level": "good" if score >= 0.8 else "warning" if score >= 0.6 else "poor",
        "kind": "structured_pdf", "pageCoverage": round(coverage, 4),
        "textDensity": round(density, 4), "duplicateRatio": round(duplicate_ratio, 4),
        "noiseRatio": round(noise_ratio, 4), "warnings": warnings,
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


def evidence_sort_key(term, occurrence):
    sentence = occurrence.get("sentence", "")
    length = len(sentence)
    has_context = length >= len(term) + 4
    reasonable_length = length <= 180
    clean_start = not re.match(r"^[\s□■◆◇●○▲△▼▽▶▷※★☆＊*✓✔☑☐]", sentence)
    segment_rank = {"text": 2, "table_cell": 1, "flow_label": 0}.get(
        occurrence.get("segmentType"), 1
    )
    return (
        reasonable_length,
        has_context,
        clean_start,
        segment_rank,
        occurrence.get("score", 0),
        -length,
    )


def main():
    payload = json.load(sys.stdin)
    text = normalize_text(payload.get("text", ""))
    pages = payload.get("pages") or []
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
        records = split_structured_page_records(pages) if pages else split_sentence_records(text)
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
    if pages:
        sentence_records, layout_stats = split_structured_page_records(pages, include_stats=True)
    else:
        sentence_records = split_sentence_records(text)
        layout_stats = {
            "structuralNoiseFiltered": 0,
            "tocSegmentsFiltered": 0,
            "formFieldsFiltered": 0,
            "numberedListSplits": 0,
        }
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
                "segment_id": record.get("segmentId"),
                "segment_type": record.get("segmentType"),
                "bbox": record.get("bbox"),
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

    calibrator, calibration_stats = build_isotonic_calibrator(payload.get("calibration") or {})
    for row in candidate_rows:
        row["raw_score"] = row["score"]
        row["score"] = round(calibrated_score(row["raw_score"], calibrator), 4)

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
            "rawScore": row["raw_score"],
            "segmentId": row.get("segment_id"),
            "segmentType": row.get("segment_type"),
            "bbox": row.get("bbox"),
        }
        if not current:
            unique[row["term"]] = row.copy()
            unique[row["term"]]["frequency"] = 1
            unique[row["term"]]["examples"] = [row["sentence"]]
            unique[row["term"]]["occurrences"] = [occurrence]
        else:
            current["frequency"] += 1
            current["score"] = max(current["score"], row["score"])
            current["raw_score"] = max(current["raw_score"], row["raw_score"])
            add_unique_page(current["pages"], row.get("page"))
            current["occurrences"].append(occurrence)
            if len(current["examples"]) < 3 and row["sentence"] not in current["examples"]:
                current["examples"].append(row["sentence"])

    terms = sorted(unique.values(), key=lambda row: (-row["score"], -row["frequency"], row["term"]))
    for idx, row in enumerate(terms, start=1):
        row["occurrences"].sort(key=lambda item: evidence_sort_key(row["term"], item), reverse=True)
        row["examples"] = list(dict.fromkeys(
            occurrence["sentence"] for occurrence in row["occurrences"]
        ))[:3]
        row["sentence"] = row["examples"][0]
        row["id"] = idx
        row["score"] = round(row["score"], 4)
        row["rawScore"] = round(row.pop("raw_score", row["score"]), 4)
        row["pages"] = sorted(row.get("pages", []))
        row["page"] = row["pages"][0] if row["pages"] else None

    report_progress(100, "complete")
    print(json.dumps({
        "mode": mode,
        "threshold": threshold,
        "sentenceCount": len(sentence_records),
        "termCount": len(terms),
        "terms": terms,
        "sourceQuality": assess_source_quality(pages, text, layout_stats),
        "diagnostics": {
            "modelLoadSeconds": round(model_load_seconds, 3),
            "candidateGenerationSeconds": round(candidate_generation_seconds, 3),
            "scoringSeconds": round(scoring_seconds, 3),
            "sentences": len(sentence_records),
            "candidatesBeforePruning": before_pruning,
            "candidatesAfterPruning": len(candidate_rows),
            "layoutBoundaries": sum(len(page.get("segments") or []) for page in pages)
                if pages else text.count("[[BLOCK]]"),
            "domainDictionaryTerms": len(generator.domain_terms),
            **layout_stats,
            "calibration": calibration_stats,
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
