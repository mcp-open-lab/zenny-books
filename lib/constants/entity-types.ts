/**
 * Entity Type Constants
 * Centralized entity type definitions across the application
 */

// Document Types
export const DOCUMENT_TYPES = [
  "receipt",
  "bank_statement",
  "invoice",
  "expense_report",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// Entity Types (for operations, logs, etc.)
export const ENTITY_TYPES = [
  "receipt",
  "transaction",
  "bank_transaction",
  "credit_card",
  "batch",
  "document",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// Import Types
export const IMPORT_TYPES = [
  "receipts",
  "bank_statements",
  "invoices",
  "mixed",
] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

// Extraction Methods
export const EXTRACTION_METHODS = [
  "ai_gemini",
  "ocr",
  "csv_parser",
  "excel_parser",
  "manual",
] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

// LLM Prompt Types
export const PROMPT_TYPES = ["extraction", "categorization", "mapping"] as const;
export type PromptType = (typeof PROMPT_TYPES)[number];

// Activity Types
export const ACTIVITY_TYPES = [
  "batch_created",
  "file_uploaded",
  "ai_extraction_start",
  "ai_extraction_complete",
  "categorization_start",
  "categorization_complete",
  "duplicate_detected",
  "item_completed",
  "item_failed",
  "batch_completed",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

