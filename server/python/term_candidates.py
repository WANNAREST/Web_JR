"""Shared Japanese candidate generation for training and web inference.

Keep this module free of pandas/torch so the exact same candidate boundaries can
be imported by Kaggle training code, evaluation scripts, and the web extractor.
"""

import csv
import os
import re
import unicodedata
from collections import defaultdict


RAILWAY_HINTS = {
    "鉄道", "列車", "車両", "線路", "駅", "駅長", "乗務員", "運転士", "車掌", "指令",
    "踏切", "信号", "閉そく", "架線", "軌道", "分岐器", "ホーム", "新幹線", "運転",
    "制御", "保安装置", "ATS", "ATC", "CTC", "ダイヤ", "異常時", "故障", "旅客",
}

STOPWORDS_JA = {
    "こと", "もの", "ため", "よう", "これ", "それ", "あれ", "ここ", "そこ", "ところ",
    "場合", "時", "人", "他", "中", "上", "下", "前", "後", "左右", "全て",
    "しかし", "また", "または", "する", "ある", "いる", "なる", "できる",
    "及び", "ただし", "から", "まで", "より", "について", "として", "にて",
    "以外", "以上", "以下", "未満", "等", "有り", "無し", "あり", "なし",
}

MANUAL_FLOW_NOISE = {
    "安心ボタン", "放送文例", "END", "次の場面", "処置完了",
    "列車の停止", "状況の確認", "事態の収拾", "その後の処置", "お客様救済",
    "運転再開運転再開", "事態の収拾1", "事態の収拾2",
    "収拾1", "収拾2", "確認事態", "停止状況", "状況確認",
    "判断", "連絡", "行動", "判断連絡", "判断行動", "連絡行動",
    "判断連絡行動", "判別", "場面", "項目", "参考", "注", "削除",
    "画面表示", "ポップアップ", "タップ", "チェックボックス",
    "達示年月日", "達示番号", "施行年月日", "主な改正事項",
}

PARTICLE_POS = {"ADP", "PART", "SCONJ", "CCONJ", "AUX"}
PAGE_MARKER_RE = re.compile(r"^\[\[PAGE\s+(\d+)\]\]$")
BLOCK_MARKER = "[[BLOCK]]"
RE_SENTENCE_END = re.compile(r"[。！？!?]\s*$")
RE_HAS_TECH_CHAR = re.compile(r"[一-龥々〆ヵヶァ-ヴーA-Za-z0-9α-ωΑ-Ωμ%℃°+\-]")
RE_ONLY_HIRAGANA = re.compile(r"^[ぁ-んー]+$")
RE_ONLY_ROMAN_NUMERAL = re.compile(r"^[IVXLCM]+$")
RE_ONLY_SYMBOLS = re.compile(r"[\W_]+")
RE_TOO_SHORT_LATIN = re.compile(r"^[A-Za-z]{1,2}$")
RE_NUMBER_PREFIX = re.compile(r"^[0-9０-９]")
RE_MENU_NUMBER_PREFIX = re.compile(r"^\(?[0-9０-９]+\)?[)）.．\-－\s]*")
RE_SECTION_PREFIX = re.compile(r"^[0-9０-９]+[-－][0-9０-９]+\s*")
RE_CHAPTER_PREFIX = re.compile(r"^第[0-9０-９]+[章節項編]\s*")
RE_STAR_PREFIX = re.compile(r"^[★☆＊*]+\s*")
RE_ADMIN_DOC_CODE = re.compile(r"(運運第|運車第|運オペマネ第|運第)[0-9０-９]+号")
RE_DATE_LIKE = re.compile(r"\d{4}[./．]\d{1,2}[./．]\d{1,2}")
RE_PAGE_OR_INDEX = re.compile(r"^[0-9０-９]+[-－][0-9０-９]+$")
RE_FLOW_CONCAT_NOISE = re.compile(r"(確認事態|停止状況|収拾[12]|運転再開運転再開)")
RE_WORD_CHAR = re.compile(r"[一-龥々〆ヵヶぁ-んァ-ヴーA-Za-z0-9]")


