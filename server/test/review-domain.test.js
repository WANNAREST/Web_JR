import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, isReviewStatus, isUuid, normalizeTerm } from "../src/review-domain.js";

test("normalizeTerm uses NFKC and trims surrounding whitespace", () => {
  assert.equal(normalizeTerm("  ＡＴＳ  "), "ATS");
});

test("review status allowlist accepts only supported states", () => {
  for (const status of ["unreviewed", "approved", "rejected", "uncertain"]) {
    assert.equal(isReviewStatus(status), true);
  }
  assert.equal(isReviewStatus("deleted"), false);
  assert.equal(isReviewStatus(""), false);
});

test("UUID validation rejects values that PostgreSQL cannot cast safely", () => {
  assert.equal(isUuid("f6546ab4-da80-4cf2-a4e6-655cfb887a95"), true);
  assert.equal(isUuid("../../documents/private.pdf"), false);
  assert.equal(isUuid("not-a-uuid"), false);
});

test("CSV cells escape quotes and neutralize spreadsheet formulas", () => {
  assert.equal(csvCell('閉そく"方式'), '"閉そく""方式"');
  assert.equal(csvCell("=cmd()"), '"\'=cmd()"');
  assert.equal(csvCell("通常語"), '"通常語"');
});
