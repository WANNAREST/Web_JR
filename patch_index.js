const fs = require("fs");
const path = require("path");
const P = "C:/Users/SLG PC/Documents/WEB_JR/Web_JR/server/src/index.js";
function read() {
  return fs.readFileSync(P, "utf8");
}
function apply(fn) {
  let src = read();
  src = fn(src);
  fs.writeFileSync(P, src);
  console.log("patched");
}

// clean up this scratch file after running

const BEFORE = `try {
  for (let i = 0; i < files.length; i++) {
    const originalName = decodeOriginalName(file.originalname);`;

const AFTER = `try {
  for (let i = 0; i < files.length; i++) {
    const current = files[i];
    const originalName = decodeOriginalName(current.originalname);`;

src = src.replace(BEFORE, AFTER);

const BEFORE2 = `const text = await extractText(file.path, ext);`;
const AFTER2 = `sendEvent({ percent: Math.round((i / files.length) * 100), stage: "extracting: " + originalName });
      const text = await extractText(current.path, ext);`;

src = src.replace(BEFORE2, AFTER2);

const BEFORE3 = `const result = await runPythonInference({`;
const AFTER3 = `sendEvent({ percent: Math.round(((i + 0.5) / files.length) * 100), stage: "analyzing: " + originalName });
      const result = await runPythonInference({`;

src = src.replace(BEFORE3, AFTER3);

src = src.replace(/\bsha256: await hashFile\(file\.path\)/g, "sha256: await hashFile(current.path)");
src = src.replace(/\bsizeBytes: file\.size/g, "sizeBytes: current.size");
src = src.replace(/await fs\.rename\(file\.path, storedPath\)/g, "await fs.rename(current.path, storedPath)");

const SSE_HEADERS = `res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data) => {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    res.write("data: " + payload + "\\n\\n");
  };

  const sendError = (status, payload) => {
    sendEvent({ error: payload });
    return res.status(status).end();
  };

`;

src = src.replace(
  `res.setHeader("Content-Type", "application/json");\n  req.body`,
  SSE_HEADERS + "req.body"
);

src = src.replace(
  'return res.status(400).json({ error: "文書を1件以上選択してください。" });',
  'return sendError(400, "文書を1件以上選択してください。");'
);

src = src.replace(
  'return res.status(422).json({',
  'sendEvent({ percent: 100, stage: "done" }); res.write("data: [DONE]\\n\\n"); return sendError(422,'
);

const RESULT_LINE = `res.json({
      ...aggregate,
      runId: persisted.runId,
      terms: persisted.terms,
      files: processed.map(publicFileResult),
      elapsedMs
    });`;

src = src.replace(
  RESULT_LINE,
  `sendEvent({ percent: 100, stage: "done" });
    res.write("data: [DONE]\\n\\n");
    res.json({
      ...aggregate,
      runId: persisted.runId,
      terms: persisted.terms,
      files: processed.map(publicFileResult),
      elapsedMs
    });`
);

src = src.replace(
  'res.status(500).json({',
  'sendEvent({ percent: 100, stage: "error" }); res.write("data: [DONE]\\n\\n"); res.status(500).json({'
);

fs.writeFileSync(p, src);
console.log("Patch applied. Verify file.");
