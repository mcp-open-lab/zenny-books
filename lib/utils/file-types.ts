import { ALLOWED_MIME_TYPES } from "@/lib/constants";

export function isPdf(fileNameOrMime: string): boolean {
  return fileNameOrMime.toLowerCase().includes("pdf") || fileNameOrMime.toLowerCase().endsWith(".pdf");
}

export function isSpreadsheet(fileNameOrMime: string): boolean {
  const lower = fileNameOrMime.toLowerCase();
  return (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.includes("csv") ||
    lower.includes("excel")
  );
}

export function isImage(fileNameOrMime: string): boolean {
  const lower = fileNameOrMime.toLowerCase();
  return lower.includes("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(lower);
}

export function isAllowedMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, mimeType);
}


