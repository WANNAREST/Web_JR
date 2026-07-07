import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict


RAILWAY_HINTS = {
    "鉄道", "列車", "車両", "線路", "駅", "駅長", "乗務員", "運転士", "車掌", "指令",
    "踏切", "信号", "閉そく", "架線", "軌道", "分岐器", "ホーム", "新幹線", "運転",
    "制御", "保安装置", "ATS", "ATC", "CTC", "ダイヤ", "異常時", "故障", "旅客"
}

PAGE_MARKER_RE = re.compile(r"^\[\[PAGE\s+(\d+)\]\]$")


def normalize_text(text):
    text = unicodedata.normalize("NFKC", str(text or ""))
    text = text.replace("\ufeff", "")
    text = text.replace("\u3000", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_sentences(text):
    text = normalize_text(text)
    parts = re.split(r"(?<=[。！？])|\n+", text)
    return [normalize_text(part) for part in parts if len(normalize_text(part)) >= 2]


def split_sentence_records(text):
    records = []
    current_page = None

    for line in normalize_text(text).splitlines():
        line = normalize_text(line)
        if not line:
            continue

        marker = PAGE_MARKER_RE.match(line)
        if marker:
            current_page = int(marker.group(1))
            continue

        for sentence in split_sentences(line):
            records.append({
                "sentence": sentence,
                "page": current_page
            })

    if records:
        return records

    return [{"sentence": sentence, "page": None} for sentence in split_sentences(text)]


def clean_candidate(text):
    text = normalize_text(text)
    text = re.sub(r"^\(?[0-9０-９]+\)?[)）.．\-－\s]*", "", text)
    text = re.sub(r"^[0-9０-９]+[-－][0-9０-９]+\s*", "", text)
    text = re.sub(r"^第[0-9０-９]+[章節項編]\s*", "", text)
    text = re.sub(r"\s+", "", text)
    return text.strip("、。，．・:：;；（）()[]［］「」『』【】<>〈〉《》/\\|｜* ")


def valid_candidate(text):
    if len(text) < 2 or len(text) > 40:
        return False
    if re.fullmatch(r"[ぁ-んー]+", text):
        return False
    if re.fullmatch(r"[\W_]+", text):
        return False
    if re.match(r"^[0-9０-９]", text):
        return False
    return bool(re.search(r"[一-龥々〆ヵヶァ-ヴーA-Za-z0-9]", text))


def fallback_candidates(sentence):
    pattern = re.compile(r"[一-龥々〆ヵヶァ-ヴーA-Za-z0-9%℃°+\-]{2,40}")
    rows = []
    for match in pattern.finditer(sentence):
        text = clean_candidate(match.group(0))
        if valid_candidate(text):
            rows.append({
                "candidate": text,
                "start_char": match.start(),
                "end_char": match.end(),
                "source": "regex_candidate"
            })
    return rows


def try_spacy_candidates(sentence):
    try:
        import spacy
        nlp = try_spacy_candidates.nlp
    except AttributeError:
        try:
            import spacy
            try_spacy_candidates.nlp = spacy.load("ja_ginza")
            nlp = try_spacy_candidates.nlp
        except Exception:
            return fallback_candidates(sentence)
    except Exception:
        return fallback_candidates(sentence)

    rows = []
    doc = nlp(sentence)
    for chunk in doc.noun_chunks:
        text = clean_candidate(chunk.text)
        if valid_candidate(text):
            rows.append({
                "candidate": text,
                "start_char": chunk.start_char,
                "end_char": chunk.end_char,
                "source": "ginza_noun_chunk"
            })

    allowed = {"NOUN", "PROPN", "NUM", "SYM", "X", "ADJ"}
    buf = []
    for token in doc:
        if token.pos_ in allowed and not re.fullmatch(r"[ぁ-んー]+", token.text):
            buf.append(token)
            continue
        if buf:
            text = clean_candidate("".join(t.text for t in buf))
            if valid_candidate(text):
                rows.append({
                    "candidate": text,
                    "start_char": buf[0].idx,
                    "end_char": buf[-1].idx + len(buf[-1].text),
                    "source": "ginza_compound"
                })
            buf = []
    if buf:
        text = clean_candidate("".join(t.text for t in buf))
        if valid_candidate(text):
            rows.append({
                "candidate": text,
                "start_char": buf[0].idx,
                "end_char": buf[-1].idx + len(buf[-1].text),
                "source": "ginza_compound"
            })

    return rows or fallback_candidates(sentence)


def load_model(model_dir):
    if not os.path.exists(os.path.join(model_dir, "config.json")):
        return None, None, "demo"
    try:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_dir)
        model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        model.eval()
        load_model.torch = torch
        return tokenizer, model, "bert"
    except Exception:
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


