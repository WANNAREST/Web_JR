import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(testDir, "../db/init.sql");
const migrationPath = path.resolve(testDir, "../db/migrations/002_document_term_reviews.sql");
const layoutMigrationPath = path.resolve(testDir, "../db/migrations/003_occurrence_layout.sql");
const qualityMigrationPath = path.resolve(testDir, "../db/migrations/004_quality_and_calibration.sql");
const repositoryPath = path.resolve(testDir, "../src/review-repository.js");

test("initial schema includes the persistence and audit tables", async () => {
  const sql = await fs.readFile(sqlPath, "utf8");
  for (const table of [
    "extraction_runs",
    "documents",
    "terms",
    "term_candidates",
    "term_occurrences",
    "term_review_history",
    "document_term_reviews",
    "document_term_review_history"
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(sql, /normalized_text text NOT NULL UNIQUE/);
  assert.match(sql, /review_version integer NOT NULL DEFAULT 0/);
  assert.match(sql, /CHECK \(review_status IN \('unreviewed', 'approved', 'rejected', 'uncertain'\)\)/);
  assert.match(sql, /CONSTRAINT terms_review_metadata_valid CHECK/);
  assert.match(sql, /source_bbox jsonb/);
  assert.match(sql, /quality_score numeric\(5,4\)/);
  assert.match(sql, /raw_score numeric\(5,4\) NOT NULL/);
  assert.match(sql, /COMMIT;/);
});

test("quality and calibration migration preserves existing scores", async () => {
  const sql = await fs.readFile(qualityMigrationPath, "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS quality_score/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS raw_score/);
  assert.match(sql, /UPDATE term_candidates SET raw_score = score WHERE raw_score IS NULL/);
  assert.match(sql, /ALTER COLUMN raw_score SET NOT NULL/);
  assert.match(sql, /COMMIT;/);
});

test("occurrence layout migration is versioned and backwards compatible", async () => {
  const sql = await fs.readFile(layoutMigrationPath, "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS segment_id text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS segment_type text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS source_bbox jsonb/);
  assert.match(sql, /COMMIT;/);
});

test("document-level review migration is versioned", async () => {
  const sql = await fs.readFile(migrationPath, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS document_term_reviews/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS document_term_review_history/);
  assert.match(sql, /COMMIT;/);
});

test("document review query keeps the displayed sentence and page from one occurrence", async () => {
  const repository = await fs.readFile(repositoryPath, "utf8");
  const query = repository.slice(repository.indexOf("export async function listDocumentReviewTerms"), repository.indexOf("export async function updateDocumentTermReview"));
  assert.match(query, /ROW_NUMBER\(\) OVER/);
  assert.match(query, /WHERE occurrence\.occurrence_rank = 1/);
  assert.doesNotMatch(query, /MIN\(occurrence\.sentence_text\)/);
  assert.doesNotMatch(query, /MIN\(occurrence\.page_number\)/);
});

test("reviewed terminology queries use document-scoped review records", async () => {
  const repository = await fs.readFile(repositoryPath, "utf8");
  assert.match(repository, /export async function getDocumentReviewSummary/);
  assert.match(repository, /FROM document_term_reviews review/);
  assert.match(repository, /WHERE document_id = \$1 AND term_id = \$2/);
});
