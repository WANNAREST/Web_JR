import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import multer from "multer";
import pdf from "pdf-parse";
import mammoth from "mammoth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const uploadDir = path.join(rootDir, "uploads");
const pythonScript = path.join(rootDir, "python", "extract_terms.py");
const modelDir = path.join(rootDir, "models", "bert_term_classifier", "final_model");

await fs.mkdir(uploadDir, { recursive: true });

const app = express();
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 20
  }
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    modelAvailable: await exists(path.join(modelDir, "config.json")),
    modelDir
  });
});

app.post("/api/extract", upload.array("documents", 20), async (req, res) => {
  const files = req.files ?? [];
  if (!files.length) {
    return res.status(400).json({ error: "Vui lòng tải lên ít nhất một tài liệu." });
  }

  const requestedThreshold = Number(req.body.threshold ?? 0.9);
  const threshold = Number.isFinite(requestedThreshold)
    ? Math.min(0.98, Math.max(0.5, requestedThreshold))
    : 0.9;
  const startedAt = Date.now();
  const processed = [];

  try {
    for (const file of files) {
      const originalName = decodeOriginalName(file.originalname);
      const ext = path.extname(originalName).toLowerCase();
      const text = await extractText(file.path, ext);

      if (!text.trim()) {
        processed.push({
          fileName: originalName,
          error: "Không đọc được nội dung văn bản."
        });
        continue;
      }

      const result = await runPythonInference({
        text,
        threshold,
        fileName: originalName,
        modelDir
      });

      processed.push({
        ...result,
        fileName: originalName,
        characterCount: text.length
      });
    }

    const successful = processed.filter((item) => !item.error);
    if (!successful.length) {
      return res.status(422).json({
        error: "Không đọc được nội dung văn bản từ các tài liệu đã tải lên.",
        files: processed
      });
    }

    res.json({
      ...aggregateResults(successful, threshold),
      files: processed,
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    res.status(500).json({
      error: "Không thể trích xuất thuật ngữ.",
      detail: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await Promise.all(files.map((file) => fs.rm(file.path, { force: true })));
  }
});

function decodeOriginalName(name) {
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("�") ? name : decoded;
}

function aggregateResults(results, threshold) {
  const byTerm = new Map();

  for (const result of results) {
    for (const term of result.terms ?? []) {
      if (Number(term.score) < threshold) {
        continue;
      }

      const existing = byTerm.get(term.term);
      const examples = term.examples ?? [term.sentence].filter(Boolean);

      if (!existing) {
        byTerm.set(term.term, {
          ...term,
          frequency: Number(term.frequency ?? 1),
          files: [result.fileName],
          pagesByFile: {
            [result.fileName]: [...new Set(term.pages ?? [term.page].filter(Boolean))]
          },
          examples: examples.map((example) => `${result.fileName}: ${example}`)
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

  throw new Error(`Định dạng ${ext} chưa được hỗ trợ. Hãy dùng TXT, PDF hoặc DOCX.`);
}

function runPythonInference(payload) {
  return new Promise((resolve, reject) => {
    const candidates = [
      process.env.PYTHON,
      "python",
      "py"
    ].filter(Boolean);

    let settled = false;

    const tryRun = (index) => {
      if (index >= candidates.length) {
        reject(new Error("Không tìm thấy Python runtime để chạy inference."));
        return;
      }

      const child = spawn(candidates[index], [pythonScript], {
        cwd: rootDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8"
        },
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", () => {
        tryRun(index + 1);
      });

      child.on("close", (code) => {
        if (settled) return;
        if (code !== 0) {
          tryRun(index + 1);
          return;
        }

        try {
          settled = true;
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error(stderr || "Python trả về dữ liệu không hợp lệ."));
        }
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    };

    tryRun(0);
  });
}

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`JR term extraction API listening on http://localhost:${port}`);
});
