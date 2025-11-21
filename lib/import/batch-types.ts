/**
 * Batch import types derived from Drizzle schema
 *
 * Uses Drizzle's type inference ($inferSelect, $inferInsert) to avoid duplication
 * and ensure type safety. The schema is the single source of truth.
 *
 * @see https://orm.drizzle.team/docs/overview
 */

import type { importBatches, importBatchItems } from "@/lib/db/schema";

/**
 * Base batch type from Drizzle schema (SELECT queries)
 * Use this for full batch records from the database
 */
export type ImportBatch = typeof importBatches.$inferSelect;

/**
 * Base batch item type from Drizzle schema (SELECT queries)
 * Use this for full batch item records from the database
 */
export type ImportBatchItem = typeof importBatchItems.$inferSelect;

/**
 * Type for inserting new batches (INSERT queries)
 */
export type NewImportBatch = typeof importBatches.$inferInsert;

/**
 * Type for inserting new batch items (INSERT queries)
 */
export type NewImportBatchItem = typeof importBatchItems.$inferInsert;

/**
 * Batch status summary with computed fields
 * Extends the base Drizzle type with calculated properties
 */
export type BatchStatusSummary = Omit<ImportBatch, "errors" | "id" | "userId"> & {
  batchId: string;
  completionPercentage: number;
  remainingFiles: number;
  errors: string[] | null; // Parsed from JSON string
};

/**
 * Batch item status - subset of fields from Drizzle schema
 * This matches the select query in getBatchItemsStatus
 */
export type BatchItemStatus = Pick<
  ImportBatchItem,
  "id" | "fileName" | "status" | "errorMessage" | "retryCount" | "order"
>;

/**
 * Batch progress summary for UI display
 * Computed type derived from BatchStatusSummary
 */
export interface BatchProgressSummary {
  percentage: number;
  status: string;
  processed: number;
  total: number;
  successful: number;
  failed: number;
  duplicates: number;
  remaining: number;
  isComplete: boolean;
  estimatedCompletion: Date | null;
}
