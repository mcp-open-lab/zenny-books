/**
 * File Type Constants
 * Centralized file type definitions for uploads across the application
 */

// Supported MIME types
export const ALLOWED_MIME_TYPES = {
  // Images
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],

  // Documents
  "application/pdf": [".pdf"],

  // Data files (Bank Statements)
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel": [".xls"],
} as const;

// File Formats
export const FILE_FORMATS = [
  "pdf",
  "csv",
  "xlsx",
  "xls",
  "jpg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
] as const;
export type FileFormat = (typeof FILE_FORMATS)[number];

// Source Formats
export const SOURCE_FORMATS = ["pdf", "csv", "xlsx", "images"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

// File extensions for accept attribute
export const IMAGE_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.heic,.heif";
export const DOCUMENT_EXTENSIONS = ".pdf";
export const DATA_EXTENSIONS = ".csv,.xlsx,.xls";

// Combined extensions for different upload types
export const RECEIPT_FILE_EXTENSIONS = `${IMAGE_EXTENSIONS},${DOCUMENT_EXTENSIONS}`;
export const BANK_STATEMENT_EXTENSIONS = `${IMAGE_EXTENSIONS},${DOCUMENT_EXTENSIONS},${DATA_EXTENSIONS}`;
export const ALL_UPLOAD_EXTENSIONS = `${IMAGE_EXTENSIONS},${DOCUMENT_EXTENSIONS},${DATA_EXTENSIONS}`;

// Max file sizes
export const MAX_FILE_SIZE = "16MB";
export const MAX_FILE_COUNT_SINGLE = 1;
export const MAX_FILE_COUNT_BATCH = 50;

// Helper function to get MIME type from URL
export function getMimeTypeFromUrl(url: string): string {
  const extension = url.split(".").pop()?.toLowerCase();

  for (const [mimeType, extensions] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (extensions.some((ext) => ext === `.${extension}`)) {
      return mimeType;
    }
  }

  // Default fallback
  return "image/jpeg";
}

// Helper function to get file format from URL
export function getFileFormatFromUrl(url: string): string {
  const extension = url.split(".").pop()?.toLowerCase() || "";
  const formatMap: Record<string, string> = {
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    heic: "heic",
    heif: "heif",
    gif: "gif",
    pdf: "pdf",
    csv: "csv",
    xlsx: "xlsx",
    xls: "xls",
  };
  return formatMap[extension] || "jpg";
}

