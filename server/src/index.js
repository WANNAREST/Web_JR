import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { checkDatabase, isDatabaseConfigured } from "./db.js";
import {
  getDocument,
  getReviewHistory,
  getReviewSummary,
  getTermDetail,
  getTrainingRows,
  listTerms,
  persistExtraction,
  updateTermReview
} from "./review-repository.js";
import { csvCell, isReviewStatus, isUuid, normalizeTerm } from "./review-domain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const uploadDir = path.join(rootDir, "uploads");
const documentStorageDir = path.resolve(process.env.DOCUMENT_STORAGE_DIR ?? path.join(rootDir, "data", "documents"));
const pythonScript = path.join(rootDir, "python", "extract_terms.py");
const configuredModelDir = process.env.BERT_MODEL_DIR ?? path.join("models", "bert_term_classifier", "final_model");
const modelDir = path.resolve(rootDir, configuredModelDir);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

if (process.env.NODE_ENV === "production" && (!process.env.AUTH_USERS || !process.env.SESSION_SECRET || !process.env.DATABASE_URL)) {
  throw new Error("AUTH_USERS, SESSION_SECRET and DATABASE_URL are required in production.");
}

const sessionSecret = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
const sessionDurationSeconds = 8 * 60 * 60;
const users = loadUsers();
const dummyPasswordHash = hashPassword(randomBytes(24).toString("hex"));
const loginAttempts = new Map();
let modelStatusPromise;

if (!process.env.AUTH_USERS) {
  console.warn("AUTH_USERS is not configured. Local login: operator / jr-local-review");
}

if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not configured. Sessions will be reset when the server restarts.");
}

await fs.mkdir(uploadDir, { recursive: true });
await fs.mkdir(documentStorageDir, { recursive: true });
await fs.chmod(documentStorageDir, 0o700);

const app = express();
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 20
  }
});

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.post("/api/auth/login", (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "ログイン試行回数が上限に達しました。しばらくしてから再度お試しください。" });
  }

  const username = String(req.body.username ?? "").normalize("NFKC").trim();
  const password = String(req.body.password ?? "");
  const user = users.find((candidate) => candidate.username === username);
  const passwordIsValid = verifyPassword(password, user?.passwordHash ?? dummyPasswordHash);

  if (!user || !passwordIsValid) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: "ユーザーIDまたはパスワードが正しくありません。" });
  }

  loginAttempts.delete(ip);
  const session = createSession(user);
  res.setHeader("Set-Cookie", sessionCookie(session, sessionDurationSeconds));
  return res.json({ user: publicUser(user) });
});

app.get("/api/auth/session", (req, res) => {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "認証が必要です。" });
  return res.json({ user: { username: session.sub, name: session.name } });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", sessionCookie("", 0));
  return res.status(204).end();
});

app.get("/api/health", async (_req, res) => {
  const databaseConfigured = isDatabaseConfigured();
  const model = await getModelStatus();
  res.json({
    ok: true,
    modelAvailable: model.available,
    modelMode: model.mode,
    modelError: model.error,
    databaseConfigured,
    databaseAvailable: databaseConfigured ? await checkDatabase() : false
  });
});

app.get("/api/review/summary", requireAuth, requireDatabase, asyncRoute(async (_req, res) => {
  res.json(await getReviewSummary());
}));