def normalize_text(text):
    text = unicodedata.normalize("NFKC", str(text or ""))
    text = text.replace("\ufeff", "").replace("\u3000", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_candidate(text):
    text = normalize_text(text)
    text = RE_MENU_NUMBER_PREFIX.sub("", text)
    text = RE_SECTION_PREFIX.sub("", text)
    text = RE_CHAPTER_PREFIX.sub("", text)
    text = RE_STAR_PREFIX.sub("", text)
    text = re.sub(r"\s+", "", text)
    return text.strip("、。，．・:：;；（）()[]［］「」『』【】<>〈〉《》/\\|｜★☆＊* ")


def _is_repeated_string(text):
    return len(text) >= 4 and len(text) % 2 == 0 and text[:len(text) // 2] == text[len(text) // 2:]


def is_bad_sentence(sentence):
    sentence = normalize_text(sentence)
    if len(sentence) <= 2:
        return True
    if re.search(r"達示年月日|達示番号|施行年月日|主な改正事項", sentence):
        return True
    if RE_DATE_LIKE.search(sentence) and RE_ADMIN_DOC_CODE.search(sentence):
        return True
    if re.fullmatch(r"[0-9０-９\-－\s]*.*削除.*", sentence):
        return True
    return sentence.count("/") >= 3


def valid_candidate(text, domain_terms=None):
    domain_terms = domain_terms or set()
    text = clean_candidate(text)
    is_domain_exact = text in domain_terms
    if len(text) < 2 or len(text) > 40:
        return False
    if text in MANUAL_FLOW_NOISE and not is_domain_exact:
        return False
    if text in STOPWORDS_JA and not is_domain_exact:
        return False
    if RE_ADMIN_DOC_CODE.search(text) and not is_domain_exact:
        return False
    if RE_PAGE_OR_INDEX.fullmatch(text) or RE_FLOW_CONCAT_NOISE.search(text):
        return False
    if _is_repeated_string(text):
        return False
    if RE_ONLY_ROMAN_NUMERAL.fullmatch(text):
        return False
    if RE_NUMBER_PREFIX.match(text) and not is_domain_exact:
        return False
    if RE_TOO_SHORT_LATIN.fullmatch(text) and not is_domain_exact:
        return False
    if RE_ONLY_HIRAGANA.fullmatch(text) and not is_domain_exact:
        return False
    if RE_ONLY_SYMBOLS.fullmatch(text):
        return False
    return bool(RE_HAS_TECH_CHAR.search(text))


def _should_join_wrapped_line(previous, current):
    if not previous or not current or RE_SENTENCE_END.search(previous):
        return False
    if previous.endswith(("|", "｜", ":", "：")) or current.startswith(("|", "｜")):
        return False
    if (
        PAGE_MARKER_RE.match(previous)
        or PAGE_MARKER_RE.match(current)
        or previous == BLOCK_MARKER
        or current == BLOCK_MARKER
    ):
        return False
    # PDF/OCR commonly wraps Japanese paragraphs without punctuation. Joining
    # restores terms such as 輸送サー + ビス before GiNZA sees the sentence.
    return bool(RE_WORD_CHAR.search(previous[-1]) and RE_WORD_CHAR.match(current[0]))


def repair_wrapped_lines(lines):
    repaired = []
    for raw_line in lines:
        line = normalize_text(raw_line)
        if not line:
            continue
        if PAGE_MARKER_RE.match(line) or line == BLOCK_MARKER:
            repaired.append(line)
        elif repaired and _should_join_wrapped_line(repaired[-1], line):
            repaired[-1] += line
        else:
            repaired.append(line)
    return repaired


def split_sentences(text):
    parts = re.split(r"(?<=[。！？!?])|\n+", normalize_text(text))
    return [part for part in (normalize_text(value) for value in parts) if len(part) >= 2]


def split_sentence_records(text):
    records = []
    current_page = None
    for line in repair_wrapped_lines(normalize_text(text).splitlines()):
        marker = PAGE_MARKER_RE.match(line)
        if marker:
            current_page = int(marker.group(1))
            continue
        if line == BLOCK_MARKER:
            continue
        for sentence in split_sentences(line):
            records.append({"sentence": sentence, "page": current_page})
    if records:
        return records
    return [{"sentence": sentence, "page": None} for sentence in split_sentences(text)]


def load_term_dictionary(file_path):
    if not file_path:
        return set()
    file_path = os.path.abspath(file_path)
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Domain dictionary not found: {file_path}")
    terms = set()
    if file_path.lower().endswith(".csv"):
        with open(file_path, "r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.reader(handle))
        if not rows:
            return terms
        header = [normalize_text(value).lower() for value in rows[0]]
        preferred = (
            "term", "keyword", "word", "surface",
            "japanese", "日本語", "用語", "名称", "語", "name",
        )
        column = next(
            (index for index, name in enumerate(header) if any(key in name for key in preferred)),
            0,
        )
        values = rows[1:]
        for row in values:
            if column < len(row):
                term = clean_candidate(row[column])
                if term:
                    terms.add(term)
    else:
        with open(file_path, "r", encoding="utf-8-sig") as handle:
            for line in handle:
                term = clean_candidate(line)
                if term:
                    terms.add(term)
    return terms


class CandidateGenerator:
    def __init__(self, domain_dictionary_path=None):
        self.domain_terms = load_term_dictionary(domain_dictionary_path)
        self.domain_terms_by_first = defaultdict(list)
        for term in sorted(self.domain_terms, key=len, reverse=True):
            if 2 <= len(term) <= 40:
                self.domain_terms_by_first[term[0]].append(term)
        self._nlp = None

    def _load_nlp(self):
        if self._nlp is None:
            import spacy
            self._nlp = spacy.load(
                "ja_ginza",
                config={"components": {"compound_splitter": {"split_mode": "C"}}},
            )
        return self._nlp

    def validate_runtime(self):
        try:
            import spacy
        except Exception as error:
            raise RuntimeError(f"GiNZA/spaCy runtime is unavailable: {error}") from error
        if not spacy.util.is_package("ja_ginza"):
            raise RuntimeError(
                "Japanese GiNZA model is unavailable. Install server/python/requirements.txt."
            )

    def dictionary_candidates(self, sentence):
        candidates = []
        seen = set()
        for char in set(sentence):
            for term in self.domain_terms_by_first.get(char, []):
                start = sentence.find(term)
                while start != -1:
                    key = (term, start, start + len(term))
                    if key not in seen:
                        seen.add(key)
                        candidates.append({
                            "candidate": term,
                            "start_char": start,
                            "end_char": start + len(term),
                            "source": "dictionary_exact_match",
                        })
                    start = sentence.find(term, start + 1)
        return candidates

    def generate(self, sentence, allow_fallback=False):
        sentence = normalize_text(sentence)
        if is_bad_sentence(sentence):
            return []
        try:
            doc = self._load_nlp()(sentence)
        except Exception as error:
            if allow_fallback:
                return fallback_candidates(sentence, self.domain_terms)
            raise RuntimeError(f"GiNZA candidate generation failed: {error}") from error

        candidates = self.dictionary_candidates(sentence)
        for chunk in doc.noun_chunks:
            if any(
                token.pos_ in PARTICLE_POS
                or token.text.strip() in {"の", "に", "を", "は", "が", "と", "で", "へ", "から", "まで", "より"}
                for token in chunk
            ):
                continue
            candidates.append({
                "candidate": chunk.text,
                "start_char": chunk.start_char,
                "end_char": chunk.end_char,
                "source": "ginza_noun_chunk",
            })

        allowed = {"NOUN", "PROPN", "NUM", "SYM", "X", "ADJ"}
        buffer_tokens = []

        def flush_buffer():
            if not buffer_tokens:
                return
            candidates.append({
                "candidate": "".join(token.text for token in buffer_tokens),
                "start_char": buffer_tokens[0].idx,
                "end_char": buffer_tokens[-1].idx + len(buffer_tokens[-1].text),
                "source": "ginza_compound",
            })
            buffer_tokens.clear()

        for token in doc:
            token_text = token.text.strip()
            noun_like = token.pos_ in allowed or token.tag_.startswith("名詞")
            if (
                token.is_space
                or token.is_punct
                or token.pos_ in PARTICLE_POS
                or token_text in STOPWORDS_JA
            ):
                flush_buffer()
            elif noun_like:
                # Hiragana nouns such as 扱い and 通り are part of the term.
                # GiNZA may expose サ変名詞 such as 鎖錠 as VERB while tag_ still
                # correctly starts with 名詞, so use both signals.
                buffer_tokens.append(token)
            else:
                flush_buffer()
        flush_buffer()

        merged = []
        seen = set()
        for candidate in candidates:
            text = clean_candidate(candidate["candidate"])
            if not valid_candidate(text, self.domain_terms):
                continue
            key = (text, candidate["start_char"], candidate["end_char"])
            if key in seen:
                continue
            seen.add(key)
            merged.append({**candidate, "candidate": text})
        return merged


def fallback_candidates(sentence, domain_terms=None):
    domain_terms = domain_terms or set()
    pattern = re.compile(r"[一-龥々〆ヵヶァ-ヴーA-Za-z0-9%℃°+\-]{2,40}")
    rows = []
    for match in pattern.finditer(sentence):
        text = clean_candidate(match.group(0))
        if valid_candidate(text, domain_terms):
            rows.append({
                "candidate": text,
                "start_char": match.start(),
                "end_char": match.end(),
                "source": "regex_candidate",
            })
    return rows
