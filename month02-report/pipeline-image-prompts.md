# Month 2 Pipeline Image Prompts

## Shared visual direction

Use these constraints for every generated image:

- Professional academic research presentation
- White background, deep navy `#00376F`, light cyan, and restrained JR red `#C00000` accents
- Green only for validated or approved states
- Rounded panels, flat vector icons, thin directional arrows, consistent line weight
- High readability, strong alignment, generous negative space
- Short English labels only
- No logos, no mascot, no decorative AI imagery, no glowing brain, no robot character
- No fake Japanese text, no lorem ipsum, no pseudo-code paragraphs
- No gradients, no 3D rendering, no photorealistic people
- Leave the top 12% and bottom 8% visually quiet for the PowerPoint title and caption
- 16:9 aspect ratio, crisp vector infographic, presentation quality

---

## Slide 2 — Project Vision

```text
Create a clean client-facing vision diagram for a Japanese railway terminology dataset project.

Style: Professional academic research presentation, white background, deep navy blue and cyan accents, restrained JR red highlights, rounded panels, flat vector icons, thin arrows, high readability, minimal text, no logos, no fake Japanese text, no cartoon mascot, no decorative AI brain.

Layout: A left-to-right four-stage journey with equal visual weight:

1. RAILWAY MANUALS
Show PDF manuals containing real-looking text blocks, tables, technical diagrams, and operating flowcharts.

2. TRACEABLE CORPUS
Show clean document pages with metadata tags: document, page, chunk. Use dotted traceability lines back to the original manuals.

3. REVIEWED TERMINOLOGY
Show a structured terminology table with columns represented visually as term, label, context, source, and review status. Include small approved and needs-review indicators.

4. FUTURE NLP SYSTEMS
Show a clean dataset cylinder feeding a compact language-processing application, without using a robot or glowing AI brain.

Use short English labels only. Emphasize that human-reviewed data is the bridge between inference output and future model training. Leave space for slide title and bottom caption. Aspect ratio 16:9, crisp vector infographic, presentation quality.
```

---

## Slide 3 — Month 2 End-to-End Overview

```text
Create a clean client-facing overview diagram for Month 2 of a Japanese railway terminology extraction project.

Style: Professional academic research presentation, white background, deep navy blue and cyan accents, restrained JR red highlights, rounded panels, flat vector icons, thin arrows, high readability, minimal text, no logos, no fake Japanese text, no cartoon mascot, no decorative AI imagery.

Layout: A left-to-right pipeline with three large zones: INPUT, INFERENCE PIPELINE, REVIEW OUTPUT.

INPUT:
Show multiple Japanese railway PDF manuals plus two small dictionary sources labeled DOMAIN DICTIONARY and COMMON-WORD DICTIONARY.

INFERENCE PIPELINE:
Show five connected steps:
1. Extract Pages
2. Build Chunks
3. Match Dictionaries
4. Qwen Inference
5. Validate JSON

Use intuitive icons:
- PDF pages with page tags
- overlapping text chunks
- dictionary lookup and filtering
- a local server labeled QWEN 2.5 7B AWQ
- JSON brackets with a validation check

REVIEW OUTPUT:
Show a CSV review table with labels known_term and new_candidate, source page links, context evidence, and review status.

Add a clear small banner: INFERENCE FIRST — TRAINING LATER.
Do not show fine-tuning as completed. Do not imply that the AWQ model is being trained. Use short English labels only. Leave space for slide title and bottom caption. Aspect ratio 16:9, crisp vector infographic, presentation quality.
```

---

## Slide 4 — System Architecture

```text
Create a clean four-phase system architecture diagram for a Japanese railway terminology dataset project.

Style: Professional academic research presentation, white background, deep navy blue and cyan accents, restrained JR red highlights, green only for approved review states, rounded panels, flat vector icons, thin arrows, high readability, no logos, no fake Japanese text, no cartoon mascot, no decorative AI imagery.

Layout: A balanced 2-by-2 architecture grid connected by a subtle clockwise flow. Each phase must have one icon, one short input label, one short output label, and three compact actions.

PHASE 1 — DOCUMENT INGESTION
Input: Railway PDFs
Output: Page-Aware Text
Actions: PyMuPDF Extraction, NFKC Normalization, Page Traceability

PHASE 2 — CANDIDATE SELECTION
Input: Page-Aware Chunks
Output: Ranked Chunks
Actions: Domain Matches, Common-Word Negatives, Generic-Term Filtering

PHASE 3 — LOCAL QWEN INFERENCE
Input: Chunk + Dictionary Signals
Output: Validated JSON
Actions: known_term, new_candidate, Exact Context Copy

PHASE 4 — HUMAN REVIEW TO SFT
Input: Draft CSV
Output: Reviewed JSONL
Actions: Accept / Reject / Correct, Reviewer Notes, QLoRA After Review

Add a thin traceability ribbon across the bottom:
DOCUMENT → PAGE → CHUNK → TERM → REVIEW DECISION

Use short English labels only. Do not show completed fine-tuning. Leave space for slide title and caption. Aspect ratio 16:9, crisp vector infographic, presentation quality.
```

