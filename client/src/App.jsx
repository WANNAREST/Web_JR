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
import ViewSidebarRoundedIcon from "@mui/icons-material/ViewSidebarRounded";
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
    modelReady: "モデルを利用できます",
    trialMode: "BERTを利用できません",
    language: "表示言語",
    login: "ログイン",
    logout: "ログアウト",
    landingEyebrow: "安全な文書レビュー",
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
    signingIn: "ログインしています…",
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
    uploadingDocuments: "文書をアップロードしています",
    processingFiles: "{count}件の文書をBERTで解析しています",
    elapsedSeconds: "{count}秒経過",
    modelUsed: "BERT推論",
    progressStage_loading_model: "BERTモデルを読み込んでいます",
    progressStage_reading_document: "文書のテキストを読み込んでいます",
    progressStage_extracting_candidates: "候補語を抽出しています",
    progressStage_preparing_batches: "重複候補を整理しています",
    progressStage_scoring_candidates: "BERTで候補語を採点しています",
    progressStage_aggregating_results: "結果をまとめています",
    progressStage_saving_results: "結果を保存しています",
    progressStage_complete: "完了しました",
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
    reviewStatusFilter: "判定状態",
    allCandidates: "すべて",
    railwayHints: "鉄道用語候補",
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
    savedDocumentsNav: "抽出済み文書",
    savedDocumentsTitle: "抽出済み文書",
    savedDocumentsIntro: "抽出済みの文書を開き、BERTを再実行せずに確認作業を再開できます。",
    noSavedDocuments: "抽出済みの文書はありません。",
    resumeReview: "確認作業を再開",
    duplicateDocument: "この文書はすでに抽出されています。既存の確認作業を再開しますか？",
    duplicateBatch: "選択した文書の一部はすでに抽出されています。すべて再抽出しますか？",
    extractAgain: "再抽出する",
    reviewedTermsNav: "判定済み用語",
    reviewDecision: "判定",
    reviewNote: "判定メモ（任意）",
    reviewNotePlaceholder: "判断根拠や確認事項を入力",
    approveTerm: "JR固有用語",
    rejectTerm: "JR固有用語ではない",
    holdTerm: "判断保留",
    resetReview: "未判定に戻す",
    unreviewedStatus: "未判定",
    approvedStatus: "JR固有用語",
    rejectedStatus: "JR固有用語ではない",
    uncertainStatus: "判断保留",
    savingReview: "保存中…",
    reviewedBy: "確認者: {name}",
    reviewConflict: "別の担当者が先に更新しました。最新の判定内容を表示しています。",
    reviewedCatalogTitle: "判定済み用語",
    reviewedCatalogIntro: "文書ごとの判定結果と、その出典・履歴を確認できます。",
    reviewedAll: "すべての判定済み用語",
    termSearch: "用語を検索",
    noReviewedTerms: "条件に一致する判定済み用語がありません。",
    sourceOccurrences: "出典箇所",
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
    apiError: "抽出サービスに接続できませんでした。",
    informationSecurity: "情報セキュリティ",
    securityAccount: "アカウント",
    securityDocument: "文書",
    securityReview: "確認",
    footerProduct: "JR用語レビュー",
    footerSubtitle: "アクセス管理 / 出典追跡",
    workflowAriaLabel: "作業フロー",
    sourceTraceabilityEyebrow: "出典情報を保持",
    sourceTraceEyebrow: "出典情報",
    savedReviewQueueEyebrow: "抽出済み文書",
    reviewedTerminologyEyebrow: "判定済み用語",
    documentCode: "文書"
  },
  en: {
    productName: "Railway Term Review",
    productSubtitle: "Review candidate terms against their source",
    modelReady: "Model connected",
    trialMode: "BERT unavailable",
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
    processingDetail: "BERT is extracting and scoring candidate terms. Please keep this page open.",
    uploadingDocuments: "Uploading documents",
    processingFiles: "Analyzing {count} documents with BERT",
    elapsedSeconds: "{count}s elapsed",
    modelUsed: "BERT inference",
    progressStage_loading_model: "Loading the BERT model",
    progressStage_reading_document: "Reading document text",
    progressStage_extracting_candidates: "Extracting candidate terms",
    progressStage_preparing_batches: "Removing duplicate candidates",
    progressStage_scoring_candidates: "Scoring candidates with BERT",
    progressStage_aggregating_results: "Aggregating results",
    progressStage_saving_results: "Saving results",
    progressStage_complete: "Complete",
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
    savedDocumentsNav: "Saved documents",
    savedDocumentsTitle: "Saved review documents",
    savedDocumentsIntro: "Continue reviewing extracted documents without running BERT again.",
    noSavedDocuments: "No saved documents are available.",
    resumeReview: "Continue review",
    duplicateDocument: "This document was extracted before. Continue the saved review instead?",
    duplicateBatch: "Some selected documents were extracted before. Extract every selected document again?",
    extractAgain: "Extract again",
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
    apiError: "Could not connect to the extraction service.",
    informationSecurity: "INFORMATION SECURITY",
    securityAccount: "ACCOUNT",
    securityDocument: "DOCUMENT",
    securityReview: "REVIEW",
    footerProduct: "JR TERM REVIEW",
    footerSubtitle: "Secure access / Source traceability",
    workflowAriaLabel: "Workflow",
    sourceTraceabilityEyebrow: "SOURCE TRACEABILITY",
    sourceTraceEyebrow: "SOURCE TRACE",
    savedReviewQueueEyebrow: "SAVED REVIEW QUEUE",
    reviewedTerminologyEyebrow: "REVIEWED TERMINOLOGY",
    documentCode: "DOC"
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
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("workspace");
  const [resumeDocumentId, setResumeDocumentId] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("jr-sidebar-collapsed") === "true";
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem("jr-sidebar-width"));
    return Number.isFinite(savedWidth) ? Math.min(340, Math.max(220, savedWidth)) : 260;
  });
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
    localStorage.setItem("jr-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem("jr-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  const startSidebarResize = (event) => {
    if (sidebarCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const resize = (moveEvent) => {
      const nextWidth = Math.min(340, Math.max(220, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(nextWidth);
    };
    const stop = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
      document.body.classList.remove("resizingSidebar");
    };
    document.body.classList.add("resizingSidebar");
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop);
  };

  useEffect(() => {
    if (sessionReady) window.scrollTo(0, 0);
  }, [sessionReady, user]);

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
  };

  const submit = async (skipDuplicateCheck = false) => {
    if (!files.length) {
      setError(t("selectFileError"));
      return;
    }

    if (!skipDuplicateCheck) {
      try {
        const sha256s = await Promise.all(files.map(sha256ForFile));
        const duplicateResponse = await axios.post(`${API_BASE}/api/documents/duplicates`, { sha256s }, { withCredentials: true });
        const duplicates = duplicateResponse.data.items ?? [];
        if (duplicates.length) {
          const duplicate = duplicates[0];
          if (files.length === 1) {
            const continueSavedReview = window.confirm(`${t("duplicateDocument")}\n\n${duplicate.fileName}\n${duplicate.unreviewedCount}/${duplicate.termCount} ${t("unreviewedStatus")}\n\nOK: ${t("resumeReview")}\nCancel: ${t("extractAgain")}`);
            if (continueSavedReview) {
              setResumeDocumentId(duplicate.id);
              setActiveView("saved");
              reset();
              return;
            }
            return submit(true);
          }
          if (window.confirm(`${t("duplicateBatch")}\n\nOK: ${t("extractAgain")}`)) return submit(true);
          return;
        }
      } catch (requestError) {
        setError(requestError.response?.data?.error ?? t("apiError"));
        return;
      }
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("documents", file));
    formData.append("threshold", threshold);
    setLoading(true);
    setUploadProgress(0);
    setAnalysisProgress(null);
    setError("");

    try {
      const responseData = await postExtraction(`${API_BASE}/api/extract`, formData, {
        onUploadProgress: setUploadProgress,
        onAnalysisProgress: (progress) => {
          setUploadProgress(100);
          setAnalysisProgress(progress);
        }
      });
      const documentIds = (responseData.files ?? []).map((file) => file.id).filter(Boolean);
      reset();
      setResumeDocumentId(documentIds.length === 1 ? documentIds[0] : null);
      setActiveView("saved");
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setUser(null);
      }
      setError(requestError.response?.data?.detail ?? requestError.response?.data?.error ?? t("apiError"));
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setAnalysisProgress(null);
    }
  };

  const reset = () => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
        user={user}
        onLogout={logout}
        t={t}
      />

      <div
        className={`authenticatedLayout ${sidebarCollapsed ? "sidebarCollapsed" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` }}
      >
        <Sidebar
          activeView={activeView}
          collapsed={sidebarCollapsed}
          onResizeStart={startSidebarResize}
          onToggle={() => setSidebarCollapsed((current) => !current)}
          onViewChange={setActiveView}
          t={t}
        />

        <main className="mainContent">
          {activeView === "catalog" ? (
            <ReviewedTermsView t={t} setError={setError} onUnauthorized={() => { reset(); setUser(null); }} />
          ) : activeView === "saved" ? (
            <SavedDocumentsView t={t} setError={setError} initialDocumentId={resumeDocumentId} onOpened={() => setResumeDocumentId(null)} />
          ) : (
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
              uploadProgress={uploadProgress}
              analysisProgress={analysisProgress}
              t={t}
            />
          )}
        </main>
      </div>

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
              <div className="sectionEyebrow">{t("informationSecurity")}</div>
              <h2 id="security-title">{t("securityTitle")}</h2>
              <p>{t("securityBody")}</p>
              <small>{t("accountIssued")}</small>
              <div className="securityDiagram" aria-hidden="true">
                <span>{t("securityAccount")}</span><i /><span>{t("securityDocument")}</span><i /><span>{t("securityReview")}</span>
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
        <span>{t("footerProduct")}</span>
        <span>{t("footerSubtitle")}</span>
      </footer>
    </div>
  );
}

