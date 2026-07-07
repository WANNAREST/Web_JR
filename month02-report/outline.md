# Month 2 Report Outline

## Template mapping (0-based)

`template_mapping = [0, 1, 2, 3, 4, 5, 7, 10, 9, 11, 12, 13]`

1. Cover — Template slide 0
   - Monthly Research Report, Month 2
   - Research theme: Local LLM-assisted Japanese railway terminology extraction
2. Project Vision — Template slide 1
   - Move from extraction baseline to review-ready terminology data
3. Month 2 Overview — Template slide 2
   - Validate the complete local inference loop before fine-tuning
4. System Architecture — Template slide 3
   - Ingestion, candidate selection, Qwen inference, human review/SFT
5. Focus of Month 2 — Template slide 4
   - Inference baseline and reviewer-facing web application
6. PDF to Traceable Chunks — Template slide 5
   - 4 PDFs, 594 pages, 683 chunks; page/chunk traceability
7. Hybrid Candidate Extraction — Template slide 7
   - Domain dictionary, common-word negatives, generic-word filtering, candidate ranking
8. Current Phase: Local Qwen Inference — Template slide 10
   - Qwen2.5-7B-Instruct-AWQ, constrained JSON, deterministic decoding
9. Web Review Interface — Template slide 9
   - Multi-file upload, threshold, multilingual UI, CSV, page-level PDF verification
10. Human Review Before Fine-tuning — Template slide 11
    - Accept/reject/correct, create reviewed JSONL, then QLoRA/SFT
11. Roadmap and Evaluation — Template slide 12
    - Baseline, review, dataset creation, fine-tune, before/after comparison
12. Closing — Template slide 13
