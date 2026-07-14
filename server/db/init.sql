BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_username text NOT NULL,
  created_by_name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('demo', 'bert')),
  threshold numeric(5,4) NOT NULL CHECK (threshold >= 0 AND threshold <= 1),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'completed_with_errors', 'failed')),
  document_count integer NOT NULL DEFAULT 0 CHECK (document_count >= 0),
  sentence_count integer NOT NULL DEFAULT 0 CHECK (sentence_count >= 0),
  character_count integer NOT NULL DEFAULT 0 CHECK (character_count >= 0),
  candidate_count integer NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  elapsed_ms integer CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  storage_key text,
  sha256 char(64),
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  character_count integer NOT NULL DEFAULT 0 CHECK (character_count >= 0),
  sentence_count integer NOT NULL DEFAULT 0 CHECK (sentence_count >= 0),
  status text NOT NULL CHECK (status IN ('processed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_storage_key_unique UNIQUE (storage_key),
  CONSTRAINT documents_processed_file_required CHECK (
    status <> 'processed' OR (storage_key IS NOT NULL AND sha256 IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_text text NOT NULL,
  normalized_text text NOT NULL UNIQUE,
  review_status text NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'approved', 'rejected', 'uncertain')),
  review_note text,
  reviewed_by_username text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_version integer NOT NULL DEFAULT 0 CHECK (review_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terms_text_not_blank CHECK (length(btrim(term_text)) > 0),
  CONSTRAINT terms_normalized_not_blank CHECK (length(btrim(normalized_text)) > 0),
  CONSTRAINT terms_review_metadata_valid CHECK (
    review_status = 'unreviewed'
    OR (reviewed_by_username IS NOT NULL AND reviewed_by_name IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS term_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  score numeric(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  frequency integer NOT NULL DEFAULT 1 CHECK (frequency > 0),
  candidate_group text NOT NULL,
  extraction_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT term_candidates_run_term_unique UNIQUE (extraction_run_id, term_id)
);

CREATE TABLE IF NOT EXISTS term_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_candidate_id uuid NOT NULL REFERENCES term_candidates(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number integer CHECK (page_number IS NULL OR page_number > 0),
  sentence_text text NOT NULL,
  start_char integer CHECK (start_char IS NULL OR start_char >= 0),
  end_char integer CHECK (end_char IS NULL OR end_char >= 0),
  score numeric(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT term_occurrences_sentence_not_blank CHECK (length(btrim(sentence_text)) > 0),
  CONSTRAINT term_occurrences_offsets_valid CHECK (
    start_char IS NULL OR end_char IS NULL OR end_char >= start_char
  )
);

CREATE TABLE IF NOT EXISTS term_review_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  previous_status text NOT NULL
    CHECK (previous_status IN ('unreviewed', 'approved', 'rejected', 'uncertain')),
  new_status text NOT NULL
    CHECK (new_status IN ('unreviewed', 'approved', 'rejected', 'uncertain')),
  note text,
  reviewer_username text NOT NULL,
  reviewer_name text NOT NULL,
  review_version integer NOT NULL CHECK (review_version > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS extraction_runs_created_at_idx
  ON extraction_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS documents_run_idx
  ON documents (extraction_run_id);
CREATE INDEX IF NOT EXISTS documents_sha256_idx
  ON documents (sha256) WHERE sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS terms_review_status_idx
  ON terms (review_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS terms_reviewed_at_idx
  ON terms (reviewed_at DESC) WHERE reviewed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS term_candidates_term_idx
  ON term_candidates (term_id, created_at DESC);
CREATE INDEX IF NOT EXISTS term_candidates_run_idx
  ON term_candidates (extraction_run_id);
CREATE INDEX IF NOT EXISTS term_occurrences_candidate_idx
  ON term_occurrences (term_candidate_id);
CREATE INDEX IF NOT EXISTS term_occurrences_document_idx
  ON term_occurrences (document_id, page_number);
CREATE INDEX IF NOT EXISTS term_review_history_term_idx
  ON term_review_history (term_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS terms_set_updated_at ON terms;
CREATE TRIGGER terms_set_updated_at
BEFORE UPDATE ON terms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE extraction_runs IS 'One authenticated document extraction operation.';
COMMENT ON TABLE documents IS 'Document metadata only. File bytes remain in private server storage.';
COMMENT ON TABLE terms IS 'Global normalized terminology catalog and current human review decision.';
COMMENT ON TABLE term_candidates IS 'A term candidate produced by a specific extraction run.';
COMMENT ON TABLE term_occurrences IS 'Exact source evidence for a candidate term.';
COMMENT ON TABLE term_review_history IS 'Append-only audit history for human review decisions.';

COMMIT;
