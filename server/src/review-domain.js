export const REVIEW_STATUSES = ["unreviewed", "approved", "rejected", "uncertain"];

export function normalizeTerm(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

export function isReviewStatus(value) {
  return REVIEW_STATUSES.includes(value);
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
