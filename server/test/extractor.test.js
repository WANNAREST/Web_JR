import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(testDir, "../python/extract_terms.py");
const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

test("extractor returns exact occurrences and an occurrence-based frequency", () => {
  const payload = {
    text: "[[PAGE 2]]\n閉そく方式を確認する。閉そく方式を変更する。",
    threshold: 0.5,
    fileName: "sample.pdf",
    modelDir: "/missing"
  };
  const stdout = execFileSync(python, [scriptPath], {
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

test("extractor fails loudly instead of silently using demo scoring when BERT is required", () => {
  const processResult = spawnSync(python, [scriptPath], {
    input: JSON.stringify({
      action: "health",
      modelDir: path.join(testDir, "missing-model"),
      requireModel: true
    }),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });

  assert.notEqual(processResult.status, 0);
  assert.match(processResult.stderr, /BERT model not found/);
});

test("extractor explains how to restore Git LFS model weights", (t) => {
  const modelDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-jr-lfs-model-"));
  t.after(() => fs.rmSync(modelDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(modelDir, "config.json"), "{}");
  fs.writeFileSync(path.join(modelDir, "tokenizer_config.json"), "{}");
  fs.writeFileSync(
    path.join(modelDir, "model.safetensors"),
    [
      "version https://git-lfs.github.com/spec/v1",
      "oid sha256:f106d0483870aa0963efac67d6d6cb212321f5925e704fd8a7c7c6f923a6f014",
      "size 444858368",
      ""
    ].join("\n")
  );

  const processResult = spawnSync(python, [scriptPath], {
    input: JSON.stringify({
      action: "health",
      modelDir,
      requireModel: true
    }),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });

  assert.notEqual(processResult.status, 0);
  assert.match(processResult.stderr, /Git LFS pointer/);
  assert.match(processResult.stderr, /git lfs pull/);
  assert.match(processResult.stderr, /444858368 bytes/);
});

test("candidate generation never silently falls back to regex when GiNZA fails", () => {
  const script = [
    "import sys",
    `sys.path.insert(0, ${JSON.stringify(path.resolve(testDir, "../python"))})`,
    "from term_candidates import CandidateGenerator",
    "generator = CandidateGenerator()",
    "generator._load_nlp = lambda: (_ for _ in ()).throw(RuntimeError('broken runtime'))",
    "try:",
    "    generator.generate('信号扱い')",
    "except RuntimeError as error:",
    "    print(error)",
    "else:",
    "    raise AssertionError('generator silently used regex fallback')"
  ].join("\n");
  const result = spawnSync(python, ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /GiNZA candidate generation failed/);
});

test("shared GiNZA generator repairs wrapped lines and keeps Japanese noun suffixes", () => {
  const stdout = execFileSync(python, [scriptPath], {
    input: JSON.stringify({
      action: "candidates",
      text: [
        "[[PAGE 1]]",
        "駅の仕事（信号扱い）と列車扱い。計画通り走行する。巡視及び検査。",
        "[[PAGE 8]]",
        "高品質な輸送サー",
        "ビスを提供する。",
        "[[BLOCK]]",
        "戸閉制御ＮＦＢ",
        "[[BLOCK]]",
        "戸閉電磁弁ＮＦＢ",
        "[[BLOCK]]",
        "鎖錠ピン"
      ].join("\n")
    }),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  const result = JSON.parse(stdout);
  const candidates = new Set(result.candidates.map((row) => row.candidate));

  assert.ok(candidates.has("信号扱い"));
  assert.ok(candidates.has("列車扱い"));
  assert.ok(candidates.has("計画通り"));
  assert.ok(!candidates.has("信号扱"));
  assert.ok(!candidates.has("列車扱"));
  assert.ok(!candidates.has("計画通"));
  assert.ok(!candidates.has("巡視及"));

  assert.equal(result.sentences[3].sentence, "高品質な輸送サービスを提供する。");
  assert.ok(candidates.has("輸送サービス"));
  assert.ok(!candidates.has("輸送サー"));
  assert.ok(candidates.has("戸閉制御NFB"));
  assert.ok(candidates.has("戸閉電磁弁NFB"));
  assert.ok(candidates.has("鎖錠ピン"));
  assert.ok(!candidates.has("戸閉制御NFB戸閉電磁弁NFB"));
});
