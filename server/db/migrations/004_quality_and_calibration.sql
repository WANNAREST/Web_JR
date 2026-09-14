BEGIN;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS quality_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS quality_diagnostics jsonb;

ALTER TABLE term_candidates
  ADD COLUMN IF NOT EXISTS raw_score numeric(5,4);

ALTER TABLE term_occurrences
  ADD COLUMN IF NOT EXISTS raw_score numeric(5,4);

UPDATE term_candidates SET raw_score = score WHERE raw_score IS NULL;
UPDATE term_occurrences SET raw_score = score WHERE raw_score IS NULL;

ALTER TABLE term_candidates ALTER COLUMN raw_score SET NOT NULL;
ALTER TABLE term_occurrences ALTER COLUMN raw_score SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_quality_score_valid') THEN
    ALTER TABLE documents ADD CONSTRAINT documents_quality_score_valid
      CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'term_candidates_raw_score_valid') THEN
    ALTER TABLE term_candidates ADD CONSTRAINT term_candidates_raw_score_valid
      CHECK (raw_score >= 0 AND raw_score <= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'term_occurrences_raw_score_valid') THEN
    ALTER TABLE term_occurrences ADD CONSTRAINT term_occurrences_raw_score_valid
      CHECK (raw_score >= 0 AND raw_score <= 1);
  END IF;
END;
$$;

COMMIT;
