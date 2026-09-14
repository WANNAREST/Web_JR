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

test("structured PDF segments keep table cells and flow labels independent", () => {
  const stdout = execFileSync(python, [scriptPath], {
    input: JSON.stringify({
      action: "candidates",
      pages: [{
        page: 12,
        width: 600,
        height: 800,
        segments: [
          { id: "p12-s1", type: "table_cell", text: "特殊自動", bbox: { x: 20, y: 100, width: 60, height: 12 } },
          { id: "p12-s2", type: "table_cell", text: "非自動列車", bbox: { x: 180, y: 100, width: 80, height: 12 } },
          { id: "p12-s3", type: "flow_label", text: "列車の停止", bbox: { x: 20, y: 180, width: 70, height: 12 } },
          { id: "p12-s4", type: "flow_label", text: "状況の確認", bbox: { x: 180, y: 180, width: 70, height: 12 } }
        ]
      }]
    }),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  const result = JSON.parse(stdout);

  assert.deepEqual(result.sentences.map((row) => row.sentence), ["特殊自動", "非自動列車", "列車の停止", "状況の確認"]);
  assert.equal(result.sentences[0].segmentId, "p12-s1");
  assert.equal(result.sentences[0].segmentType, "table_cell");
  assert.deepEqual(result.sentences[0].bbox, { x: 20, y: 100, width: 60, height: 12 });
  assert.ok(!result.sentences.some((row) => row.sentence.includes("特殊自動非自動")));
});

test("structured PDF inference carries segment and bbox into occurrences", () => {
  const stdout = execFileSync(python, [scriptPath], {
    input: JSON.stringify({
      text: "閉そく方式を確認する。",
      pages: [{
        page: 7,
        segments: [{
          id: "p7-s4",
          type: "table_cell",
          text: "閉そく方式を確認する。",
          bbox: { x: 44, y: 220, width: 180, height: 14 }
        }]
      }],
      threshold: 0.5,
      fileName: "layout.pdf",
      modelDir: "/missing"
    }),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  const result = JSON.parse(stdout);
  const occurrence = result.terms.flatMap((term) => term.occurrences).find((row) => row.segmentId === "p7-s4");

  assert.ok(occurrence);
  assert.equal(occurrence.page, 7);
  assert.equal(occurrence.segmentType, "table_cell");
  assert.deepEqual(occurrence.bbox, { x: 44, y: 220, width: 180, height: 14 });
  assert.equal(typeof occurrence.rawScore, "number");
  assert.equal(result.sourceQuality.kind, "structured_pdf");
});

test("structured extraction filters structural labels but retains technical flow text", () => {
  const stdout = execFileSync(python, [scriptPath], {
    input: JSON.stringify({
      action: "candidates",
      pages: [{ page: 9, segments: [
        { id: "p9-s1", type: "text", text: "9 / 120" },
        { id: "p9-s2", type: "text", text: "達示番号: 運第123号" },
        { id: "p9-s3", type: "flow_label", text: "非常ブレーキ取扱い" }
      ] }]
    }),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  const result = JSON.parse(stdout);

  assert.deepEqual(result.sentences.map((row) => row.sentence), ["非常ブレーキ取扱い"]);
});

test("structured extraction drops table-of-contents leaders and splits numbered lists", () => {
  const stdout = execFileSync(python, [scriptPath], {
    input: JSON.stringify({
      action: "candidates",
      pages: [{ page: 5, segments: [
        { id: "p5-s1", type: "text", text: "4-3 ドア故障時の処置················25" },
        { id: "p5-s2", type: "table_cell", text: "以下を連絡1火災の場所2火災の程度3隣接線抑止の要否" },
        { id: "p5-s3", type: "text", text: "動作8-12「閉そく指示運転」" },
        { id: "p5-s4", type: "text", text: "NFB1確認" },
        { id: "p5-s5", type: "text", text: "4表示灯確認5ブレーキ試験" },
        { id: "p5-s6", type: "text", text: "9信号確認10ノッチ投入" },
        { id: "p5-s7", type: "text", text: "信号旗(赤、緑各1丁)、軌道短絡器(2個)" },
        { id: "p5-s8", type: "text", text: "第3位車輪はNo1位またはNo8位" },
        { id: "p5-s9", type: "text", text: "3 場所 ············· ( )駅" },
        { id: "p5-s10", type: "text", text: "非常気笛吹鳴(・・・・・ー)" }
      ] }]
    }),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  const result = JSON.parse(stdout);
  const sentences = result.sentences.map((row) => row.sentence);

  assert.ok(!sentences.some((sentence) => sentence.includes("····")));
  assert.ok(sentences.includes("以下を連絡"));
  assert.ok(sentences.includes("火災の場所"));
  assert.ok(sentences.includes("火災の程度"));
  assert.ok(sentences.includes("隣接線抑止の要否"));
  assert.ok(sentences.includes("動作8-12「閉そく指示運転」"));
  assert.ok(sentences.includes("NFB1確認"));
  assert.ok(sentences.includes("表示灯確認"));
  assert.ok(sentences.includes("ブレーキ試験"));
  assert.ok(sentences.includes("信号確認"));
  assert.ok(sentences.includes("ノッチ投入"));
  assert.ok(sentences.includes("信号旗(赤、緑各1丁)、軌道短絡器(2個)"));
  assert.ok(sentences.includes("第3位車輪はNo1位またはNo8位"));
  assert.ok(!sentences.some((sentence) => sentence.includes("······")));
  assert.ok(sentences.includes("非常気笛吹鳴(・・・・・ー)"));
});

test("candidate normalization removes leading checklist markers and rejects broken compounds", () => {
  const script = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(path.resolve(testDir, "../python"))})`,
    "from term_candidates import clean_candidate, valid_candidate",
    "print(json.dumps({",
    "  'term': clean_candidate('□運転再開'),",
    "  'middle': clean_candidate('列車・乗務員切替ボタン'),",
    "  'broken': valid_candidate('箇所(トンネル'),",
    "  'valid': valid_candidate('動作8-12')",
    "}, ensure_ascii=False))"
  ].join("\n");
  const result = spawnSync(python, ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);

  assert.equal(output.term, "運転再開");
  assert.equal(output.middle, "列車・乗務員切替ボタン");
  assert.equal(output.broken, false);
  assert.equal(output.valid, true);
});

test("evidence ranking prefers a concise explanatory sentence", () => {
  const script = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(path.resolve(testDir, "../python"))})`,
    "from extract_terms import evidence_sort_key",
    "term = '閉そく方式'",
    "rows = [",
    "  {'sentence': term, 'segmentType': 'flow_label', 'score': 0.999},",
    "  {'sentence': term + 'に関する説明' * 40, 'segmentType': 'text', 'score': 0.999},",
    "  {'sentence': '閉そく方式を変更する。', 'segmentType': 'text', 'score': 0.9}",
    "]",
    "rows.sort(key=lambda row: evidence_sort_key(term, row), reverse=True)",
    "print(json.dumps(rows, ensure_ascii=False))"
  ].join("\n");
  const result = spawnSync(python, ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  assert.equal(result.status, 0, result.stderr);

  assert.equal(JSON.parse(result.stdout)[0].sentence, "閉そく方式を変更する。");
});

test("extractor returns every candidate instead of silently truncating at 300", () => {
  const text = Array.from({ length: 305 }, (_, index) => `用語A${index}。`).join("\n");
  const stdout = execFileSync(python, [scriptPath], {
    input: JSON.stringify({ text, threshold: 0.5, modelDir: "/missing" }),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  const result = JSON.parse(stdout);

  assert.ok(result.termCount > 300);
  assert.equal(result.terms.length, result.termCount);
});

test("review calibration is monotonic and keeps raw scores auditable", () => {
  const script = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(path.resolve(testDir, "../python"))})`,
    "from extract_terms import build_isotonic_calibrator, calibrated_score",
    "calibrator, stats = build_isotonic_calibrator({'bins': [",
    "  {'rawScore': 0.6, 'weight': 15, 'positives': 3},",
    "  {'rawScore': 0.8, 'weight': 15, 'positives': 9},",
    "  {'rawScore': 0.95, 'weight': 15, 'positives': 14}",
    "]})",
    "values = [calibrated_score(score, calibrator) for score in (0.6, 0.7, 0.8, 0.9, 0.95)]",
    "print(json.dumps({'stats': stats, 'values': values}))"
  ].join("\n");
  const result = spawnSync(python, ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONPYCACHEPREFIX: "/tmp/web-jr-test-pycache" }
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);

  assert.equal(output.stats.applied, true);
  assert.ok(output.values.every((value, index) => index === 0 || value >= output.values[index - 1]));
});
