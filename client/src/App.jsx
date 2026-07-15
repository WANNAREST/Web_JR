import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TrainRoundedIcon from "@mui/icons-material/TrainRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DoNotDisturbAltRoundedIcon from "@mui/icons-material/DoNotDisturbAltRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
const SUPPORTED_LANGUAGES = ["ja", "en"];
const THRESHOLD_PRESETS = [
  { key: "broad", value: 0.65 },
  { key: "standard", value: 0.85, recommended: true },
  { key: "strict", value: 0.92 }
];

const TRANSLATIONS = {
  ja: {
    productName: "鉄道用語レビュー",
    productSubtitle: "出典と照合しながら候補語を確認",
    modelReady: "モデル接続済み",
    trialMode: "試験運用",
    language: "表示言語",
    login: "ログイン",
    logout: "ログアウト",
    landingEyebrow: "SECURE DOCUMENT REVIEW",
    landingTitle: "鉄道文書の用語確認を、\n安全で確かな業務フローへ。",
    landingIntro: "日本語の鉄道文書から候補語を抽出し、原文のページと照合しながら確認できます。利用には発行済みアカウントが必要です。",
    landingCta: "アカウントでログイン",
    landingFeature1: "文書は保護された専用領域に保存",
    landingFeature2: "候補語と出典ページを同時確認",
    landingFeature3: "許可された担当者のみ利用可能",
    securityTitle: "お預かりする情報を守るために",
    securityBody: "ログインしていない状態では、文書のアップロードや抽出APIを利用できません。",
    accountIssued: "アカウントは管理担当者から発行されます。",
    loginTitle: "業務アカウントでログイン",
    loginIntro: "発行されたユーザーIDとパスワードを入力してください。",
    username: "ユーザーID",
    password: "パスワード",
    usernamePlaceholder: "ユーザーIDを入力",
    passwordPlaceholder: "パスワードを入力",
    signingIn: "確認しています…",
    backToLanding: "戻る",
    loginError: "ログインできませんでした。入力内容を確認してください。",
    sessionChecking: "ログイン状態を確認しています",
    signedInAs: "ログイン中",
    workflowDocument: "文書選択",
    workflowExtract: "抽出",
    workflowVerify: "確認",
    workflowExport: "出力",
    inputTitle: "対象文書を追加",
    inputIntro: "日本語の鉄道文書から、確認対象となる候補語を抽出します。",
    chooseDocuments: "ファイルを選択、またはここにドロップ",
    supportedFiles: "TXT・PDF・DOCX / 最大20ファイル・各30 MB",
    selectedDocuments: "{count}件の文書を選択中",
    totalSize: "合計 {size} MB",
    removeFile: "文書を削除",
    privacyNote: "文書は確認作業のため、アクセス制限された専用領域に保存されます。",
    extractionStandard: "抽出基準",
    broad: "広め",
    broadHelp: "候補を多めに抽出",
    standard: "標準",
    standardHelp: "通常の確認作業向け",
    recommended: "推奨",
    strict: "厳格",
    strictHelp: "高スコアのみ抽出",
    thresholdValue: "抽出スコア {value} 以上",
    runExtraction: "候補語を抽出",
    processing: "文書を解析しています",
processingDetail: "BERTモデルによる抽出処理中です。しばらくお待ちください。",
    reset: "選択を解除",
    setupTitle: "確認可能な形で抽出します",
    setupBody: "抽出結果だけでなく、文書名・ページ・該当文を保ったまま確認できます。",
    setupStep1Title: "文書を追加",
    setupStep1Body: "文字情報を含むPDF、DOCX、TXTに対応",
    setupStep2Title: "抽出基準を選択",
    setupStep2Body: "最初は「標準」を推奨",
    setupStep3Title: "出典と照合",
    setupStep3Body: "候補語を原文のページと並べて確認",
    resultCount: "候補語 {count}件",
    sentenceCount: "解析文 {count}件",
    documentCount: "対象文書 {count}件",
    elapsed: "処理時間 {value} ms",
    changeDocuments: "文書を変更",
    rerun: "再抽出",
    resultsTitle: "候補語",
    candidateSearch: "候補語を検索",
    searchPlaceholder: "用語・文書名で検索",
    candidateFilter: "候補種別",
    reviewStatusFilter: "確認状態",
    allCandidates: "すべて",
    railwayHints: "鉄道語候補",
    reviewCandidates: "新規候補",
    sortLabel: "並び順",
    sortScore: "抽出スコア順",
    sortFrequency: "出現回数順",
    sortSource: "出典順",
    noMatchingCandidates: "条件に一致する候補語がありません。",
    emptyResults: "現在の抽出基準では候補語が見つかりませんでした。",
    evidenceTitle: "出典・該当箇所",
    selectCandidate: "候補語を選択してください",
    selectCandidateHelp: "左の一覧から選ぶと、出典ページと該当文を確認できます。",
    sourceDocument: "文書",
    sourcePage: "ページ",
    sourceExcerpt: "該当箇所",
    evidenceSentence: "原文の該当文",
    pdfUnavailable: "選択中のファイルに対応するPDFがありません。",
    pdfOpening: "PDFを開いています…",
    extractionScore: "抽出スコア",
    frequency: "出現回数",
    candidateType: "候補種別",
    exportCsv: "CSV出力",
    close: "閉じる",
    pageShort: "{pages}頁",
    railwayHint: "鉄道語候補",
    needsReview: "新規候補",
    extractedResult: "抽出候補",
    workspaceNav: "抽出・確認",
    reviewedTermsNav: "確認済み用語",
    reviewDecision: "判定",
    reviewNote: "判定メモ（任意）",
    reviewNotePlaceholder: "判断根拠や確認事項を入力",
    approveTerm: "JR専門用語",
    rejectTerm: "対象外",
    holdTerm: "判断保留",
    resetReview: "未確認に戻す",
    unreviewedStatus: "未確認",
    approvedStatus: "JR専門用語",
    rejectedStatus: "対象外",
    uncertainStatus: "判断保留",
    savingReview: "保存中…",
    reviewedBy: "{name} が確認",
    reviewConflict: "別の担当者が更新しました。最新の内容を表示しています。",
    reviewedCatalogTitle: "確認済み用語",
    reviewedCatalogIntro: "人が判定した用語と、その出典・履歴を確認できます。",
    reviewedAll: "確認済みすべて",
    termSearch: "用語を検索",
    noReviewedTerms: "条件に一致する確認済み用語がありません。",
    sourceOccurrences: "出典一覧",
    reviewHistory: "判定履歴",
    noHistory: "判定履歴がありません。",
    openSource: "原文を開く",
    trainingExport: "学習データ出力",
    exportJsonl: "JSONL出力",
    previousPage: "前へ",
    nextPage: "次へ",
    pageStatus: "{from}–{to} / {total}件",
    loadingTerms: "用語を読み込んでいます…",
    databaseUnavailable: "データベースに接続できません。管理担当者に連絡してください。",
    selectFileError: "文書を1件以上選択してください。",
    fileLimitError: "一度に選択できる文書は20件までです。",
    apiError: "抽出サービスに接続できませんでした。"
  },
  en: {
    productName: "Railway Term Review",
    productSubtitle: "Review candidate terms against their source",
    modelReady: "Model connected",
    trialMode: "Trial operation",
    language: "Interface language",
    login: "Sign in",
    logout: "Sign out",
    landingEyebrow: "SECURE DOCUMENT REVIEW",
    landingTitle: "A secure, traceable workflow\nfor railway terminology review.",
    landingIntro: "Extract candidates from Japanese railway documents and verify each one against its original page. An issued account is required.",
    landingCta: "Sign in with your account",
    landingFeature1: "Documents stored in a protected private area",
    landingFeature2: "Candidates verified beside their source",
    landingFeature3: "Access limited to authorized reviewers",
    securityTitle: "Protecting the information you entrust to us",
    securityBody: "Document upload and extraction APIs are unavailable until a user is authenticated.",
    accountIssued: "Accounts are issued by your administrator.",
    loginTitle: "Sign in to your work account",
    loginIntro: "Enter the user ID and password provided to you.",
    username: "User ID",
    password: "Password",
    usernamePlaceholder: "Enter your user ID",
    passwordPlaceholder: "Enter your password",
    signingIn: "Signing in…",
    backToLanding: "Back",
    loginError: "Sign-in failed. Check your credentials.",
    sessionChecking: "Checking your session",
    signedInAs: "Signed in",
    workflowDocument: "Documents",
    workflowExtract: "Extract",
    workflowVerify: "Verify",
    workflowExport: "Export",
    inputTitle: "Add source documents",
    inputIntro: "Extract review candidates from Japanese railway documents.",
    chooseDocuments: "Choose files or drop them here",
    supportedFiles: "TXT, PDF, DOCX / up to 20 files, 30 MB each",
    selectedDocuments: "{count} documents selected",
    totalSize: "{size} MB total",
    removeFile: "Remove document",
    privacyNote: "Documents are retained in access-controlled storage for source review.",
    extractionStandard: "Extraction range",
    broad: "Broad",
    broadHelp: "Return more candidates",
    standard: "Standard",
    standardHelp: "Recommended for review",
    recommended: "Recommended",
    strict: "Strict",
    strictHelp: "High-score candidates only",
    thresholdValue: "Extraction score {value} or higher",
    runExtraction: "Extract candidates",
    processing: "Analyzing documents",
    reset: "Clear selection",
    setupTitle: "Extraction with source traceability",
    setupBody: "Keep the document, page and source sentence attached to every candidate.",
    setupStep1Title: "Add documents",
    setupStep1Body: "PDF, DOCX and TXT with readable text",
    setupStep2Title: "Choose a range",
    setupStep2Body: "Standard is recommended initially",
    setupStep3Title: "Check the source",
    setupStep3Body: "Review candidates beside the original page",
    resultCount: "{count} candidates",
    sentenceCount: "{count} sentences",
    documentCount: "{count} documents",
    elapsed: "{value} ms",
    changeDocuments: "Change documents",
    rerun: "Run again",
    resultsTitle: "Candidates",
    candidateSearch: "Search candidates",
    searchPlaceholder: "Search term or document",
    candidateFilter: "Candidate type",
    reviewStatusFilter: "Review status",
    allCandidates: "All",
    railwayHints: "Railway candidates",
    reviewCandidates: "New candidates",
    sortLabel: "Sort order",
    sortScore: "Extraction score",
    sortFrequency: "Frequency",
    sortSource: "Source order",
    noMatchingCandidates: "No candidates match these filters.",
    emptyResults: "No candidates matched the current extraction range.",
    evidenceTitle: "Source evidence",
    selectCandidate: "Select a candidate",
    selectCandidateHelp: "Choose a candidate on the left to inspect its page and source sentence.",
    sourceDocument: "Document",
    sourcePage: "Page",
    sourceExcerpt: "Excerpt",
    evidenceSentence: "Sentence from source",
    pdfUnavailable: "A matching PDF is not available in the selected files.",
    pdfOpening: "Opening PDF…",
    extractionScore: "Extraction score",
    frequency: "Frequency",
    candidateType: "Candidate type",
    exportCsv: "Export CSV",
    close: "Close",
    pageShort: "p. {pages}",
    railwayHint: "Railway candidate",
    needsReview: "New candidate",
    extractedResult: "Extracted candidate",
    workspaceNav: "Extract & review",
    reviewedTermsNav: "Reviewed terms",
    reviewDecision: "Decision",
    reviewNote: "Review note (optional)",
    reviewNotePlaceholder: "Add the reason or a follow-up note",
    approveTerm: "JR specialist term",
    rejectTerm: "Not a JR term",
    holdTerm: "Needs discussion",
    resetReview: "Reset to unreviewed",
    unreviewedStatus: "Unreviewed",
    approvedStatus: "JR specialist term",
    rejectedStatus: "Not a JR term",
    uncertainStatus: "Needs discussion",
    savingReview: "Saving…",
    reviewedBy: "Reviewed by {name}",
    reviewConflict: "Another reviewer updated this term. The latest decision is now shown.",
    reviewedCatalogTitle: "Reviewed terminology",
    reviewedCatalogIntro: "Inspect human decisions together with their source evidence and history.",
    reviewedAll: "All reviewed",
    termSearch: "Search terms",
    noReviewedTerms: "No reviewed terms match these filters.",
    sourceOccurrences: "Source occurrences",
    reviewHistory: "Decision history",
    noHistory: "No review history is available.",
    openSource: "Open source",
    trainingExport: "Training data",
    exportJsonl: "Export JSONL",
    previousPage: "Previous",
    nextPage: "Next",
    pageStatus: "{from}–{to} of {total}",
    loadingTerms: "Loading terminology…",
    databaseUnavailable: "The database is unavailable. Contact your administrator.",
    selectFileError: "Select at least one document.",
    fileLimitError: "You can select up to 20 documents at a time.",
    apiError: "Could not connect to the extraction service."
  }
};

