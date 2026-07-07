import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Paper,
  Slider,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import TrainRoundedIcon from "@mui/icons-material/TrainRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import DatasetRoundedIcon from "@mui/icons-material/DatasetRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

const TRANSLATIONS = {
  en: {
    brandSubtitle: "Japanese railway document extraction",
    modelConnected: "BERT model connected",
    rulePreview: "Rule-based preview",
    language: "Interface language",
    inputDocuments: "Input documents",
    inputHelp: "Add files in multiple batches. Supports TXT, PDF and DOCX; scanned PDFs require OCR first.",
    selectedDocuments: "{count} documents selected",
    chooseDocuments: "Choose or drop documents",
    totalSize: "{size} MB total",
    fileLimit: "Up to 20 files, 30 MB each",
    removeFile: "Remove file",
    confidenceThreshold: "Confidence threshold",
    extract: "Extract",
    reset: "Reset",
    terms: "Terms",
    sentencesRead: "Sentences read",
    documents: "Documents",
    extractionResults: "Extraction results",
    resultMeta: "{count} documents · {characters} characters · {elapsed} ms",
    resultPlaceholder: "Results will appear after the documents are processed.",
    noTerms: "No terms to display",
    emptyHint: "Select one or more documents, then run extraction.",
    term: "Term",
    confidence: "Confidence",
    frequency: "Frequency",
    pages: "Pages",
    file: "Document",
    example: "Example in document",
    railwayHint: "railway context suggestion",
    needsReview: "needs review",
    extractedResult: "extracted result",
    morePages: "+{count} pages",
    verifyTerm: "Verify term",
    pageLabel: "pages",
    noMatchingPdf: "The matching PDF is not in the selected files. Keep the PDF in the batch to verify it by page.",
    openingPdf: "Opening PDF...",
    evidenceSentence: "Extracted sentence for verification",
    close: "Close",
    selectFileError: "Select at least one document before running extraction.",
    apiError: "Could not connect to the extraction service."
  },
  ja: {
    brandSubtitle: "日本語鉄道文書の専門用語抽出",
    modelConnected: "BERTモデル接続済み",
    rulePreview: "ルールベース・プレビュー",
    language: "表示言語",
    inputDocuments: "入力文書",
    inputHelp: "ファイルは複数回追加できます。TXT、PDF、DOCXに対応しています。スキャンPDFは事前にOCR処理が必要です。",
    selectedDocuments: "{count}件の文書を選択",
    chooseDocuments: "文書を選択またはドラッグ＆ドロップ",
    totalSize: "合計 {size} MB",
    fileLimit: "最大20ファイル、各30 MB",
    removeFile: "ファイルを削除",
    confidenceThreshold: "信頼度しきい値",
    extract: "抽出",
    reset: "リセット",
    terms: "用語",
    sentencesRead: "読み取り文",
    documents: "文書",
    extractionResults: "抽出結果",
    resultMeta: "{count}件 · {characters}文字 · {elapsed} ms",
    resultPlaceholder: "文書の処理後に結果が表示されます。",
    noTerms: "表示する用語がありません",
    emptyHint: "文書を選択して抽出を実行してください。",
    term: "用語",
    confidence: "信頼度",
    frequency: "出現回数",
    pages: "ページ",
    file: "文書",
    example: "文書内の例",
    railwayHint: "鉄道文脈による候補",
    needsReview: "要確認",
    extractedResult: "抽出結果",
    morePages: "他{count}ページ",
    verifyTerm: "用語の確認",
    pageLabel: "ページ",
    noMatchingPdf: "選択したファイルに該当するPDFがありません。ページ単位で確認するには、PDFを選択したままにしてください。",
    openingPdf: "PDFを開いています...",
    evidenceSentence: "確認用の抽出文",
    close: "閉じる",
    selectFileError: "抽出を実行する前に文書を1件以上選択してください。",
    apiError: "抽出サービスに接続できませんでした。"
  },
  vi: {
    brandSubtitle: "Trích xuất thuật ngữ từ tài liệu đường sắt Nhật Bản",
    modelConnected: "Đã kết nối mô hình BERT",
    rulePreview: "Chế độ xem trước theo luật",
    language: "Ngôn ngữ giao diện",
    inputDocuments: "Tài liệu đầu vào",
    inputHelp: "Có thể thêm file nhiều lần. Hỗ trợ TXT, PDF, DOCX; PDF scan cần OCR trước.",
    selectedDocuments: "Đã chọn {count} tài liệu",
    chooseDocuments: "Chọn hoặc kéo thả tài liệu",
    totalSize: "Tổng dung lượng {size} MB",
    fileLimit: "Tối đa 20 file, mỗi file 30 MB",
    removeFile: "Xóa file",
    confidenceThreshold: "Ngưỡng confidence",
    extract: "Trích xuất",
    reset: "Làm mới",
    terms: "Thuật ngữ",
    sentencesRead: "Câu đã đọc",
    documents: "Tài liệu",
    extractionResults: "Kết quả trích xuất",
    resultMeta: "{count} tài liệu · {characters} ký tự · {elapsed} ms",
    resultPlaceholder: "Kết quả sẽ xuất hiện sau khi xử lý tài liệu.",
    noTerms: "Chưa có thuật ngữ để hiển thị",
    emptyHint: "Chọn một hoặc nhiều tài liệu rồi chạy trích xuất.",
    term: "Thuật ngữ",
    confidence: "Confidence",
    frequency: "Tần suất",
    pages: "Trang",
    file: "Tài liệu",
    example: "Ví dụ trong tài liệu",
    railwayHint: "gợi ý theo ngữ cảnh đường sắt",
    needsReview: "cần rà soát",
    extractedResult: "kết quả trích xuất",
    morePages: "+{count} trang",
    verifyTerm: "Xác minh thuật ngữ",
    pageLabel: "trang",
    noMatchingPdf: "Không tìm thấy file PDF tương ứng trong danh sách đã chọn. Hãy giữ file PDF trong batch để xem trực tiếp theo trang.",
    openingPdf: "Đang mở PDF...",
    evidenceSentence: "Câu trích để đối chiếu",
    close: "Đóng",
    selectFileError: "Hãy chọn ít nhất một tài liệu trước khi chạy trích xuất.",
    apiError: "Không thể kết nối dịch vụ trích xuất."
  }
};