---

## Slide 6 — Phase 1: PDF to Traceable Chunks

```text
Create a clean client-facing process diagram for Phase 1 of a railway terminology dataset project: converting PDF manuals into page-aware, traceable chunks.

Style: Professional academic research presentation, white background, deep navy blue and cyan accents, restrained JR red highlights, rounded panels, flat vector icons, thin arrows, high readability, minimal text, no logos, no fake Japanese text, no cartoon mascot.

Layout: A left-to-right pipeline with three zones: INPUT, PROCESSING, OUTPUT.

INPUT:
Show four railway PDF manuals containing text, tables, diagrams, and flowcharts.

PROCESSING:
Show six connected steps:
1. PDF Text Extraction
2. Page Tracking
3. NFKC Normalize
4. Sentence Split
5. Chunk + Overlap
6. Quality Check

Use intuitive icons:
- PDF document conversion
- page-number metadata tags
- clean normalized text
- Japanese sentence-boundary symbols without displaying fake Japanese text
- overlapping document blocks labeled MAX 700 and OVERLAP 80
- checklist quality report

OUTPUT:
Show a clean stack of traceable chunks with metadata tags: document_name, page, chunk_id.
Show dotted traceability lines back to the original PDF pages.
Include three compact metric badges: 4 PDFs, 594 PAGES, 683 CHUNKS.

Important: Focus only on PDF preprocessing and chunk creation. Do not include dictionary matching, terminology extraction, BERT, LLM, review, or training. Use short English labels only. Leave space for slide title and captions. Aspect ratio 16:9, crisp vector infographic, presentation quality.
```

---

## Slide 7 — Phase 2: Hybrid Candidate Selection

```text
Create a clean client-facing process diagram for Phase 2 of a Japanese railway terminology project: selecting high-value chunks before local LLM inference.

Style: Professional academic research presentation, white background, deep navy blue and cyan accents, restrained JR red highlights, green for retained candidates, rounded panels, flat vector icons, thin arrows, high readability, minimal text, no logos, no fake Japanese text, no cartoon mascot, no decorative AI imagery.

Layout: A left-to-right pipeline with four zones: INPUT, DICTIONARY SIGNALS, FILTERING AND RANKING, OUTPUT.

INPUT:
Show page-aware text chunks with document, page, and chunk ID tags.

DICTIONARY SIGNALS:
Show two clearly separated dictionary sources:
- DOMAIN TERMS — 8,991 usable entries
- COMMON NEGATIVES — 13,353 entries

FILTERING AND RANKING:
Show five connected operations:
1. Domain Match
2. Common-Word Check
3. Generic-Term Exclusion
4. Subterm Deduplication
5. Chunk Ranking

Use a funnel icon only for filtering, not as decoration. Show examples of overly general categories being removed using simple English tokens such as TRAIN, DEVICE, SYSTEM, METHOD.

OUTPUT:
Show a ranked list of candidate chunks with document, page, match count, and score. Add one metric badge: 403 CANDIDATE CHUNKS FROM 683.

Important: This phase selects chunks; it does not make final terminology decisions. Do not include BERT, fine-tuning, model training, or human approval. Use short English labels only. Leave space for slide title and bottom caption. Aspect ratio 16:9, crisp vector infographic, presentation quality.
```

---

## Slide 8 — Phase 3: Local Qwen Inference