def score_with_model(sentence, candidate, tokenizer, model):
    torch = load_model.torch
    with torch.no_grad():
        inputs = tokenizer(
            sentence,
            candidate,
            truncation=True,
            max_length=256,
            return_tensors="pt",
        )
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1)
        return round(float(probs[0][1].item()), 4)


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


def add_unique_page(pages, page):
    if page is not None and page not in pages:
        pages.append(page)


def main():
    payload = json.load(sys.stdin)
    text = normalize_text(payload.get("text", ""))
    threshold = float(payload.get("threshold", 0.9))
    model_dir = payload.get("modelDir", "")
    file_name = payload.get("fileName", "document")

    tokenizer, model, mode = load_model(model_dir)
    sentence_records = split_sentence_records(text)
    all_candidates = []
    counts = Counter()

    candidate_generator = try_spacy_candidates if mode == "bert" else fallback_candidates

    for record in sentence_records:
        for candidate in candidate_generator(record["sentence"]):
            counts[candidate["candidate"]] += 1

    for index, record in enumerate(sentence_records):
        sentence = record["sentence"]
        page = record["page"]
        seen = set()
        for candidate in candidate_generator(sentence):
            term = candidate["candidate"]
            key = (term, candidate["start_char"], candidate["end_char"])
            if key in seen:
                continue
            seen.add(key)

            score = score_with_model(sentence, term, tokenizer, model) if mode == "bert" else heuristic_score(term, counts[term])
            if score < threshold:
                continue

            all_candidates.append({
                "term": term,
                "candidate": term,
                "score": score,
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

    resolved = resolve_overlaps(all_candidates)
    resolved.sort(key=lambda row: (-row["score"], row["term"]))

    unique = {}
    for row in resolved:
        current = unique.get(row["term"])
        if not current:
            unique[row["term"]] = row.copy()
            unique[row["term"]]["examples"] = [row["sentence"]]
        else:
            current["frequency"] += 1
            current["score"] = max(current["score"], row["score"])
            add_unique_page(current["pages"], row.get("page"))
            if len(current["examples"]) < 3 and row["sentence"] not in current["examples"]:
                current["examples"].append(row["sentence"])

    terms = sorted(unique.values(), key=lambda row: (-row["score"], -row["frequency"], row["term"]))
    for idx, row in enumerate(terms, start=1):
        row["id"] = idx
        row["score"] = round(row["score"], 4)
        row["pages"] = sorted(row.get("pages", []))
        row["page"] = row["pages"][0] if row["pages"] else None

    print(json.dumps({
        "mode": mode,
        "threshold": threshold,
        "sentenceCount": len(sentence_records),
        "termCount": len(terms),
        "terms": terms[:300],
        "summary": {
            "highConfidence": sum(1 for row in terms if row["score"] >= 0.9),
            "mediumConfidence": sum(1 for row in terms if 0.7 <= row["score"] < 0.9),
            "reviewNeeded": sum(1 for row in terms if row["score"] < 0.7)
        }
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