function translate(language, key, variables = {}) {
  const template = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  return Object.entries(variables).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}

export default function App() {
  const fileInputRef = useRef(null);
  const [health, setHealth] = useState(null);
  const [files, setFiles] = useState([]);
  const [threshold, setThreshold] = useState(0.85);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem("jr-ui-language");
    return ["en", "ja", "vi"].includes(savedLanguage) ? savedLanguage : "en";
  });
  const t = (key, variables) => translate(language, key, variables);

  useEffect(() => {
    axios.get(`${API_BASE}/api/health`).then((response) => {
      setHealth(response.data);
    }).catch(() => {
      setHealth({ ok: false, modelAvailable: false });
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("jr-ui-language", language);
    document.documentElement.lang = language;
  }, [language]);

  const terms = (result?.terms ?? []).filter(
    (term) => Number(term.score) >= Number(result?.threshold ?? 0)
  );
  const selectedSize = files.reduce((sum, file) => sum + file.size, 0);

  const selectedPdfFile = useMemo(() => {
    if (!selectedTerm) return null;
    const termFiles = selectedTerm.files ?? [];
    const pdfFiles = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    return pdfFiles.find((file) => termFiles.some((name) => sameFileName(file.name, name)))
      ?? (pdfFiles.length === 1 ? pdfFiles[0] : null)
      ?? null;
  }, [files, selectedTerm]);

  const appendFiles = (incomingFiles) => {
    setFiles((current) => {
      const next = [...current];
      for (const file of incomingFiles) {
        const exists = next.some((item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified
        );
        if (!exists) next.push(file);
      }
      return next;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (targetFile) => {
    setFiles((current) => current.filter((file) => file !== targetFile));
    if (selectedTerm?.files?.includes(targetFile.name)) {
      setSelectedTerm(null);
    }
  };

  const submit = async () => {
    if (!files.length) {
      setError(t("selectFileError"));
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("documents", file));
    formData.append("threshold", threshold);

    setLoading(true);
    setResult(null);
    setSelectedTerm(null);

    try {
      const response = await axios.post(`${API_BASE}/api/extract`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setResult(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail ?? t("apiError"));
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!terms.length) return;
    const rows = [
      [t("term"), t("confidence"), t("frequency"), t("pages"), t("file"), "Group", "Source", t("example")],
      ...terms.map((term) => [
        term.term,
        term.score,
        term.frequency,
        formatPages(term),
        term.files?.join("; ") ?? "",
        formatGroupLabel(term.group, t),
        term.source,
        term.examples?.[0] ?? term.sentence ?? ""
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "jr_terms.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setSelectedTerm(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Box className="appShell">
      <AppBar position="static" elevation={0} className="topBar">
        <Toolbar className="toolbar">
          <Stack direction="row" spacing={1.5} alignItems="center" className="brand">
            <Box className="brandMark">
              <TrainRoundedIcon fontSize="small" />
            </Box>
            <Box className="brandText">
              <Typography variant="h6" className="brandTitle">JR Term Review</Typography>
              <Typography variant="caption" className="brandSub">{t("brandSubtitle")}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center" className="topActions">
            <ToggleButtonGroup
              value={language}
              exclusive
              size="small"
              onChange={(_, value) => value && setLanguage(value)}
              aria-label={t("language")}
              className="languageSwitch"
            >
              <ToggleButton value="ja" aria-label="日本語">日本語</ToggleButton>
              <ToggleButton value="en" aria-label="English">EN</ToggleButton>
              <ToggleButton value="vi" aria-label="Tiếng Việt">VI</ToggleButton>
            </ToggleButtonGroup>
            <Chip
              label={health?.modelAvailable ? t("modelConnected") : t("rulePreview")}
              color={health?.modelAvailable ? "success" : "default"}
              variant="outlined"
              size="small"
              className="statusChip"
            />
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" className="main">
        <Box className="workGrid">
          <Paper className="controlPanel" elevation={0}>
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography variant="h6">{t("inputDocuments")}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("inputHelp")}
                </Typography>
              </Stack>

              <Box
                className={`dropZone ${files.length ? "hasFile" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  appendFiles(Array.from(event.dataTransfer.files ?? []));
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  multiple
                  accept=".txt,.pdf,.docx,.csv,.md"
                  onChange={(event) => appendFiles(Array.from(event.target.files ?? []))}
                />
                <UploadFileRoundedIcon />
                <Typography variant="subtitle1">
                  {files.length ? t("selectedDocuments", { count: files.length }) : t("chooseDocuments")}
                </Typography>
                <Typography variant="caption">
                  {files.length
                    ? t("totalSize", { size: (selectedSize / 1024 / 1024).toFixed(2) })
                    : t("fileLimit")}
                </Typography>
              </Box>

              {files.length > 0 && (
                <Stack spacing={1} className="fileList">
                  {files.map((file) => (
                    <Stack key={`${file.name}-${file.size}-${file.lastModified}`} direction="row" spacing={1} alignItems="center" className="fileItem">
                      <InsertDriveFileRoundedIcon fontSize="small" />
                      <Typography variant="body2" noWrap title={file.name}>{file.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</Typography>
                      <Tooltip title={t("removeFile")}>
                        <IconButton size="small" aria-label={t("removeFile")} onClick={() => removeFile(file)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              )}

              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2">{t("confidenceThreshold")}</Typography>
                  <Chip label={threshold.toFixed(2)} size="small" />
                </Stack>
                <Slider
                  value={threshold}
                  min={0.5}
                  max={0.98}
                  step={0.01}
                  onChange={(_, value) => setThreshold(value)}
                  marks={[
                    { value: 0.5, label: "0.50" },
                    { value: 0.9, label: "0.90" },
                    { value: 0.98, label: "0.98" }
                  ]}
                />
              </Box>

              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchRoundedIcon />}
                  onClick={submit}
                  disabled={loading}
                  fullWidth
                >
                  {t("extract")}
                </Button>
                <Tooltip title={t("reset")}>
                  <span>
                    <IconButton aria-label={t("reset")} onClick={reset}>
                      <RestartAltRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>

          <Stack spacing={2.5}>
            <Box className="statsGrid">
              <StatCard icon={<DatasetRoundedIcon />} label={t("terms")} value={result?.termCount ?? 0} />
              <StatCard icon={<FactCheckRoundedIcon />} label={t("sentencesRead")} value={result?.sentenceCount ?? 0} />
              <StatCard icon={<InsertDriveFileRoundedIcon />} label={t("documents")} value={result?.fileCount ?? files.length} />
            </Box>

            <Paper className="resultPanel" elevation={0}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" className="resultHeader">
                <Box>
                  <Typography variant="h6">{t("extractionResults")}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {result
                      ? t("resultMeta", {
                        count: result.fileCount,
                        characters: result.characterCount.toLocaleString(language === "ja" ? "ja-JP" : language === "vi" ? "vi-VN" : "en-US"),
                        elapsed: result.elapsedMs
                      })
                      : t("resultPlaceholder")}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<DownloadRoundedIcon />}
                  onClick={exportCsv}
                  disabled={!terms.length}
                >
                  CSV
                </Button>
              </Stack>
              <Divider />

              {loading && <LinearProgress />}

              {!terms.length && !loading ? (
                <Box className="emptyState">
                  <TrainRoundedIcon />
                  <Typography variant="subtitle1">{t("noTerms")}</Typography>
                  <Typography variant="body2">{t("emptyHint")}</Typography>
                </Box>
              ) : (
                <TableContainer className="tableWrap">
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("term")}</TableCell>
                        <TableCell>{t("confidence")}</TableCell>
                        <TableCell>{t("frequency")}</TableCell>
                        <TableCell>{t("pages")}</TableCell>
                        <TableCell>{t("file")}</TableCell>
                        <TableCell>{t("example")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {terms.map((term) => (
                        <TableRow hover className="clickableRow" key={`${term.id}-${term.term}`} onClick={() => setSelectedTerm(term)}>
                          <TableCell>
                            <Typography className="jpTerm">{term.term}</Typography>
                            <Chip size="small" label={formatGroupLabel(term.group, t)} className="termChip" />
                          </TableCell>
                          <TableCell className="scoreCell">
                            <Stack spacing={0.6}>
                              <Typography variant="body2" fontWeight={700}>{Math.round(term.score * 100)}%</Typography>
                              <LinearProgress variant="determinate" value={Math.round(term.score * 100)} />
                            </Stack>
                          </TableCell>
                          <TableCell>{term.frequency}</TableCell>
                          <TableCell className="pageCell">
                            <Tooltip title={formatPages(term)} placement="top" arrow>
                              <Typography component="span" variant="body2">
                                {formatPageSummary(term, t)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" className="fileCell">
                              {term.files?.join(", ") ?? "-"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" className="exampleText">
                              {term.examples?.[0] ?? term.sentence}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Stack>
        </Box>
      </Container>

      <VerificationDrawer
        term={selectedTerm}
        pdfFile={selectedPdfFile}
        t={t}
        onClose={() => setSelectedTerm(null)}
      />

      <Snackbar open={Boolean(error)} autoHideDuration={6000} onClose={() => setError("")}>
        <Alert severity="error" variant="filled" onClose={() => setError("")}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}

function VerificationDrawer({ term, pdfFile, t, onClose }) {
  const [pdfUrl, setPdfUrl] = useState("");
  const page = term?.page ?? term?.pages?.[0] ?? 1;

  useEffect(() => {
    if (!pdfFile || !term) {
      setPdfUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(pdfFile);
    const safePage = Math.max(Number(page) || 1, 1);
    const search = encodeURIComponent(term.term ?? "");
    setPdfUrl(`${objectUrl}#page=${safePage}&zoom=page-width&search=${search}`);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [term, pdfFile, page]);

  return (
    <Drawer anchor="right" open={Boolean(term)} onClose={onClose} PaperProps={{ className: "verifyDrawer" }}>
      <Stack className="drawerHeader" direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="overline">{t("verifyTerm")}</Typography>
          <Typography variant="h5" className="jpTerm">{term?.term}</Typography>
          <Typography variant="body2" color="text.secondary">
            {term ? `${term.files?.[0] ?? "-"} · ${t("pageLabel")} ${formatPages(term)}` : ""}
          </Typography>
        </Box>
        <IconButton aria-label={t("close")} onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </Stack>
      <Divider />

      {term && (
        <Stack spacing={2} className="drawerBody">
          {!pdfFile ? (
            <Alert severity="info">
              {t("noMatchingPdf")}
            </Alert>
          ) : (
            <Box className="pdfStage">
              {pdfUrl ? (
                <iframe
                  className="pdfFrame"
                  title={`PDF verification for ${term.term}`}
                  src={pdfUrl}
                />
              ) : (
                <Alert severity="info" className="pdfStatus">{t("openingPdf")}</Alert>
              )}
            </Box>
          )}

          <Box className="sentenceBox compactEvidence">
            <Typography variant="subtitle2">{t("evidenceSentence")}</Typography>
            <Typography className="sentenceText">
              <HighlightedSentence text={term.examples?.[0] ?? term.sentence ?? ""} term={term.term} />
            </Typography>
          </Box>
        </Stack>
      )}
    </Drawer>
  );
}

function sameFileName(a, b) {
  const left = normalizeFileName(a);
  const right = normalizeFileName(b);
  return left === right || left.includes(right) || right.includes(left);
}

function normalizeFileName(name) {
  return String(name ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function HighlightedSentence({ text, term }) {
  const cleanText = text ?? "";
  if (!term || !cleanText.includes(term)) return cleanText;
  const pieces = cleanText.split(term);
  return pieces.map((piece, index) => (
    <span key={`${piece}-${index}`}>
      {piece}
      {index < pieces.length - 1 && <mark>{term}</mark>}
    </span>
  ));
}

function StatCard({ icon, label, value }) {
  return (
    <Paper className="statCard" elevation={0}>
      <Box className="statIcon">{icon}</Box>
      <Box>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h5">{value}</Typography>
      </Box>
    </Paper>
  );
}

function formatGroupLabel(group, t) {
  if (group === "railway_dictionary_hint") return t("railwayHint");
  if (group === "new_potential_term") return t("needsReview");
  return t("extractedResult");
}

function formatPages(term) {
  const pages = term?.pages ?? [term?.page].filter(Boolean);
  return pages.length ? pages.join(", ") : "-";
}

function formatPageSummary(term, t, visibleCount = 4) {
  const pages = term?.pages ?? [term?.page].filter(Boolean);
  if (!pages.length) return "-";

  const visiblePages = pages.slice(0, visibleCount).join(", ");
  const remaining = pages.length - visibleCount;
  return remaining > 0 ? `${visiblePages} ${t("morePages", { count: remaining })}` : visiblePages;
}
