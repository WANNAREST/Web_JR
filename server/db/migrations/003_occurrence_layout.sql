BEGIN;

ALTER TABLE term_occurrences
  ADD COLUMN IF NOT EXISTS segment_id text,
  ADD COLUMN IF NOT EXISTS segment_type text,
  ADD COLUMN IF NOT EXISTS source_bbox jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'term_occurrences_segment_type_valid'
  ) THEN
    ALTER TABLE term_occurrences
      ADD CONSTRAINT term_occurrences_segment_type_valid
      CHECK (segment_type IS NULL OR segment_type IN ('text', 'table_cell', 'flow_label'));
  END IF;
END;
$$;

COMMIT;
