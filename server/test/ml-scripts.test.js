import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const pythonDir = path.resolve(testDir, "../python");
const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

test("evaluation metrics and boundary hard negatives are deterministic", () => {
  const script = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(pythonDir)})`,
    "from evaluate_bert import build_report",
    "from finetune_reviewed import add_boundary_hard_negatives",
    "rows = [",
    " {'term':'信号扱い','context':'信号扱いを行う','labelId':1},",
    " {'term':'一般語','context':'一般語です','labelId':0}",
    "]",
    "augmented, count = add_boundary_hard_negatives(rows)",
    "report = build_report(rows, [0.9, 0.1], 0.5)",
    "print(json.dumps({'count': count, 'terms': [r['term'] for r in augmented], 'f1': report['f1Term']}))"
  ].join("\n");
  const output = execFileSync(python, ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  const result = JSON.parse(output);

  assert.equal(result.f1, 1);
  assert.equal(result.count, 2);
  assert.ok(result.terms.includes("信号扱"));
  assert.ok(result.terms.includes("号扱い"));
});

test("domain dictionary loader selects the Japanese column instead of the row number", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "web-jr-dictionary-"));
  const dictionaryPath = path.join(directory, "terms.csv");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(
    dictionaryPath,
    "\ufeff＃,Japanese,English\n1,戸閉制御ＮＦＢ,door control\n2,鎖錠ピン,lock pin\n",
    "utf8"
  );
  const script = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(pythonDir)})`,
    "from term_candidates import load_term_dictionary",
    `print(json.dumps(sorted(load_term_dictionary(${JSON.stringify(dictionaryPath)})), ensure_ascii=False))`
  ].join("\n");
  const output = execFileSync(python, ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });

  assert.deepEqual(JSON.parse(output), ["戸閉制御NFB", "鎖錠ピン"]);
});
