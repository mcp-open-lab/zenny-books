import { db } from "@/lib/db";
import { importBatches, importBatchItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type {
  BatchStatusSummary,
  BatchItemStatus,
  BatchProgressSummary,
  ImportBatch,
  ImportBatchItem,
  NewImportBatch,
  NewImportBatchItem,
} from "./batch-types";

export type {
  BatchStatusSummary,
  BatchItemStatus,
  BatchProgressSummary,
  ImportBatch,
  ImportBatchItem,
  NewImportBatch,
  NewImportBatchItem,
};

/**
 * Get comprehensive batch status with summary statistics
 */
export async function getBatchStatusSummary(
  batchId: string,
  userId: string
): Promise<BatchStatusSummary> {
  const batch = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId)))
    .limit(1);

  if (batch.length === 0) {
    throw new Error("Batch not found or unauthorized");
  }

  const batchData = batch[0];
  const completionPercentage =
    batchData.totalFiles > 0
      ? Math.round((batchData.processedFiles / batchData.totalFiles) * 100)
      : 0;

  const remainingFiles = batchData.totalFiles - batchData.processedFiles;

  return {
    batchId: batchData.id,
    status: batchData.status,
    completionPercentage,
    totalFiles: batchData.totalFiles,
    processedFiles: batchData.processedFiles,
    successfulFiles: batchData.successfulFiles,
    failedFiles: batchData.failedFiles,
    duplicateFiles: batchData.duplicateFiles,
    remainingFiles,
    startedAt: batchData.startedAt,
    completedAt: batchData.completedAt,
    estimatedCompletionAt: batchData.estimatedCompletionAt,
    errors: batchData.errors ? JSON.parse(batchData.errors) : null,
    importType: batchData.importType,
    sourceFormat: batchData.sourceFormat,
    createdAt: batchData.createdAt,
    updatedAt: batchData.updatedAt,
  };
}

/**
 * Get detailed status of all items in a batch
 */
export async function getBatchItemsStatus(
  batchId: string,
  userId: string
): Promise<BatchItemStatus[]> {
  // Verify batch belongs to user
  const batch = await db
    .select()
    .from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId)))
    .limit(1);

  if (batch.length === 0) {
    throw new Error("Batch not found or unauthorized");
  }

  const items = await db
    .select({
      id: importBatchItems.id,
      fileName: importBatchItems.fileName,
      status: importBatchItems.status,
      errorMessage: importBatchItems.errorMessage,
      retryCount: importBatchItems.retryCount,
      order: importBatchItems.order,
    })
    .from(importBatchItems)
    .where(eq(importBatchItems.batchId, batchId))
    .orderBy(importBatchItems.order);

  // Type is automatically inferred from the select query above
  return items;
}

/**
 * Calculate estimated completion time based on processing rate
 */
export function calculateEstimatedCompletion(
  batch: BatchStatusSummary
): Date | null {
  if (!batch.startedAt || batch.processedFiles === 0) {
    return null;
  }

  const elapsedMs = Date.now() - batch.startedAt.getTime();
  const filesPerMs = batch.processedFiles / elapsedMs;
  const remainingMs = batch.remainingFiles / filesPerMs;

  return new Date(Date.now() + remainingMs);
}

/**
 * Check if batch is complete (all files processed)
 */
export function isBatchComplete(batch: BatchStatusSummary): boolean {
  return (
    batch.status === "completed" ||
    batch.processedFiles >= batch.totalFiles
  );
}

/**
 * Check if batch has failed items that can be retried
 */
export async function hasRetryableItems(
  batchId: string,
  userId: string
): Promise<boolean> {
  const items = await getBatchItemsStatus(batchId, userId);
  return items.some(
    (item) => item.status === "failed" && item.retryCount < 3
  );
}

/**
 * Get batch progress summary for UI display
 */
export async function getBatchProgress(
  batchId: string,
  userId: string
): Promise<BatchProgressSummary> {
  const batch = await getBatchStatusSummary(batchId, userId);
  const estimatedCompletion = calculateEstimatedCompletion(batch);

  return {
    percentage: batch.completionPercentage,
    status: batch.status,
    processed: batch.processedFiles,
    total: batch.totalFiles,
    successful: batch.successfulFiles,
    failed: batch.failedFiles,
    duplicates: batch.duplicateFiles,
    remaining: batch.remainingFiles,
    isComplete: isBatchComplete(batch),
    estimatedCompletion,
  };
}