app.get("/api/terms", requireAuth, requireDatabase, asyncRoute(async (req, res) => {
  const status = String(req.query.status ?? "");
  if (status && status !== "reviewed" && !isReviewStatus(status)) {
    return res.status(400).json({ error: "確認状態が正しくありません。" });
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = String(req.query.search ?? "").slice(0, 100);
  return res.json(await listTerms({ status, search, limit, offset }));
}));

app.get("/api/terms/:id/history", requireAuth, requireDatabase, validateUuidParam, asyncRoute(async (req, res) => {
  const term = await getTermDetail(req.params.id);
  if (!term) return res.status(404).json({ error: "用語が見つかりません。" });
  return res.json({ items: await getReviewHistory(req.params.id) });
}));

app.get("/api/terms/:id", requireAuth, requireDatabase, validateUuidParam, asyncRoute(async (req, res) => {
  const term = await getTermDetail(req.params.id);
  if (!term) return res.status(404).json({ error: "用語が見つかりません。" });
  return res.json(term);
}));

app.patch("/api/terms/:id/review", requireAuth, requireDatabase, validateUuidParam, asyncRoute(async (req, res) => {
  const status = String(req.body.status ?? "");
  const note = String(req.body.note ?? "").trim();
  const expectedVersion = Number(req.body.version);
  if (!isReviewStatus(status)) {
    return res.status(400).json({ error: "確認状態が正しくありません。" });
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return res.status(400).json({ error: "確認バージョンが正しくありません。" });
  }
  if (note.length > 2000) {
    return res.status(400).json({ error: "メモは2000文字以内で入力してください。" });
  }

  const result = await updateTermReview({
    id: req.params.id,
    status,
    note,
    expectedVersion,
    reviewer: { username: req.user.sub, name: req.user.name }
  });
  if (result.kind === "not_found") return res.status(404).json({ error: "用語が見つかりません。" });
  if (result.kind === "conflict") {
    return res.status(409).json({
      error: "別の担当者が先に更新しました。最新の内容を確認してください。",
      current: result.current
    });
  }
  return res.json(result.term);
}));

app.get("/api/documents/:id/content", requireAuth, requireDatabase, validateUuidParam, asyncRoute(async (req, res) => {
  const document = await getDocument(req.params.id);
  if (!document) return res.status(404).json({ error: "文書が見つかりません。" });
  const filePath = path.resolve(documentStorageDir, document.storageKey);
  if (path.dirname(filePath) !== documentStorageDir) {
    return res.status(400).json({ error: "文書の保存先が正しくありません。" });
  }
  await fs.access(filePath);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`);
  res.type(document.mimeType || path.extname(document.fileName));
  return res.sendFile(filePath);
}));

app.get("/api/exports/training.:format", requireAuth, requireDatabase, asyncRoute(async (req, res) => {
  const format = String(req.params.format).toLowerCase();
  if (!['csv', 'jsonl'].includes(format)) {
    return res.status(404).json({ error: "出力形式が正しくありません。" });
  }
  const rows = await getTrainingRows();
  if (format === "jsonl") {
    res.type("application/x-ndjson; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=jr_training_data.jsonl");
    return res.send(rows.map((row) => JSON.stringify(row)).join("\n"));
  }
  const columns = [
    "term", "label", "reviewStatus", "context", "fileName", "page",
    "extractionScore", "reviewNote", "reviewedByName", "reviewedAt", "termId", "documentId"
  ];
  const csv = [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  res.type("text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=jr_training_data.csv");
  return res.send(`\ufeff${csv}`);
}));

app.post("/api/extract", requireAuth, requireDatabaseReady, requireBertReady, upload.array("documents", 20), async (req, res) => {
  const files = req.files ?? [];
  if (!files.length) {
    return res.status(400).json({ error: "文書を1件以上選択してください。" });
  }

  const requestedThreshold = Number(req.body.threshold ?? 0.9);
  const threshold = Number.isFinite(requestedThreshold)
    ? Math.min(0.98, Math.max(0.5, requestedThreshold))
    : 0.9;
  const startedAt = Date.now();
  const processed = [];
  const storedPaths = [];
  const streaming = String(req.headers.accept ?? "").includes("application/x-ndjson");

  if (streaming) {
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
  }

  const sendProgress = (progress) => {
    if (streaming && !res.writableEnded) {
      res.write(`${JSON.stringify({ type: "progress", ...progress })}\n`);
    }
  };

  try {
    for (const [fileIndex, file] of files.entries()) {
      const originalName = decodeOriginalName(file.originalname);
      const ext = path.extname(originalName).toLowerCase();
      let storedPath = null;
      const baseDocument = {
        fileName: originalName,
        mimeType: mimeTypeForExtension(ext),
        sizeBytes: file.size,
        sha256: await hashFile(file.path)
      };

      try {
        sendProgress({
          percent: Math.max(1, Math.round(fileIndex * 98 / files.length)),
          stage: "reading_document",
          fileIndex: fileIndex + 1,
          fileCount: files.length,
          fileName: originalName
        });
        const text = await extractText(file.path, ext);
        if (!text.trim()) throw new Error("文書から文字情報を読み取れませんでした。");

        const result = await runPythonInference({
          text,
          threshold,
          fileName: originalName,
          modelDir,
          requireModel: true
        }, (pythonProgress) => {
          const withinFile = Number(pythonProgress.percent) / 100;
          sendProgress({
            ...pythonProgress,
            percent: Math.min(98, Math.round(((fileIndex + withinFile) / files.length) * 98)),
            fileIndex: fileIndex + 1,
            fileCount: files.length,
            fileName: originalName
          });
        });
        if (result.mode !== "bert") {
          throw new Error("BERT inference was required but the extractor did not use the model.");
        }
        const storageKey = `${randomUUID()}${ext}`;
        storedPath = path.join(documentStorageDir, storageKey);
        await fs.rename(file.path, storedPath);
        await fs.chmod(storedPath, 0o600);
        storedPaths.push(storedPath);
        processed.push({
          ...baseDocument,
          ...result,
          storageKey,
          characterCount: text.length
        });
      } catch (error) {
        if (storedPath) await fs.rm(storedPath, { force: true });
        processed.push({
          ...baseDocument,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successful = processed.filter((item) => !item.error);
    if (!successful.length) {
      const payload = {
        error: "アップロードした文書から文字情報を読み取れませんでした。",
        files: processed
      };
      if (streaming) {
        res.end(`${JSON.stringify({ type: "error", status: 422, data: payload })}\n`);
        return;
      }
      return res.status(422).json(payload);
    }

    sendProgress({ percent: 99, stage: "saving_results", fileCount: files.length });
    const elapsedMs = Date.now() - startedAt;
    const aggregate = aggregateResults(successful, threshold);
    const persisted = await persistExtraction({
      run: { username: req.user.sub, name: req.user.name, elapsedMs },
      documents: processed,
      aggregate
    });
    const responsePayload = {
      ...aggregate,
      runId: persisted.runId,
      terms: persisted.terms,
      files: processed.map(publicFileResult),
      elapsedMs
    };
    if (streaming) {
      res.end(`${JSON.stringify({ type: "result", percent: 100, data: responsePayload })}\n`);
      return;
    }
    res.json(responsePayload);
  } catch (error) {
    await Promise.all(storedPaths.map((storedPath) => fs.rm(storedPath, { force: true })));
    const payload = {
      error: "用語を抽出できませんでした。",
      detail: process.env.NODE_ENV === "production"
        ? undefined
        : error instanceof Error ? error.message : String(error)
    };
    if (streaming) {
      res.end(`${JSON.stringify({ type: "error", status: 500, data: payload })}\n`);
      return;
    }
    res.status(500).json(payload);
  } finally {
    await Promise.all(files.map((file) => fs.rm(file.path, { force: true })));
  }
});

function loadUsers() {
  if (!process.env.AUTH_USERS) {
    return [{
      username: "operator",
      name: "ローカル担当者",
      passwordHash: hashPassword("jr-local-review", "local-development-only")
    }];
  }

  try {
    const configured = JSON.parse(process.env.AUTH_USERS);
    if (!Array.isArray(configured) || configured.length === 0) throw new Error("empty user list");
    return configured.map((user) => {
      if (!user.username || !user.passwordHash) throw new Error("username and passwordHash are required");
      return {
        username: String(user.username).normalize("NFKC").trim(),
        name: String(user.name ?? user.username),
        passwordHash: String(user.passwordHash)
      };
    });
  } catch (error) {
    throw new Error(`AUTH_USERS is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHex] = String(storedHash).split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createSession(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.username,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + sessionDurationSeconds
  })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(req) {
  const token = parseCookies(req.headers.cookie).jr_session;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", sessionSecret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.sub || Number(session.exp) <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "認証が必要です。" });
  req.user = session;
  return next();
}

function requireDatabase(_req, res, next) {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: "DATABASE_URLが設定されていません。" });
  }
  return next();
}

