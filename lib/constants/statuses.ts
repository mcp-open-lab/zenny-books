/**
 * Status Constants
 * Centralized status enums for all entities in the application
 */

// Receipt Statuses
export const RECEIPT_STATUSES = ["needs_review", "approved"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

// Document Statuses
export const DOCUMENT_STATUSES = [
  "pending",
  "processing",
  "extracted",
  "needs_review",
  "completed",
  "failed",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// Import Batch Statuses
export const BATCH_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

// Import Batch Item Statuses
export const BATCH_ITEM_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "duplicate",
  "skipped",
] as const;
export type BatchItemStatus = (typeof BATCH_ITEM_STATUSES)[number];

// Invoice Statuses
export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// LLM Log Statuses
export const LLM_LOG_STATUSES = ["success", "failed"] as const;
export type LlmLogStatus = (typeof LLM_LOG_STATUSES)[number];

