BEGIN;

CREATE TABLE IF NOT EXISTS document_term_reviews (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  review_status text NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'approved', 'rejected', 'uncertain')),
  review_note text,
  reviewed_by_username text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_version integer NOT NULL DEFAULT 0 CHECK (review_version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, term_id),
  CONSTRAINT document_term_reviews_metadata_valid CHECK (
    review_status = 'unreviewed'
    OR (reviewed_by_username IS NOT NULL AND reviewed_by_name IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS document_term_review_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id uuid NOT NULL,
  term_id uuid NOT NULL,
  previous_status text NOT NULL CHECK (previous_status IN ('unreviewed', 'approved', 'rejected', 'uncertain')),
  new_status text NOT NULL CHECK (new_status IN ('unreviewed', 'approved', 'rejected', 'uncertain')),
  note text,
  reviewer_username text NOT NULL,
  reviewer_name text NOT NULL,
  review_version integer NOT NULL CHECK (review_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id, term_id) REFERENCES document_term_reviews(document_id, term_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS document_term_reviews_status_idx
  ON document_term_reviews (document_id, review_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS document_term_review_history_idx
  ON document_term_review_history (document_id, term_id, created_at DESC);

COMMIT;