function Header({ language, setLanguage, health, user, onLogout, t }) {
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
          <span
            className={`operationStatus ${health?.modelAvailable ? "ready" : ""}`}
            title={health?.modelError ?? undefined}
          >
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
    </header>
  );
}

function Sidebar({ activeView, collapsed, onResizeStart, onToggle, onViewChange, t }) {
  const items = [
    { key: "workspace", label: t("workspaceNav"), icon: <UploadFileRoundedIcon fontSize="small" /> },
    { key: "saved", label: t("savedDocumentsNav"), icon: <InsertDriveFileRoundedIcon fontSize="small" /> },
    { key: "catalog", label: t("reviewedTermsNav"), icon: <CheckCircleOutlineRoundedIcon fontSize="small" /> }
  ];

  return (
    <aside className={`appSidebar ${collapsed ? "collapsed" : ""}`} aria-label={t("productName")}>
      <button
        type="button"
        className="sidebarToggle"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("productName") : t("close")}
        title={collapsed ? t("productName") : t("close")}
      >
        <ViewSidebarRoundedIcon fontSize="small" />
      </button>
      <nav>
        {items.map((item) => (
          <button
            type="button"
            key={item.key}
            className={activeView === item.key ? "active" : ""}
            aria-current={activeView === item.key ? "page" : undefined}
            onClick={() => onViewChange(item.key)}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div
        className="sidebarResizeHandle"
        role="separator"
        aria-orientation="vertical"
        aria-hidden={collapsed ? "true" : undefined}
        onPointerDown={onResizeStart}
      />
    </aside>
  );
}

function SetupView(props) {
  const {
    files, fileInputRef, threshold, setThreshold, appendFiles, removeFile,
    dragActive, setDragActive, submit, reset, loading, uploadProgress, analysisProgress, t
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
          <span className="uploadIllustration" aria-hidden="true">
            <span className="uploadFile uploadFileBack" />
            <span className="uploadFile uploadFileFront"><UploadFileRoundedIcon /></span>
            <span className="uploadPulse" />
          </span>
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
        {loading && (
          <ProgressOverlay
            t={t}
            fileCount={files.length}
            uploadProgress={uploadProgress}
            analysisProgress={analysisProgress}
          />
        )}
      </section>

      <aside className="processPanel" aria-labelledby="process-title">
        <ProcessVisual />
        <div className="sectionEyebrow">{t("sourceTraceabilityEyebrow")}</div>
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

function ProcessVisual() {
  return (
    <div className="processVisual" aria-hidden="true">
      <svg viewBox="0 0 480 164" focusable="false">
        <defs>
          <linearGradient id="journeyGradient" x1="0" x2="1">
            <stop offset="0" stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <path d="M42 125C112 125 120 44 208 44s94 81 170 81" fill="none" stroke="url(#journeyGradient)" strokeLinecap="round" strokeWidth="8" />
        <path d="M42 145C112 145 120 64 208 64s94 81 170 81" fill="none" stroke="#dbeafe" strokeLinecap="round" strokeWidth="8" />
        <circle cx="42" cy="135" r="15" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="3" />
        <circle cx="208" cy="54" r="15" fill="#eff6ff" stroke="#2563eb" strokeWidth="3" />
        <circle cx="378" cy="135" r="15" fill="#dbeafe" stroke="#2563eb" strokeWidth="3" />
        <rect x="85" y="31" width="72" height="88" rx="10" fill="#fff" stroke="#bfdbfe" strokeWidth="3" />
        <path d="M105 57h32M105 73h32M105 89h22" stroke="#60a5fa" strokeLinecap="round" strokeWidth="6" />
        <rect x="270" y="27" width="82" height="56" rx="12" fill="#eff6ff" stroke="#93c5fd" strokeWidth="3" />
        <path d="m291 53 12 12 27-30" fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" />
      </svg>
      <span className="processVisualCaption">PDF · DOCX · TXT</span>
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
    exportCsv, loading, uploadProgress, analysisProgress, reviewSaving, onReview, t
  } = props;

  return (
    <div className="reviewView">
      <section className="jobBar" aria-label={t("documentCount", { count: result.fileCount })}>
        <div className="jobIdentity">
          <span className="jobCode">{t("documentCode")}</span>
          <div>
            <strong title={result.fileNames?.join(", ")}>{result.fileNames?.join(" / ")}</strong>
            <p>
              <span>{t("resultCount", { count: terms.length })}</span>
              <span>{t("sentenceCount", { count: result.sentenceCount })}</span>
              <span>{t("elapsed", { value: result.elapsedMs })}</span>
              {result.mode === "bert" && <span className="modelUsedBadge">{t("modelUsed")}</span>}
            </p>
          </div>
        </div>
        <ThresholdControl threshold={threshold} setThreshold={setThreshold} t={t} compact />
        <div className="jobActions">
          <button className="secondaryAction" type="button" onClick={reset} disabled={loading}>{t("changeDocuments")}</button>
          <button className="primaryAction compact" type="button" onClick={submit} disabled={loading}>{t("rerun")}</button>
        </div>
        {loading && (
          <ProgressOverlay
            t={t}
            fileCount={result.fileCount}
            uploadProgress={uploadProgress}
            analysisProgress={analysisProgress}
          />
        )}
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
                <span className={`scoreBadge ${scoreBand(term.score)}`} title={t("extractionScore")}>{formatExtractionScore(term.score)}</span>
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
          <span className="sectionEyebrow">{t("sourceTraceEyebrow")}</span>
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

          <section className="evidenceExcerpt">
            <h3>{t("evidenceSentence")}</h3>
            <p lang="ja"><HighlightedSentence text={getEvidenceText(term)} term={term.term} /></p>
          </section>

          <div className="pdfStage">
            {!pdfFile ? (
              <div className="pdfNotice">{t("pdfUnavailable")}</div>
            ) : pdfUrl ? (
              <iframe title={`${t("evidenceTitle")}: ${term.term}`} src={pdfUrl} />
            ) : (
              <div className="pdfNotice">{t("pdfOpening")}</div>
            )}
          </div>

          <dl className="candidateFacts">
            <div><dt>{t("extractionScore")}</dt><dd>{formatExtractionScore(term.score)}</dd></div>
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

function SavedDocumentsView({ t, setError, initialDocumentId, onOpened }) {
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [termsLoading, setTermsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score");

  const loadTerms = async (documentId) => {
    setSelectedId(documentId);
    setSelectedTerm(null);
    setTermsLoading(true);
    setSearch("");
    setStatusFilter("all");
    try {
      const response = await axios.get(`${API_BASE}/api/review-documents/${documentId}/terms`, { withCredentials: true });
      const items = response.data.items ?? [];
      setTerms(items);
      setSelectedTerm(items.find((term) => term.reviewStatus === "unreviewed") ?? items[0] ?? null);
    } catch (error) {
      setError(error.response?.data?.error ?? t("apiError"));
    } finally {
      setTermsLoading(false);
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE}/api/review-documents`, { withCredentials: true })
      .then((response) => {
        const items = response.data.items ?? [];
        setDocuments(items);
        const nextId = items.some((item) => item.id === initialDocumentId) ? initialDocumentId : null;
        if (nextId) loadTerms(nextId);
        onOpened();
      })
      .catch((error) => setError(error.response?.data?.error ?? t("apiError")))
      .finally(() => setLoading(false));
  }, []);

  const visibleTerms = useMemo(() => {
    const query = search.normalize("NFKC").trim().toLowerCase();
    return terms
      .filter((term) => (statusFilter === "all" || term.reviewStatus === statusFilter)
        && (!query || `${term.term} ${term.sentence ?? ""}`.normalize("NFKC").toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortBy === "frequency") return b.frequency - a.frequency || b.score - a.score;
        return b.score - a.score || b.frequency - a.frequency || a.term.localeCompare(b.term, "ja");
      });
  }, [search, sortBy, statusFilter, terms]);

  const saveReview = async (status, note) => {
    if (!selectedId || !selectedTerm) return;
    setSaving(true);
    try {
      const response = await axios.patch(
        `${API_BASE}/api/review-documents/${selectedId}/terms/${selectedTerm.id}/review`,
        { status, note, version: selectedTerm.reviewVersion },
        { withCredentials: true }
      );
      const updated = { ...selectedTerm, ...response.data };
      setTerms((current) => current.map((term) => term.id === updated.id ? { ...term, ...response.data } : term));
      const nextUnreviewed = selectedTerm.reviewStatus === "unreviewed" && status !== "unreviewed"
        ? terms.find((term) => term.id !== selectedTerm.id && term.reviewStatus === "unreviewed")
        : null;
      setSelectedTerm(nextUnreviewed ?? updated);
      setDocuments((current) => current.map((document) => document.id === selectedId ? {
        ...document,
        unreviewedCount: Math.max(0, Number(document.unreviewedCount)
          + (status === "unreviewed" ? 1 : 0)
          - (selectedTerm.reviewStatus === "unreviewed" ? 1 : 0))
      } : document));
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.current) {
        const current = { ...selectedTerm, ...error.response.data.current };
        setSelectedTerm(current);
        setTerms((items) => items.map((term) => term.id === current.id ? current : term));
        setError(t("reviewConflict"));
      } else {
        setError(error.response?.data?.error ?? t("apiError"));
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedDocument = documents.find((document) => document.id === selectedId) ?? null;
  const exportDocumentReview = () => {
    if (selectedDocument && terms.length) exportDocumentReviewCsv(selectedDocument, terms, t);
  };

  return (
    <div className="savedReviewView">
      <header className="catalogHeader">
        <div>
          <span className="sectionEyebrow">{t("savedReviewQueueEyebrow")}</span>
          <h2>{t("savedDocumentsTitle")}</h2>
          <p>{t("savedDocumentsIntro")}</p>
        </div>
      </header>
      {selectedDocument ? (
        <DocumentReviewDesk
          document={selectedDocument}
          terms={terms}
          visibleTerms={visibleTerms}
          selectedTerm={selectedTerm}
          setSelectedTerm={setSelectedTerm}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          loading={termsLoading}
          saving={saving}
          onReview={saveReview}
          onExport={exportDocumentReview}
          onBack={() => { setSelectedId(null); setSelectedTerm(null); }}
          t={t}
        />
      ) : (
        <section className="savedDocumentGrid" aria-label={t("savedDocumentsTitle")}>
          {loading ? <p className="catalogEmpty">{t("loadingTerms")}</p> : !documents.length ? <p className="catalogEmpty">{t("noSavedDocuments")}</p> : documents.map((document) => (
            <button key={document.id} type="button" onClick={() => loadTerms(document.id)}>
              <span><strong>{document.fileName}</strong><small>{document.unreviewedCount}/{document.termCount} {t("unreviewedStatus")} · {formatDate(document.extractedAt)}</small></span>
              <span className="scoreBadge high">{document.termCount}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function DocumentReviewDesk({ document, terms, visibleTerms, selectedTerm, setSelectedTerm, search, setSearch, statusFilter, setStatusFilter, sortBy, setSortBy, loading, saving, onReview, onExport, onBack, t }) {
  return (
    <div className="reviewView documentReviewDesk">
      <section className="jobBar" aria-label={document.fileName}>
        <div className="jobIdentity">
          <span className="jobCode">{t("documentCode")}</span>
          <div>
            <strong title={document.fileName}>{document.fileName}</strong>
            <p><span>{t("resultCount", { count: document.termCount })}</span><span>{document.unreviewedCount} {t("unreviewedStatus")}</span></p>
          </div>
        </div>
        <div className="jobActions"><button className="secondaryAction" type="button" onClick={onBack}>{t("savedDocumentsTitle")}</button></div>
      </section>

      <div className="reviewWorkspace">
        <section className="candidatePanel" aria-labelledby="candidate-title">
          <div className="candidateHeader">
            <div><span className="sectionEyebrow">03 / {t("workflowVerify")}</span><h2 id="candidate-title">{t("resultsTitle")} <small>{visibleTerms.length}</small></h2></div>
            <button className="exportButton" type="button" onClick={onExport} disabled={!terms.length}>
              <DownloadRoundedIcon fontSize="small" />{t("exportCsv")}
            </button>
          </div>
          <div className="candidateTools documentCandidateTools">
            <label className="searchField"><span className="visuallyHidden">{t("candidateSearch")}</span><SearchRoundedIcon fontSize="small" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlaceholder")} /></label>
            <label><span>{t("reviewStatusFilter")}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{t("allCandidates")}</option><option value="unreviewed">{t("unreviewedStatus")}</option><option value="approved">{t("approvedStatus")}</option><option value="rejected">{t("rejectedStatus")}</option><option value="uncertain">{t("uncertainStatus")}</option></select></label>
            <label><span>{t("sortLabel")}</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="score">{t("sortScore")}</option><option value="frequency">{t("sortFrequency")}</option></select></label>
          </div>
          <div className="candidateList" role="listbox" aria-label={t("resultsTitle")}>
            {loading ? <div className="candidateEmpty">{t("loadingTerms")}</div> : !visibleTerms.length ? <div className="candidateEmpty">{t("noMatchingCandidates")}</div> : visibleTerms.map((term, index) => (
              <button type="button" role="option" aria-selected={selectedTerm?.id === term.id} className={`candidateRow documentCandidateRow ${selectedTerm?.id === term.id ? "selected" : ""}`} key={term.id} onClick={() => setSelectedTerm(term)} onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                const nextIndex = event.key === "ArrowDown" ? Math.min(index + 1, visibleTerms.length - 1) : Math.max(index - 1, 0);
                setSelectedTerm(visibleTerms[nextIndex]);
                event.currentTarget.parentElement?.querySelectorAll(".documentCandidateRow")[nextIndex]?.focus();
              }}>
                <span className="candidateMain"><strong lang="ja">{term.term}</strong><span className={`reviewStatusBadge ${term.reviewStatus}`}>{formatReviewStatus(term.reviewStatus, t)}</span></span>
                <span className="candidateFrequency">× {term.frequency}</span><span className={`scoreBadge ${scoreBand(term.score)}`} title={t("extractionScore")}>{formatExtractionScore(term.score)}</span><small className="documentCandidateSentence" lang="ja">{term.sentence}</small>
              </button>
            ))}
          </div>
        </section>
        <DocumentEvidencePanel term={selectedTerm} document={document} t={t} onClose={() => setSelectedTerm(null)} onReview={onReview} saving={saving} />
      </div>
    </div>
  );
}

function DocumentEvidencePanel({ term, document, t, onClose, onReview, saving }) {
  const [note, setNote] = useState("");
  const page = Math.max(Number(term?.page) || 1, 1);
  const isPdf = document.mimeType === "application/pdf" || document.fileName.toLowerCase().endsWith(".pdf");

  useEffect(() => setNote(term?.reviewNote ?? ""), [term?.id, term?.reviewNote]);

  return (
    <aside className={`evidencePanel ${term ? "open" : ""}`} aria-labelledby="evidence-title">
      <div className="evidenceHeader"><div><span className="sectionEyebrow">{t("sourceTraceEyebrow")}</span><h2 id="evidence-title">{t("evidenceTitle")}</h2></div>{term && <button className="closeEvidence" type="button" onClick={onClose} aria-label={t("close")}><CloseRoundedIcon fontSize="small" /></button>}</div>
      {!term ? <div className="evidenceEmpty"><span aria-hidden="true">↙</span><strong>{t("selectCandidate")}</strong><p>{t("selectCandidateHelp")}</p></div> : <>
        <section className="reviewDecisionPanel reviewDecisionDock" aria-labelledby="review-decision-title">
          <div className="reviewDecisionHeading"><div><h3 id="review-decision-title">{t("reviewDecision")}</h3><span className={`reviewStatusBadge ${term.reviewStatus}`}>{formatReviewStatus(term.reviewStatus, t)}</span></div>{term.reviewedByName && <small>{t("reviewedBy", { name: term.reviewedByName })}{term.reviewedAt ? ` · ${formatDate(term.reviewedAt)}` : ""}</small>}</div>
          <div className="reviewActions"><button type="button" className="approve" disabled={saving} onClick={() => onReview("approved", note)}><CheckCircleOutlineRoundedIcon fontSize="small" />{t("approveTerm")}</button><button type="button" className="reject" disabled={saving} onClick={() => onReview("rejected", note)}><DoNotDisturbAltRoundedIcon fontSize="small" />{t("rejectTerm")}</button><button type="button" className="uncertain" disabled={saving} onClick={() => onReview("uncertain", note)}><HelpOutlineRoundedIcon fontSize="small" />{t("holdTerm")}</button></div>
          <label className="reviewNoteField"><span>{t("reviewNote")}</span><textarea value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder={t("reviewNotePlaceholder")} /></label>
          {term.reviewStatus !== "unreviewed" && <button className="resetReviewButton" type="button" disabled={saving} onClick={() => onReview("unreviewed", note)}>{t("resetReview")}</button>}
          {saving && <p className="reviewSaving" role="status">{t("savingReview")}</p>}
        </section>
        <div className="evidenceContent">
          <div className="sourceRail" aria-label={`${t("sourceDocument")} → ${t("sourcePage")} → ${t("sourceExcerpt")}`}><div><span>01</span><small>{t("sourceDocument")}</small><strong title={document.fileName}>{document.fileName}</strong></div><i /><div><span>02</span><small>{t("sourcePage")}</small><strong>{t("pageShort", { pages: page })}</strong></div><i /><div><span>03</span><small>{t("sourceExcerpt")}</small><strong lang="ja">{term.term}</strong></div></div>
          <section className="evidenceExcerpt"><h3>{t("evidenceSentence")}</h3><p lang="ja"><HighlightedSentence text={term.sentence} term={term.term} /></p></section>
          <div className="pdfStage">{isPdf ? <iframe key={`${term.id}-${page}`} title={`${t("evidenceTitle")}: ${term.term}`} src={`${API_BASE}/api/documents/${document.id}/content#page=${page}&zoom=page-width`} /> : <div className="pdfNotice">{t("pdfUnavailable")}</div>}</div>
          <dl className="candidateFacts"><div><dt>{t("extractionScore")}</dt><dd>{formatExtractionScore(term.score)}</dd></div><div><dt>{t("frequency")}</dt><dd>{term.frequency}</dd></div><div><dt>{t("candidateType")}</dt><dd>{t("extractedResult")}</dd></div></dl>
        </div>
      </>}
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

  const loadDetail = async (documentId, termId) => {
    if (!documentId || !termId) {
      setSelectedId(null);
      setDetail(null);
      setHistory([]);
      return;
    }
    const reviewId = `${documentId}:${termId}`;
    setSelectedId(reviewId);
    setDetailLoading(true);
    try {
      const [termResponse, historyResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/reviewed-terms/${documentId}/${termId}`, { withCredentials: true }),
        axios.get(`${API_BASE}/api/reviewed-terms/${documentId}/${termId}/history`, { withCredentials: true })
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
        axios.get(`${API_BASE}/api/reviewed-terms`, { params, withCredentials: true }),
        axios.get(`${API_BASE}/api/reviewed-terms/summary`, { withCredentials: true })
      ]);
      const nextData = termsResponse.data;
      setData(nextData);
      setSummary(summaryResponse.data);
      const selectedItem = nextData.items.find((item) => `${item.documentId}:${item.id}` === selectedId);
      const nextItem = selectedItem ?? nextData.items[0] ?? null;
      if (!nextItem) await loadDetail(null, null);
      else if (!selectedItem || !detail) await loadDetail(nextItem.documentId, nextItem.id);
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
        `${API_BASE}/api/review-documents/${detail.documentId}/terms/${detail.id}/review`,
        { status: nextStatus, note, version: detail.reviewVersion },
        { withCredentials: true }
      );
      await loadList();
      if (nextStatus === status || status === "reviewed") await loadDetail(detail.documentId, detail.id);
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
          <span className="sectionEyebrow">{t("reviewedTerminologyEyebrow")}</span>
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
                key={`${term.documentId}:${term.id}`}
                className={selectedId === `${term.documentId}:${term.id}` ? "active" : ""}
                onClick={() => loadDetail(term.documentId, term.id)}
              >
                <span>
                  <strong lang="ja">{term.termText}</strong>
                  <small title={term.fileName}>{shortFileName(term.fileName)} · {t("pageShort", { pages: term.page ?? "—" })} · × {term.frequency}</small>
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


function ProgressOverlay({ t, fileCount = 0, uploadProgress = 100, analysisProgress = null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const uploading = uploadProgress < 100 && !analysisProgress;
  const analyzing = !uploading && Number.isFinite(Number(analysisProgress?.percent));
  const percent = uploading ? uploadProgress : (analyzing ? Number(analysisProgress.percent) : null);
  const title = uploading ? t("uploadingDocuments") : t("processing");
  const stageKey = analysisProgress?.stage ? `progressStage_${analysisProgress.stage}` : "";
  const detail = uploading
    ? `${uploadProgress}%`
    : (stageKey ? t(stageKey) : t("processingFiles", { count: fileCount }));
  const progressDetails = [
    analysisProgress?.fileName
      ? `${analysisProgress.fileIndex}/${analysisProgress.fileCount} · ${analysisProgress.fileName}`
      : null,
    Number.isFinite(Number(analysisProgress?.total)) && Number(analysisProgress.total) > 0
      ? `${analysisProgress.completed}/${analysisProgress.total}`
      : null
  ].filter(Boolean).join(" · ");
  return (
    <div className="progressOverlay" role="status" aria-live="polite" aria-label={t('processing')}>
      <div className="progressSpinner" aria-hidden="true" />
      <strong>{title}</strong>
      <p>{detail}</p>
      <div
        className={`progressBar ${percent === null ? "indeterminate" : "determinate"}`}
        role="progressbar"
        aria-label={title}
        aria-valuemin="0"
        aria-valuemax="100"
        {...(percent !== null ? { "aria-valuenow": percent } : {})}
      >
        {percent !== null && <span style={{ width: `${percent}%` }} />}
      </div>
      {percent !== null && <strong className="progressPercent">{percent}%</strong>}
      {!uploading && (
        <p>
          {progressDetails || t("processingDetail")}
        </p>
      )}
      <small>{t("elapsedSeconds", { count: elapsed })}</small>
    </div>
  );
}

function postExtraction(url, formData, { onUploadProgress, onAnalysisProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let cursor = 0;
    let pending = "";
    let result = null;
    let streamError = null;

    const requestError = (status, data) => {
      const error = new Error(data?.detail ?? data?.error ?? "Extraction failed");
      error.response = { status, data };
      return error;
    };

    const consume = (flush = false) => {
      pending += xhr.responseText.slice(cursor);
      cursor = xhr.responseText.length;
      const lines = pending.split(/\r?\n/);
      pending = flush ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "progress") onAnalysisProgress?.(event);
          if (event.type === "result") result = event.data;
          if (event.type === "error") streamError = requestError(event.status ?? 500, event.data ?? {});
        } catch {
          // A regular JSON error response is handled after the request finishes.
        }
      }
      if (flush && pending.trim()) {
        try {
          const event = JSON.parse(pending);
          if (event.type === "result") result = event.data;
          if (event.type === "error") streamError = requestError(event.status ?? 500, event.data ?? {});
        } catch { /* handled below */ }
      }
    };

    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/x-ndjson");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onUploadProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onprogress = () => consume(false);
    xhr.onload = () => {
      consume(true);
      if (streamError) return reject(streamError);
      if (result) return resolve(result);
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* use generic error */ }
      return reject(requestError(xhr.status || 500, data));
    };
    xhr.onerror = () => reject(requestError(0, {}));
    xhr.send(formData);
  });
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

async function sha256ForFile(file) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
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

function exportDocumentReviewCsv(reviewDocument, terms, t) {
  const rows = [
    [t("resultsTitle"), t("reviewStatusFilter"), t("extractionScore"), t("frequency"), t("sourcePage"), t("sourceDocument"), t("evidenceSentence"), t("reviewNote")],
    ...terms.map((term) => [
      term.term,
      formatReviewStatus(term.reviewStatus, t),
      formatExtractionScore(term.score),
      term.frequency,
      term.page,
      reviewDocument.fileName,
      term.sentence,
      term.reviewNote ?? ""
    ])
  ];
  const url = URL.createObjectURL(new Blob([`\ufeff${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${reviewDocument.fileName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_")}-review.csv`;
  link.click();
  URL.revokeObjectURL(url);
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

function formatExtractionScore(score) {
  const value = Number(score);
  return Number.isFinite(value) ? value.toFixed(4) : "—";
}

function getEvidenceText(term) {
  const text = term?.examples?.[0] ?? term?.sentence ?? "";
  const matchingFile = term?.files?.find((file) => text.startsWith(`${file}: `));
  return matchingFile ? text.slice(matchingFile.length + 2) : text;
}