```text
Create a clean client-facing process diagram for Phase 3 of a Japanese railway terminology project: local Qwen inference that produces structured draft terminology records.

Style: Professional academic research presentation, white background, deep navy blue and cyan accents, restrained JR red highlights, green only for valid JSON, rounded panels, flat vector icons, thin arrows, high readability, minimal text, no logos, no fake Japanese text, no cartoon mascot, no glowing AI brain, no robot.

Layout: A left-to-right pipeline with four zones: CONTEXT INPUT, LOCAL INFERENCE, VALIDATION, DRAFT OUTPUT.

CONTEXT INPUT:
Show three aligned inputs:
- JAPANESE CHUNK
- DOMAIN MATCHES
- COMMON-WORD MATCHES
Represent the Japanese chunk as neutral text lines; do not generate fake Japanese characters.

LOCAL INFERENCE:
Show a secure local workstation or server labeled QWEN2.5-7B-INSTRUCT-AWQ.
Add three compact generation settings:
- DETERMINISTIC
- MAX INPUT 2048
- MAX OUTPUT 350

VALIDATION:
Show three connected steps:
1. Extract JSON Array
2. Repair Minor JSON Errors
3. Normalize Required Keys

DRAFT OUTPUT:
Show structured records with these short fields:
term_ja, label, meaning_en, context_ja, need_review
Show two labels: known_term and new_candidate.
Add a clear orange or red review badge: DRAFT — HUMAN REVIEW REQUIRED.
Add a compact checkpoint note: 3 CHUNKS / 36 RAW ROWS SAVED.

Important: This is inference only. Do not show training, gradient updates, loss curves, epochs, LoRA adapters, or a completed fine-tuned model. Do not imply AWQ is trainable in this phase. Use short English labels only. Leave space for slide title and bottom caption. Aspect ratio 16:9, crisp vector infographic, presentation quality.
```

---

## Slide 10 — Phase 4: Human Review to SFT Dataset

```text
Create a clean client-facing process diagram for Phase 4 of a Japanese railway terminology project: converting draft inference output into a reviewed supervised fine-tuning dataset.

Style: Professional academic research presentation, white background, deep navy blue and cyan accents, restrained JR red highlights, green for accepted records, orange for corrected records, gray for rejected records, rounded panels, flat vector icons, thin arrows, high readability, minimal text, no logos, no fake Japanese text, no cartoon mascot, no decorative AI imagery.

Layout: A left-to-right pipeline with four zones: SOURCE EVIDENCE, REVIEW TABLE, REVIEW DECISION, SFT OUTPUT.

SOURCE EVIDENCE:
Show an original PDF page, page number, highlighted source sentence, and document/chunk metadata.

REVIEW TABLE:
Show compact columns:
TERM, LABEL, MEANING, CONTEXT, SOURCE, STATUS

REVIEW DECISION:
Show three clear paths:
- ACCEPT — green check
- CORRECT — orange edit icon
- REJECT — gray remove icon

Show reviewer-editable fields:
corrected_term_ja, corrected_meaning, corrected_label, review_note

SFT OUTPUT:
Show reviewed records grouped by chunk_id and exported as SFT_DATASET.JSONL.
Represent each JSONL record as:
INPUT = chunk + dictionary signals
OUTPUT = reviewed term JSON

Add a gating statement in a navy ribbon:
ONLY REVIEWED LABELS ENTER TRAINING.

Important: Do not present the draft CSV as ground truth. Do not show fine-tuning as completed. Use short English labels only. Leave space for slide title and bottom caption. Aspect ratio 16:9, crisp vector infographic, presentation quality.
```

---

## Slide 11 — Evaluation Roadmap

```text
Create a clean five-stage roadmap for a Japanese railway terminology extraction research project.

Style: Professional academic research presentation, white background, deep navy blue and cyan accents, restrained JR red for the current stage, pale green for the final evaluation stage, rounded panels, flat vector icons, thin arrows, high readability, minimal text, no logos, no fake Japanese text, no cartoon mascot, no decorative AI imagery.

Layout: Five equal rounded cards connected from left to right. Highlight the first card with a thin red border and a CURRENT badge.

1. INFERENCE BASELINE
Run Qwen locally and export draft CSV.

2. HUMAN REVIEW
Accept, reject, correct, and add notes.

3. SFT DATASET
Group reviewed labels by chunk into JSONL.

4. QLORA / SFT
Train Qwen2.5-7B-Instruct, not the AWQ model.

5. BEFORE / AFTER
Compare precision, correct new candidates, JSON stability, context fidelity, and human review effort.

Add a navy footer ribbon:
TRAIN ONLY AFTER REVIEWED LABELS ARE RELIABLE.

Use short English labels only. Keep every description inside its own card. Leave space for slide title and bottom caption. Aspect ratio 16:9, crisp vector infographic, presentation quality.
```

## Replacement map

| PowerPoint slide | New asset |
|---|---|
| Slide 2 | Project Vision |
| Slide 3 | Month 2 End-to-End Overview |
| Slide 4 | System Architecture |
| Slide 6 | Phase 1: PDF to Traceable Chunks |
| Slide 7 | Phase 2: Hybrid Candidate Selection |
| Slide 8 | Phase 3: Local Qwen Inference |
| Slide 10 | Phase 4: Human Review to SFT Dataset |
| Slide 11 | Evaluation Roadmap |

Slide 9 should keep the real web application screenshot rather than an AI-generated interface image.