function translate(language, key, variables = {}) {
  const template = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.ja[key] ?? key;
  return Object.entries(variables).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}

export default function App() {
  const fileInputRef = useRef(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [user, setUser] = useState(null);
  const [health, setHealth] = useState(null);
  const [files, setFiles] = useState([]);
  const [threshold, setThreshold] = useState(0.85);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score");
  const [activeView, setActiveView] = useState("workspace");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem("jr-ui-language");
    return SUPPORTED_LANGUAGES.includes(savedLanguage) ? savedLanguage : "ja";
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
    axios.get(`${API_BASE}/api/auth/session`, { withCredentials: true })
      .then((response) => setUser(response.data.user))
      .catch(() => setUser(null))
      .finally(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    localStorage.setItem("jr-ui-language", language);
    document.documentElement.lang = language;
    document.title = translate(language, "productName");
  }, [language]);

  useEffect(() => {
    if (sessionReady) window.scrollTo(0, 0);
  }, [sessionReady, user]);

  const terms = useMemo(() => (result?.terms ?? []).filter(
    (term) => Number(term.score) >= Number(result?.threshold ?? 0)
  ), [result]);

  const visibleTerms = useMemo(() => {
    const normalizedSearch = search.normalize("NFKC").trim().toLowerCase();
    const filtered = terms.filter((term) => {
      const matchesGroup = groupFilter === "all" || term.group === groupFilter;
      const matchesReview = reviewStatusFilter === "all" || term.reviewStatus === reviewStatusFilter;
      const searchTarget = [term.term, ...(term.files ?? [])].join(" ").normalize("NFKC").toLowerCase();
      return matchesGroup && matchesReview && (!normalizedSearch || searchTarget.includes(normalizedSearch));
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "frequency") return b.frequency - a.frequency || b.score - a.score;
      if (sortBy === "source") return sourceSortKey(a).localeCompare(sourceSortKey(b), "ja");
      return b.score - a.score || b.frequency - a.frequency || a.term.localeCompare(b.term, "ja");
    });
  }, [groupFilter, reviewStatusFilter, search, sortBy, terms]);

  const selectedPdfFile = useMemo(() => {
    if (!selectedTerm) return null;
    const termFiles = selectedTerm.files ?? [];
    const pdfFiles = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    return pdfFiles.find((file) => termFiles.some((name) => sameFileName(file.name, name)))
      ?? (pdfFiles.length === 1 ? pdfFiles[0] : null)
      ?? null;
  }, [files, selectedTerm]);

  const appendFiles = (incomingFiles) => {
    if (files.length + incomingFiles.length > 20) setError(t("fileLimitError"));
    setFiles((current) => {
      const next = [...current];
      for (const file of incomingFiles) {
        const exists = next.some((item) =>
          item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
        );
        if (!exists && next.length < 20) next.push(file);
      }
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (targetFile) => {
    setFiles((current) => current.filter((file) => file !== targetFile));
    if (selectedTerm?.files?.some((name) => sameFileName(name, targetFile.name))) setSelectedTerm(null);
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
    setError("");
    setSelectedTerm(null);

    try {
      const response = await axios.post(`${API_BASE}/api/extract`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true
      });
      setResult(response.data);
      const firstTerm = (response.data.terms ?? []).find(
        (term) => Number(term.score) >= Number(response.data.threshold ?? 0)
      );
      setSelectedTerm(firstTerm ?? null);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setUser(null);
        setResult(null);
      }
      setError(requestError.response?.data?.detail ?? requestError.response?.data?.error ?? t("apiError"));
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!terms.length) return;
    const rows = [
      [t("resultsTitle"), t("extractionScore"), t("frequency"), t("sourcePage"), t("sourceDocument"), "Group", "Source", t("evidenceSentence")],
      ...terms.map((term) => [
        term.term,
        term.score,
        term.frequency,
        formatPages(term),
        term.files?.join("; ") ?? "",
        formatGroupLabel(term.group, t),
        term.source,
        getEvidenceText(term)
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "railway_term_candidates.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setSelectedTerm(null);
    setSearch("");
    setGroupFilter("all");
    setReviewStatusFilter("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const workflowStep = result ? 3 : files.length ? 2 : 1;

  const login = async (username, password) => {
    const response = await axios.post(`${API_BASE}/api/auth/login`, { username, password }, { withCredentials: true });
    setUser(response.data.user);
  };

  const logout = async () => {
    try {
      await axios.post(`${API_BASE}/api/auth/logout`, {}, { withCredentials: true });
    } finally {
      reset();
      setActiveView("workspace");
      setUser(null);
    }
  };

  const reviewTerm = async (status, note) => {
    if (!selectedTerm?.id) return;
    setReviewSaving(true);
    setError("");
    try {
      const response = await axios.patch(
        `${API_BASE}/api/terms/${selectedTerm.id}/review`,
        { status, note, version: selectedTerm.reviewVersion ?? 0 },
        { withCredentials: true }
      );
      const updatedTerm = { ...selectedTerm, ...response.data };
      setResult((current) => ({
        ...current,
        terms: current.terms.map((term) => term.id === updatedTerm.id ? { ...term, ...response.data } : term)
      }));
      const nextUnreviewed = selectedTerm.reviewStatus === "unreviewed" && status !== "unreviewed"
        ? terms.find((term) => term.id !== selectedTerm.id && term.reviewStatus === "unreviewed")
        : null;
      setSelectedTerm(nextUnreviewed ?? updatedTerm);
    } catch (requestError) {
      if (requestError.response?.status === 409 && requestError.response.data?.current) {
        const current = requestError.response.data.current;
        setResult((resultState) => ({
          ...resultState,
          terms: resultState.terms.map((term) => term.id === current.id ? { ...term, ...current } : term)
        }));
        setSelectedTerm((term) => term?.id === current.id ? { ...term, ...current } : term);
        setError(t("reviewConflict"));
      } else {
        setError(requestError.response?.data?.error ?? t("apiError"));
      }
    } finally {
      setReviewSaving(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="sessionLoading" role="status">
        <span className="brandMark" aria-hidden="true"><TrainRoundedIcon /></span>
        <p>{t("sessionChecking")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage
        language={language}
        setLanguage={setLanguage}
        onLogin={login}
        t={t}
      />
    );
  }

  return (
    <div className="appShell">
      <Header
        language={language}
        setLanguage={setLanguage}
        health={health}
        workflowStep={workflowStep}
        user={user}
        onLogout={logout}
        activeView={activeView}
        onViewChange={setActiveView}
        t={t}
      />

      <main className="mainContent">
        {activeView === "catalog" ? (
          <ReviewedTermsView t={t} setError={setError} onUnauthorized={() => { reset(); setUser(null); }} />
        ) : !result ? (
          <SetupView
            files={files}
            fileInputRef={fileInputRef}
            threshold={threshold}
            setThreshold={setThreshold}
            appendFiles={appendFiles}
            removeFile={removeFile}
            dragActive={dragActive}
            setDragActive={setDragActive}
            submit={submit}
            reset={reset}
            loading={loading}
            t={t}
          />
        ) : (
          <ReviewWorkspace
            result={result}
            terms={terms}
            visibleTerms={visibleTerms}
            selectedTerm={selectedTerm}
            setSelectedTerm={setSelectedTerm}
            selectedPdfFile={selectedPdfFile}
            threshold={threshold}
            setThreshold={setThreshold}
            search={search}
            setSearch={setSearch}
            groupFilter={groupFilter}
            setGroupFilter={setGroupFilter}
            reviewStatusFilter={reviewStatusFilter}
            setReviewStatusFilter={setReviewStatusFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            submit={submit}
            reset={reset}
            exportCsv={exportCsv}
            loading={loading}
            reviewSaving={reviewSaving}
            onReview={reviewTerm}
            t={t}
          />
        )}
      </main>

      {error && (
        <div className="errorToast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label={t("close")}>
            <CloseRoundedIcon fontSize="small" />
          </button>
        </div>
      )}
    </div>
  );
}

function LandingPage({ language, setLanguage, onLogin, t }) {
  const usernameRef = useRef(null);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (showLogin) usernameRef.current?.focus();
  }, [showLogin]);

  const openLogin = () => {
    setLoginError("");
    setShowLogin(true);
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");
    try {
      await onLogin(username, password);
    } catch (requestError) {
      setLoginError(requestError.response?.status === 401
        ? t("loginError")
        : requestError.response?.data?.error ?? t("loginError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landingPage">
      <header className="landingHeader">
        <div className="brandBlock">
          <span className="brandMark" aria-hidden="true"><TrainRoundedIcon /></span>
          <div>
            <strong>{t("productName")}</strong>
            <p>{t("productSubtitle")}</p>
          </div>
        </div>
        <div className="landingNav">
          <div className="languageControl light" role="group" aria-label={t("language")}>
            {SUPPORTED_LANGUAGES.map((value) => (
              <button
                type="button"
                key={value}
                className={language === value ? "active" : ""}
                aria-pressed={language === value}
                onClick={() => setLanguage(value)}
              >
                {value === "ja" ? "日本語" : value.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="headerLoginButton" type="button" onClick={openLogin}>
            <LockRoundedIcon fontSize="small" />{t("login")}
          </button>
        </div>
      </header>

      <main className={`landingMain ${showLogin ? "loginVisible" : ""}`}>
        <section className="landingHero" aria-labelledby="landing-title">
          <div className="sectionEyebrow">{t("landingEyebrow")}</div>
          <h1 id="landing-title">{t("landingTitle")}</h1>
          <p className="landingIntro">{t("landingIntro")}</p>
          <button className="landingCta" type="button" onClick={openLogin}>
            <span>{t("landingCta")}</span><ArrowForwardRoundedIcon />
          </button>
          <ul className="landingFeatures">
            {[1, 2, 3].map((item) => <li key={item}>{t(`landingFeature${item}`)}</li>)}
          </ul>
        </section>

        <aside className="securityPanel" aria-labelledby="security-title">
          {!showLogin ? (
            <div className="securityMessage">
              <span className="securityIcon" aria-hidden="true"><LockRoundedIcon /></span>
              <div className="sectionEyebrow">INFORMATION SECURITY</div>
              <h2 id="security-title">{t("securityTitle")}</h2>
              <p>{t("securityBody")}</p>
              <small>{t("accountIssued")}</small>
              <div className="securityDiagram" aria-hidden="true">
                <span>ACCOUNT</span><i /><span>DOCUMENT</span><i /><span>REVIEW</span>
              </div>
            </div>
          ) : (
            <form className="loginForm" onSubmit={submitLogin} aria-labelledby="login-title">
              <button className="loginBack" type="button" onClick={() => setShowLogin(false)}>{t("backToLanding")}</button>
              <span className="securityIcon" aria-hidden="true"><LockRoundedIcon /></span>
              <h2 id="login-title">{t("loginTitle")}</h2>
              <p>{t("loginIntro")}</p>
              <label>
                <span>{t("username")}</span>
                <input
                  ref={usernameRef}
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t("usernamePlaceholder")}
                  required
                />
              </label>
              <label>
                <span>{t("password")}</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  required
                />
              </label>
              {loginError && <p className="loginError" role="alert">{loginError}</p>}
              <button className="loginSubmit" type="submit" disabled={submitting}>
                <LockRoundedIcon fontSize="small" />{submitting ? t("signingIn") : t("login")}
              </button>
              <small>{t("accountIssued")}</small>
            </form>
          )}
        </aside>
      </main>

      <footer className="landingFooter">
        <span>JR TERM REVIEW</span>
        <span>Secure access / Source traceability</span>
      </footer>
    </div>
  );
}

function Header({ language, setLanguage, health, workflowStep, user, onLogout, activeView, onViewChange, t }) {
  const workflow = ["workflowDocument", "workflowExtract", "workflowVerify", "workflowExport"];

  return (
    <header className="siteHeader">
      <div className="headerMain">
        <div className="brandBlock">
          <span className="brandMark" aria-hidden="true"><TrainRoundedIcon /></span>
          <div>
            <h1>{t("productName")}</h1>
            <p>{t("productSubtitle")}</p>
          </div>
        </div>
        <div className="headerControls">
          <span className={`operationStatus ${health?.modelAvailable ? "ready" : ""}`}>
            <span aria-hidden="true" />
            {health?.modelAvailable ? t("modelReady") : t("trialMode")}
          </span>
          <div className="languageControl" role="group" aria-label={t("language")}>
            {SUPPORTED_LANGUAGES.map((value) => (
              <button
                type="button"
                key={value}
                className={language === value ? "active" : ""}
                aria-pressed={language === value}
                onClick={() => setLanguage(value)}
              >
                {value === "ja" ? "日本語" : value.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="accountControl">
            <AccountCircleRoundedIcon aria-hidden="true" />
            <span><small>{t("signedInAs")}</small><strong>{user.name}</strong></span>
            <button type="button" onClick={onLogout} aria-label={t("logout")} title={t("logout")}>
              <LogoutRoundedIcon fontSize="small" />
            </button>
          </div>
        </div>
      </div>
      <nav className="sectionNavigation" aria-label={t("productName")}>
        <button type="button" className={activeView === "workspace" ? "active" : ""} onClick={() => onViewChange("workspace")}>
          {t("workspaceNav")}
        </button>
        <button type="button" className={activeView === "catalog" ? "active" : ""} onClick={() => onViewChange("catalog")}>
          {t("reviewedTermsNav")}
        </button>
      </nav>
      {activeView === "workspace" && (
        <nav className="workflowRail" aria-label="Workflow">
          {workflow.map((key, index) => {
            const step = index + 1;
            const state = step < workflowStep ? "complete" : step === workflowStep ? "current" : "pending";
            return (
              <div className={`workflowStep ${state}`} key={key} aria-current={state === "current" ? "step" : undefined}>
                <span className="stepNumber">{String(step).padStart(2, "0")}</span>
                <span>{t(key)}</span>
              </div>
            );
          })}
        </nav>
      )}
    </header>
  );
}

function SetupView(props) {
  const {
    files, fileInputRef, threshold, setThreshold, appendFiles, removeFile,
    dragActive, setDragActive, submit, reset, loading, t
  } = props;
  const selectedSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="setupLayout">
      <section className="setupPanel" aria-labelledby="input-title">
        <div className="sectionEyebrow">01 / {t("workflowDocument")}</div>
        <h2 id="input-title">{t("inputTitle")}</h2>
        <p className="sectionIntro">{t("inputIntro")}</p>

        <label
          className={`dropZone ${dragActive ? "dragActive" : ""} ${files.length ? "hasFiles" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            appendFiles(Array.from(event.dataTransfer.files ?? []));
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.pdf,.docx,.csv,.md"
            onChange={(event) => appendFiles(Array.from(event.target.files ?? []))}
          />
          <UploadFileRoundedIcon aria-hidden="true" />
          <strong>{files.length ? t("selectedDocuments", { count: files.length }) : t("chooseDocuments")}</strong>
          <span>{files.length ? t("totalSize", { size: (selectedSize / 1024 / 1024).toFixed(2) }) : t("supportedFiles")}</span>
        </label>

        {files.length > 0 && <FileList files={files} removeFile={removeFile} t={t} />}

        <ThresholdControl threshold={threshold} setThreshold={setThreshold} t={t} />

        <div className="setupActions">
          <button className="primaryAction" type="button" onClick={submit} disabled={loading}>
            <SearchRoundedIcon fontSize="small" />
            {loading ? t("processing") : t("runExtraction")}
          </button>
          {files.length > 0 && (
            <button className="textAction" type="button" onClick={reset} disabled={loading}>{t("reset")}</button>
          )}
        </div>
        <p className="privacyNote"><span aria-hidden="true">✓</span>{t("privacyNote")}</p>
      </section>

      <aside className="processPanel" aria-labelledby="process-title">
        <div className="sectionEyebrow">SOURCE TRACEABILITY</div>
        <h2 id="process-title">{t("setupTitle")}</h2>
        <p className="sectionIntro">{t("setupBody")}</p>
        <ol className="processList">
          {[1, 2, 3].map((step) => (
            <li key={step}>
              <span>{String(step).padStart(2, "0")}</span>
              <div>
                <strong>{t(`setupStep${step}Title`)}</strong>
                <p>{t(`setupStep${step}Body`)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="traceabilityStatement">
          <span>{t("sourceDocument")}</span><i />
          <span>{t("sourcePage")}</span><i />
          <span>{t("sourceExcerpt")}</span>
        </div>
      </aside>
    </div>
  );
}

function FileList({ files, removeFile, t }) {
  return (
    <ul className="fileList">
      {files.map((file) => (
        <li key={`${file.name}-${file.size}-${file.lastModified}`}>
          <InsertDriveFileRoundedIcon fontSize="small" aria-hidden="true" />
          <span className="fileName" title={file.name}>{file.name}</span>
          <span className="fileSize">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          <button type="button" onClick={() => removeFile(file)} aria-label={`${t("removeFile")}: ${file.name}`}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ThresholdControl({ threshold, setThreshold, t, compact = false }) {
  return (
    <fieldset className={`thresholdControl ${compact ? "compact" : ""}`}>
      <legend>{t("extractionStandard")}</legend>
      <div className="thresholdPresets">
        {THRESHOLD_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.key}
            className={Math.abs(threshold - preset.value) < 0.001 ? "active" : ""}
            onClick={() => setThreshold(preset.value)}
            aria-pressed={Math.abs(threshold - preset.value) < 0.001}
          >
            <span className="presetHeading">
              <strong>{t(preset.key)}</strong>
              {!compact && preset.recommended && <em>{t("recommended")}</em>}
            </span>
            {!compact && <span className="presetHelp">{t(`${preset.key}Help`)}</span>}
          </button>
        ))}
      </div>
      {!compact && (
        <label className="thresholdRange">
          <span>{t("thresholdValue", { value: threshold.toFixed(2) })}</span>
          <input
            type="range"
            min="0.5"
            max="0.98"
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
        </label>
      )}
    </fieldset>
  );
}

function ReviewWorkspace(props) {
  const {
    result, terms, visibleTerms, selectedTerm, setSelectedTerm, selectedPdfFile,
    threshold, setThreshold, search, setSearch, groupFilter, setGroupFilter,
    reviewStatusFilter, setReviewStatusFilter, sortBy, setSortBy, submit, reset,
    exportCsv, loading, reviewSaving, onReview, t
  } = props;

  return (
    <div className="reviewView">
      <section className="jobBar" aria-label={t("documentCount", { count: result.fileCount })}>
        <div className="jobIdentity">
          <span className="jobCode">DOC</span>
          <div>
            <strong title={result.fileNames?.join(", ")}>{result.fileNames?.join(" / ")}</strong>
            <p>
              <span>{t("resultCount", { count: terms.length })}</span>
              <span>{t("sentenceCount", { count: result.sentenceCount })}</span>
              <span>{t("elapsed", { value: result.elapsedMs })}</span>
            </p>
          </div>
        </div>
        <ThresholdControl threshold={threshold} setThreshold={setThreshold} t={t} compact />
        <div className="jobActions">
          <button className="secondaryAction" type="button" onClick={reset} disabled={loading}>{t("changeDocuments")}</button>
          <button className="primaryAction compact" type="button" onClick={submit} disabled={loading}>{t("rerun")}</button>
        </div>
        {loading && (<ProgressOverlay t={t} />)}
      </section>

      <div className="reviewWorkspace">
        <section className="candidatePanel" aria-labelledby="candidate-title">
          <div className="candidateHeader">
            <div>
              <span className="sectionEyebrow">03 / {t("workflowVerify")}</span>
              <h2 id="candidate-title">{t("resultsTitle")} <small>{visibleTerms.length}</small></h2>
            </div>
            <button className="exportButton" type="button" onClick={exportCsv} disabled={!terms.length}>
              <DownloadRoundedIcon fontSize="small" />{t("exportCsv")}
            </button>
          </div>

          <div className="candidateTools">
            <label className="searchField">
              <span className="visuallyHidden">{t("candidateSearch")}</span>
              <SearchRoundedIcon fontSize="small" aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlaceholder")} />
            </label>
            <label>
              <span>{t("candidateFilter")}</span>
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                <option value="all">{t("allCandidates")}</option>
                <option value="railway_dictionary_hint">{t("railwayHints")}</option>
                <option value="new_potential_term">{t("reviewCandidates")}</option>
              </select>
            </label>
            <label>
              <span>{t("reviewStatusFilter")}</span>
              <select value={reviewStatusFilter} onChange={(event) => setReviewStatusFilter(event.target.value)}>
                <option value="all">{t("allCandidates")}</option>
                <option value="unreviewed">{t("unreviewedStatus")}</option>
                <option value="approved">{t("approvedStatus")}</option>
                <option value="rejected">{t("rejectedStatus")}</option>
                <option value="uncertain">{t("uncertainStatus")}</option>
              </select>
            </label>
            <label>
              <span>{t("sortLabel")}</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="score">{t("sortScore")}</option>
                <option value="frequency">{t("sortFrequency")}</option>
                <option value="source">{t("sortSource")}</option>
              </select>
            </label>
          </div>

          <div className="candidateList" role="listbox" aria-label={t("resultsTitle")}>
            {!visibleTerms.length ? (
              <div className="candidateEmpty">{terms.length ? t("noMatchingCandidates") : t("emptyResults")}</div>
            ) : visibleTerms.map((term) => (
              <button
                type="button"
                role="option"
                aria-selected={selectedTerm?.id === term.id}
                className={`candidateRow ${selectedTerm?.id === term.id ? "selected" : ""}`}
                key={`${term.id}-${term.term}`}
                onClick={() => setSelectedTerm(term)}
              >
                <span className="candidateMain">
                  <strong lang="ja">{term.term}</strong>
                  <span className={`reviewStatusBadge ${term.reviewStatus ?? "unreviewed"}`}>
                    {formatReviewStatus(term.reviewStatus, t)}
                  </span>
                </span>
                <span className="candidateSource" title={term.files?.join(", ")}>
                  {formatSourceSummary(term, t)}
                </span>
                <span className="candidateFrequency">× {term.frequency}</span>
                <span className={`scoreBadge ${scoreBand(term.score)}`}>{Math.round(term.score * 100)}</span>
              </button>
            ))}
          </div>
        </section>

        <EvidencePanel
          term={selectedTerm}
          pdfFile={selectedPdfFile}
          t={t}
          onClose={() => setSelectedTerm(null)}
          onReview={onReview}
          reviewSaving={reviewSaving}
        />
      </div>
    </div>
  );
}

function EvidencePanel({ term, pdfFile, t, onClose, onReview, reviewSaving }) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const pages = getPagesForFile(term, pdfFile?.name);
  const page = pages[0] ?? term?.page ?? 1;

  useEffect(() => {
    if (!pdfFile || !term) {
      setPdfUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(pdfFile);
    const safePage = Math.max(Number(page) || 1, 1);
    const searchTerm = encodeURIComponent(term.term ?? "");
    setPdfUrl(`${objectUrl}#page=${safePage}&zoom=page-width&search=${searchTerm}`);
    return () => URL.revokeObjectURL(objectUrl);
  }, [page, pdfFile, term]);

  useEffect(() => {
    setReviewNote(term?.reviewNote ?? "");
  }, [term?.id, term?.reviewNote]);

  return (
    <aside className={`evidencePanel ${term ? "open" : ""}`} aria-labelledby="evidence-title">
      <div className="evidenceHeader">
        <div>
          <span className="sectionEyebrow">SOURCE TRACE</span>
          <h2 id="evidence-title">{t("evidenceTitle")}</h2>
        </div>
        {term && (
          <button className="closeEvidence" type="button" onClick={onClose} aria-label={t("close")}>
            <CloseRoundedIcon fontSize="small" />
          </button>
        )}
      </div>

      {!term ? (
        <div className="evidenceEmpty">
          <span aria-hidden="true">↙</span>
          <strong>{t("selectCandidate")}</strong>
          <p>{t("selectCandidateHelp")}</p>
        </div>
      ) : (
        <div className="evidenceContent">
          <div className="sourceRail" aria-label={`${t("sourceDocument")} → ${t("sourcePage")} → ${t("sourceExcerpt")}`}>
            <div><span>01</span><small>{t("sourceDocument")}</small><strong title={term.files?.join(", ")}>{pdfFile?.name ?? term.files?.[0] ?? "—"}</strong></div>
            <i />
            <div><span>02</span><small>{t("sourcePage")}</small><strong>{pages.length ? t("pageShort", { pages: pages.join(", ") }) : "—"}</strong></div>
            <i />
            <div><span>03</span><small>{t("sourceExcerpt")}</small><strong lang="ja">{term.term}</strong></div>
          </div>

          <div className="pdfStage">
            {!pdfFile ? (
              <div className="pdfNotice">{t("pdfUnavailable")}</div>
            ) : pdfUrl ? (
              <iframe title={`${t("evidenceTitle")}: ${term.term}`} src={pdfUrl} />
            ) : (
              <div className="pdfNotice">{t("pdfOpening")}</div>
            )}
          </div>

          <section className="evidenceExcerpt">
            <h3>{t("evidenceSentence")}</h3>
            <p lang="ja"><HighlightedSentence text={getEvidenceText(term)} term={term.term} /></p>
          </section>

          <dl className="candidateFacts">
            <div><dt>{t("extractionScore")}</dt><dd>{Math.round(term.score * 100)}</dd></div>
            <div><dt>{t("frequency")}</dt><dd>{term.frequency}</dd></div>
            <div><dt>{t("candidateType")}</dt><dd>{formatGroupLabel(term.group, t)}</dd></div>
          </dl>

          <section className="reviewDecisionPanel" aria-labelledby="review-decision-title">
            <div className="reviewDecisionHeading">
              <div>
                <h3 id="review-decision-title">{t("reviewDecision")}</h3>
                <span className={`reviewStatusBadge ${term.reviewStatus ?? "unreviewed"}`}>
                  {formatReviewStatus(term.reviewStatus, t)}
                </span>
              </div>
              {term.reviewedByName && (
                <small>{t("reviewedBy", { name: term.reviewedByName })}{term.reviewedAt ? ` · ${formatDate(term.reviewedAt)}` : ""}</small>
              )}
            </div>
            <label className="reviewNoteField">
              <span>{t("reviewNote")}</span>
              <textarea
                value={reviewNote}
                maxLength={2000}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder={t("reviewNotePlaceholder")}
              />
            </label>
            <div className="reviewActions">
              <button type="button" className="approve" disabled={reviewSaving} onClick={() => onReview("approved", reviewNote)}>
                <CheckCircleOutlineRoundedIcon fontSize="small" />{t("approveTerm")}
              </button>
              <button type="button" className="reject" disabled={reviewSaving} onClick={() => onReview("rejected", reviewNote)}>
                <DoNotDisturbAltRoundedIcon fontSize="small" />{t("rejectTerm")}
              </button>
              <button type="button" className="uncertain" disabled={reviewSaving} onClick={() => onReview("uncertain", reviewNote)}>
                <HelpOutlineRoundedIcon fontSize="small" />{t("holdTerm")}
              </button>
            </div>
            {term.reviewStatus && term.reviewStatus !== "unreviewed" && (
              <button className="resetReviewButton" type="button" disabled={reviewSaving} onClick={() => onReview("unreviewed", reviewNote)}>
                {t("resetReview")}
              </button>
            )}
            {reviewSaving && <p className="reviewSaving" role="status">{t("savingReview")}</p>}
          </section>
        </div>
      )}
    </aside>
  );
}

function ReviewedTermsView({ t, setError, onUnauthorized }) {
  const pageSize = 50;
  const [status, setStatus] = useState("approved");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], total: 0 });
  const [summary, setSummary] = useState({ total: 0, unreviewed: 0, approved: 0, rejected: 0, uncertain: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const reportRequestError = (requestError, fallback) => {
    if (requestError.response?.status === 401) {
      onUnauthorized();
      return;
    }
    setError(requestError.response?.data?.error ?? fallback);
  };

  const loadDetail = async (id) => {
    if (!id) {
      setSelectedId(null);
      setDetail(null);
      setHistory([]);
      return;
    }
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const [termResponse, historyResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/terms/${id}`, { withCredentials: true }),
        axios.get(`${API_BASE}/api/terms/${id}/history`, { withCredentials: true })
      ]);
      setDetail(termResponse.data);
      setNote(termResponse.data.reviewNote ?? "");
      setHistory(historyResponse.data.items ?? []);
    } catch (requestError) {
      reportRequestError(requestError, t("apiError"));
    } finally {
      setDetailLoading(false);
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const params = {
        status: status === "reviewed" ? "reviewed" : status,
        search,
        limit: pageSize,
        offset: page * pageSize
      };
      const [termsResponse, summaryResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/terms`, { params, withCredentials: true }),
        axios.get(`${API_BASE}/api/review/summary`, { withCredentials: true })
      ]);
      const nextData = termsResponse.data;
      setData(nextData);
      setSummary(summaryResponse.data);
      const nextSelectedId = nextData.items.some((item) => item.id === selectedId)
        ? selectedId
        : nextData.items[0]?.id ?? null;
      if (nextSelectedId !== selectedId || !detail) await loadDetail(nextSelectedId);
    } catch (requestError) {
      reportRequestError(requestError, t("databaseUnavailable"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadList, 250);
    return () => window.clearTimeout(timer);
  }, [status, search, page]);

  const changeStatus = (nextStatus) => {
    setStatus(nextStatus);
    setPage(0);
    setSelectedId(null);
    setDetail(null);
  };

  const saveReview = async (nextStatus) => {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      await axios.patch(
        `${API_BASE}/api/terms/${detail.id}/review`,
        { status: nextStatus, note, version: detail.reviewVersion },
        { withCredentials: true }
      );
      await loadList();
      if (nextStatus === status || status === "reviewed") await loadDetail(detail.id);
    } catch (requestError) {
      if (requestError.response?.status === 409 && requestError.response.data?.current) {
        setDetail((current) => ({ ...current, ...requestError.response.data.current }));
        setNote(requestError.response.data.current.reviewNote ?? "");
        setError(t("reviewConflict"));
      } else {
        reportRequestError(requestError, t("apiError"));
      }
    } finally {
      setSaving(false);
    }
  };

  const from = data.total ? page * pageSize + 1 : 0;
  const to = Math.min((page + 1) * pageSize, data.total);
  const tabs = [
    { key: "approved", label: t("approvedStatus"), count: summary.approved },
    { key: "rejected", label: t("rejectedStatus"), count: summary.rejected },
    { key: "uncertain", label: t("uncertainStatus"), count: summary.uncertain },
    { key: "reviewed", label: t("reviewedAll"), count: summary.approved + summary.rejected + summary.uncertain }
  ];

  return (
    <div className="catalogView">
      <header className="catalogHeader">
        <div>
          <span className="sectionEyebrow">REVIEWED TERMINOLOGY</span>
          <h2>{t("reviewedCatalogTitle")}</h2>
          <p>{t("reviewedCatalogIntro")}</p>
        </div>
        <div className="catalogExport">
          <span>{t("trainingExport")}</span>
          <a href={`${API_BASE}/api/exports/training.csv`}><DownloadRoundedIcon fontSize="small" />{t("exportCsv")}</a>
          <a href={`${API_BASE}/api/exports/training.jsonl`}><DownloadRoundedIcon fontSize="small" />{t("exportJsonl")}</a>
        </div>
      </header>

      <div className="reviewSummary" aria-label={t("reviewStatusFilter")}>
        <div><strong>{summary.unreviewed}</strong><span>{t("unreviewedStatus")}</span></div>
        <div className="approved"><strong>{summary.approved}</strong><span>{t("approvedStatus")}</span></div>
        <div className="rejected"><strong>{summary.rejected}</strong><span>{t("rejectedStatus")}</span></div>
        <div className="uncertain"><strong>{summary.uncertain}</strong><span>{t("uncertainStatus")}</span></div>
      </div>

      <div className="catalogTabs" role="tablist" aria-label={t("reviewStatusFilter")}>
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={status === tab.key}
            className={status === tab.key ? "active" : ""}
            key={tab.key}
            onClick={() => changeStatus(tab.key)}
          >
            {tab.label}<span>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="catalogWorkspace">
        <section className="catalogListPanel" aria-label={t("reviewedCatalogTitle")}>
          <label className="searchField catalogSearch">
            <SearchRoundedIcon fontSize="small" aria-hidden="true" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder={t("termSearch")} />
          </label>
          <div className="catalogTermList">
            {loading ? (
              <p className="catalogEmpty">{t("loadingTerms")}</p>
            ) : !data.items.length ? (
              <p className="catalogEmpty">{t("noReviewedTerms")}</p>
            ) : data.items.map((term) => (
              <button
                type="button"
                key={term.id}
                className={selectedId === term.id ? "active" : ""}
                onClick={() => loadDetail(term.id)}
              >
                <span>
                  <strong lang="ja">{term.termText}</strong>
                  <small>{term.documentCount} {t("sourceDocument")} · × {term.frequency}</small>
                </span>
                <span className={`reviewStatusBadge ${term.reviewStatus}`}>{formatReviewStatus(term.reviewStatus, t)}</span>
              </button>
            ))}
          </div>
          <div className="catalogPagination">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}>{t("previousPage")}</button>
            <span>{t("pageStatus", { from, to, total: data.total })}</span>
            <button type="button" disabled={to >= data.total || loading} onClick={() => setPage((current) => current + 1)}>{t("nextPage")}</button>
          </div>
        </section>

        <section className="catalogDetailPanel" aria-live="polite">
          {detailLoading ? (
            <p className="catalogEmpty">{t("loadingTerms")}</p>
          ) : !detail ? (
            <p className="catalogEmpty">{t("noReviewedTerms")}</p>
          ) : (
            <>
              <div className="catalogTermHeading">
                <div>
                  <span className={`reviewStatusBadge ${detail.reviewStatus}`}>{formatReviewStatus(detail.reviewStatus, t)}</span>
                  <h2 lang="ja">{detail.termText}</h2>
                  {detail.reviewedByName && <p>{t("reviewedBy", { name: detail.reviewedByName })} · {formatDate(detail.reviewedAt)}</p>}
                </div>
              </div>

              <section className="catalogReviewEditor">
                <label className="reviewNoteField">
                  <span>{t("reviewNote")}</span>
                  <textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder={t("reviewNotePlaceholder")} />
                </label>
                <div className="reviewActions">
                  <button type="button" className="approve" disabled={saving} onClick={() => saveReview("approved")}><CheckCircleOutlineRoundedIcon fontSize="small" />{t("approveTerm")}</button>
                  <button type="button" className="reject" disabled={saving} onClick={() => saveReview("rejected")}><DoNotDisturbAltRoundedIcon fontSize="small" />{t("rejectTerm")}</button>
                  <button type="button" className="uncertain" disabled={saving} onClick={() => saveReview("uncertain")}><HelpOutlineRoundedIcon fontSize="small" />{t("holdTerm")}</button>
                </div>
              </section>

              <section className="occurrenceSection">
                <h3>{t("sourceOccurrences")} <span>{detail.occurrences?.length ?? 0}</span></h3>
                <div className="occurrenceList">
                  {(detail.occurrences ?? []).map((occurrence) => (
                    <article key={occurrence.id}>
                      <div>
                        <strong title={occurrence.fileName}>{occurrence.fileName}</strong>
                        <span>{occurrence.page ? t("pageShort", { pages: occurrence.page }) : "—"}</span>
                        <a href={`${API_BASE}/api/documents/${occurrence.documentId}/content`} target="_blank" rel="noreferrer">{t("openSource")} ↗</a>
                      </div>
                      <p lang="ja"><HighlightedSentence text={occurrence.sentence} term={detail.termText} /></p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="historySection">
                <h3><HistoryRoundedIcon fontSize="small" />{t("reviewHistory")}</h3>
                {!history.length ? <p>{t("noHistory")}</p> : (
                  <ol>
                    {history.map((entry) => (
                      <li key={entry.id}>
                        <span>{formatReviewStatus(entry.previousStatus, t)} → <strong>{formatReviewStatus(entry.newStatus, t)}</strong></span>
                        <small>{entry.reviewerName} · {formatDate(entry.createdAt)}</small>
                        {entry.note && <p>{entry.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </div>
  );
}


function ProgressOverlay({ t }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const caption = t('processingDetail');
  const firstLine = caption.split('。')[0];
  return (
    <div className="progressOverlay" role="status" aria-live="polite" aria-label={t('processing')}>
      <div className="progressSpinner" aria-hidden="true" />
      <strong>{t('processing')}</strong>
      <p>{firstLine}</p>
      <small>{elapsed}秒経過</small>
    </div>
  );
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

function sameFileName(a, b) {
  const left = normalizeFileName(a);
  const right = normalizeFileName(b);
  return left === right || left.includes(right) || right.includes(left);
}

function normalizeFileName(name) {
  return String(name ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function formatGroupLabel(group, t) {
  if (group === "railway_dictionary_hint") return t("railwayHint");
  if (group === "new_potential_term") return t("needsReview");
  return t("extractedResult");
}

function formatReviewStatus(status = "unreviewed", t) {
  const labels = {
    unreviewed: "unreviewedStatus",
    approved: "approvedStatus",
    rejected: "rejectedStatus",
    uncertain: "uncertainStatus"
  };
  return t(labels[status] ?? labels.unreviewed);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeCsvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function getPagesForFile(term, fileName) {
  if (!term) return [];
  if (fileName && term.pagesByFile) {
    const matchingKey = Object.keys(term.pagesByFile).find((name) => sameFileName(name, fileName));
    if (matchingKey) return term.pagesByFile[matchingKey] ?? [];
  }
  return term.pages ?? [term.page].filter(Boolean);
}

function formatPages(term) {
  const pages = term?.pages ?? [term?.page].filter(Boolean);
  return pages.length ? pages.join(", ") : "-";
}

function formatSourceSummary(term, t) {
  const file = term.files?.[0] ?? "—";
  const pages = getPagesForFile(term, file);
  const pageText = pages.length ? t("pageShort", { pages: pages.slice(0, 3).join(", ") }) : "—";
  return `${shortFileName(file)} · ${pageText}`;
}

function shortFileName(name) {
  const value = String(name ?? "");
  return value.length > 28 ? `${value.slice(0, 25)}…` : value;
}

function sourceSortKey(term) {
  const file = term.files?.[0] ?? "";
  const page = getPagesForFile(term, file)[0] ?? 999999;
  return `${file}-${String(page).padStart(8, "0")}`;
}

function scoreBand(score) {
  if (score >= 0.9) return "high";
  if (score >= 0.75) return "medium";
  return "low";
}

function getEvidenceText(term) {
  const text = term?.examples?.[0] ?? term?.sentence ?? "";
  const matchingFile = term?.files?.find((file) => text.startsWith(`${file}: `));
  return matchingFile ? text.slice(matchingFile.length + 2) : text;
}
