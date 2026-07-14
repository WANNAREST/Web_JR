import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(testDir, "../db/init.sql");

test("initial schema includes the persistence and audit tables", async () => {
  const sql = await fs.readFile(sqlPath, "utf8");
  for (const table of [
    "extraction_runs",
    "documents",
    "terms",
    "term_candidates",
    "term_occurrences",
    "term_review_history"
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(sql, /normalized_text text NOT NULL UNIQUE/);
  assert.match(sql, /review_version integer NOT NULL DEFAULT 0/);
  assert.match(sql, /CHECK \(review_status IN \('unreviewed', 'approved', 'rejected', 'uncertain'\)\)/);
  assert.match(sql, /CONSTRAINT terms_review_metadata_valid CHECK/);
  assert.match(sql, /COMMIT;/);
});