async function requireDatabaseReady(_req, res, next) {
  if (!isDatabaseConfigured() || !await checkDatabase()) {
    return res.status(503).json({ error: "データベースに接続できません。管理担当者に連絡してください。" });
  }
  return next();
}

async function requireBertReady(_req, res, next) {
  const model = await getModelStatus();
  if (!model.available) {
    return res.status(503).json({
      error: "BERTモデルを読み込めません。モデル設定を確認してください。",
      detail: model.error
    });
  }
  return next();
}

function validateUuidParam(req, res, next) {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: "IDが正しくありません。" });
  return next();
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((entry) => {
    const [name, ...value] = entry.trim().split("=");
    return [name, decodeURIComponent(value.join("="))];
  }).filter(([name]) => name));
}

function sessionCookie(value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `jr_session=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function publicUser(user) {
  return { username: user.username, name: user.name };
}

function isRateLimited(ip) {
  const attempt = loginAttempts.get(ip);
  if (!attempt) return false;
  if (Date.now() - attempt.startedAt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return false;
  }
  return attempt.count >= 5;
}

function recordLoginFailure(ip) {
  const attempt = loginAttempts.get(ip);
  if (!attempt || Date.now() - attempt.startedAt > 15 * 60 * 1000) {
    loginAttempts.set(ip, { count: 1, startedAt: Date.now() });
    return;
  }
  attempt.count += 1;
}

function decodeOriginalName(name) {
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("�") ? name : decoded;
}

async function hashFile(filePath) {
  return createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

function publicFileResult(file) {
  return {
    fileName: file.fileName,
    mode: file.mode,
    sentenceCount: file.sentenceCount ?? 0,
    characterCount: file.characterCount ?? 0,
    termCount: file.termCount ?? 0,
    error: file.error
  };
}

function mimeTypeForExtension(ext) {
  return {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".md": "text/markdown; charset=utf-8"
  }[ext] ?? "application/octet-stream";
}

function aggregateResults(results, threshold) {
  const byTerm = new Map();

  for (const result of results) {
    for (const term of result.terms ?? []) {
      if (Number(term.score) < threshold) {
        continue;
      }

      const termKey = normalizeTerm(term.term);
      const existing = byTerm.get(termKey);
      const examples = term.examples ?? [term.sentence].filter(Boolean);
      const occurrences = (term.occurrences ?? []).map((occurrence) => ({
        ...occurrence,
        fileName: result.fileName,
        storageKey: result.storageKey
      }));

      if (!existing) {
        byTerm.set(termKey, {
          ...term,
          frequency: Number(term.frequency ?? 1),
          files: [result.fileName],
          pagesByFile: {
            [result.fileName]: [...new Set(term.pages ?? [term.page].filter(Boolean))]
          },
          examples: examples.map((example) => `${result.fileName}: ${example}`),
          occurrences
        });
        continue;
      }

      existing.frequency += Number(term.frequency ?? 1);
      if (!existing.files.includes(result.fileName)) {
        existing.files.push(result.fileName);
      }
      existing.pagesByFile[result.fileName] = [
        ...new Set([
          ...(existing.pagesByFile[result.fileName] ?? []),
          ...(term.pages ?? [term.page].filter(Boolean))
        ])
      ].sort((a, b) => a - b);
      for (const example of examples) {
        const tagged = `${result.fileName}: ${example}`;
        if (existing.examples.length < 3 && !existing.examples.includes(tagged)) {
          existing.examples.push(tagged);
        }
      }
      existing.occurrences.push(...occurrences);
      if (term.score > existing.score) {
        existing.score = term.score;
        existing.source = term.source;
        existing.group = term.group;
      }
    }
  }

  const terms = [...byTerm.values()]
    .sort((a, b) => b.score - a.score || b.frequency - a.frequency || a.term.localeCompare(b.term, "ja"))
    .map((term, index) => {
      const pages = [...new Set(Object.values(term.pagesByFile).flat())].sort((a, b) => a - b);
      return {
        ...term,
        id: index + 1,
        pages,
        page: pages[0] ?? null
      };
    });

  return {
    mode: results.some((item) => item.mode === "bert") ? "bert" : "demo",
    threshold,
    fileCount: results.length,
    fileNames: results.map((item) => item.fileName),
    sentenceCount: results.reduce((sum, item) => sum + Number(item.sentenceCount ?? 0), 0),
    characterCount: results.reduce((sum, item) => sum + Number(item.characterCount ?? 0), 0),
    termCount: terms.length,
    terms,
    summary: {
      reviewNeeded: terms.filter((term) => term.score < 0.7).length
    }
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function extractText(filePath, ext) {
  const buffer = await fs.readFile(filePath);

  if (ext === ".pdf") {
    const pages = [];
    const data = await pdf(buffer, {
      pagerender: async (pageData) => {
        const content = await pageData.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
        const pageText = content.items.map((item) => item.str).join(" ");
        pages.push(pageText);
        return pageText;
      }
    });

    if (pages.length > 0) {
      return pages
        .map((pageText, index) => `[[PAGE ${index + 1}]]\n${pageText}`)
        .join("\n");
    }

    return data.text;
  }

  if (ext === ".docx") {
    const data = await mammoth.extractRawText({ buffer });
    return data.value;
  }

  if (ext === ".txt" || ext === ".csv" || ext === ".md" || ext === "") {
    return buffer.toString("utf8");
  }

  throw new Error(`${ext || "この形式"}には対応していません。TXT、PDF、DOCXを使用してください。`);
}

function runPythonInference(payload, onProgress) {
  return new Promise((resolve, reject) => {
    const defaults = process.platform === "win32"
      ? ["python", "py"]
      : ["python3", "python"];
    const candidates = [...new Set([process.env.PYTHON, ...defaults].filter(Boolean))];

    let settled = false;
    const settle = (fn) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const tryRun = (index) => {
      if (index >= candidates.length) {
        return reject(new Error("抽出処理に必要なPythonランタイムが見つかりません。"));
      }

      const child = spawn(candidates[index], [pythonScript], {
        cwd: rootDir,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      let stderrRemainder = "";
      let spawnFailed = false;

      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => {
        const lines = `${stderrRemainder}${chunk.toString()}`.split(/\r?\n/);
        stderrRemainder = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("PROGRESS:")) {
            try {
              onProgress?.(JSON.parse(line.slice("PROGRESS:".length)));
            } catch {
              // Ignore malformed progress messages without hiding inference errors.
            }
          } else {
            stderr += `${line}\n`;
          }
        }
      });

      child.on("error", () => {
        spawnFailed = true;
        tryRun(index + 1);
      });

      child.on("close", (code) => {
        if (settled || spawnFailed) return;
        if (stderrRemainder && !stderrRemainder.startsWith("PROGRESS:")) {
          stderr += stderrRemainder;
        }
        if (code !== 0) {
          const detail = stderr.trim() || `Python exit code ${code}`;
          return reject(new Error(`Python 抽出処理が失敗しました: ${detail}`));
        }
        try {
          settle(() => resolve(JSON.parse(stdout)));
        } catch {
          settle(() => reject(new Error(stderr || "Python が不正なデータを返しました。")));
        }
      });

      try {
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch {
        settle(() =>
          reject(new Error(stderr || "Python プロセスとの通信に失敗しました。"))
        );
        child.kill("SIGKILL");
      }
    };

    tryRun(0);
  });
}

function getModelStatus() {
  if (!modelStatusPromise) {
    modelStatusPromise = runPythonInference({
      action: "health",
      modelDir,
      requireModel: true
    }).then((result) => ({
      available: result.available === true && result.mode === "bert",
      mode: result.mode,
      error: null
    })).catch((error) => ({
      available: false,
      mode: "unavailable",
      error: publicModelError(error)
    }));
  }
  return modelStatusPromise;
}

function publicModelError(error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`BERT health check failed: ${detail}`);
  if (detail.includes("BERT model not found")) {
    return "BERT model not found. Expected config.json, tokenizer files, and model weights in BERT_MODEL_DIR.";
  }
  return "BERT model files or Python dependencies could not be loaded. Check the server log.";
}

app.use((error, _req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  const notFound = error?.code === "ENOENT";
  res.status(notFound ? 404 : 500).json({
    error: notFound ? "文書が見つかりません。" : "サーバー処理中にエラーが発生しました。"
  });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`JR term extraction API listening on http://localhost:${port}`);
});
