import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(testDir, "../python/extract_terms.py");

test("extractor returns exact occurrences and an occurrence-based frequency", () => {
  const payload = {
    text: "[[PAGE 2]]\n閉そく方式を確認する。閉そく方式を変更する。",
    threshold: 0.5,
    fileName: "sample.pdf",
    modelDir: "/missing"
  };
  const stdout = execFileSync(process.env.PYTHON ?? "python3", [scriptPath], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  const result = JSON.parse(stdout);
  const repeated = result.terms.find((term) => term.term === "方式");

  assert.ok(repeated);
  assert.equal(repeated.frequency, 2);
  assert.equal(repeated.occurrences.length, 2);
  assert.deepEqual(repeated.occurrences.map((occurrence) => occurrence.page), [2, 2]);
  assert.ok(repeated.occurrences.every((occurrence) => occurrence.sentence.includes("方式")));
});
