import { db } from "@/lib/db";
import { importBatches, importBatchItems } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type {
  BatchStatusSummary,
  BatchItemStatus,
  BatchProgressSummary,
  ImportBatch,
  ImportBatchItem,
  NewImportBatch,
  NewImportBatchItem,
} from "@/lib/import/batch-types";

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

/**
 * List batches for a user with pagination
 * Uses cursor-based pagination for better performance
 */
export async function listBatches(
  userId: string,
  options?: {
    limit?: number;
    cursor?: string;
    status?: string;
  }
): Promise<{
  batches: ImportBatch[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const limit = options?.limit ?? 20;
  const cursor = options?.cursor;
  const statusFilter = options?.status;

  const conditions = [eq(importBatches.userId, userId)];

  if (statusFilter) {
    conditions.push(eq(importBatches.status, statusFilter));
  }

  if (cursor) {
    const cursorBatch = await db
      .select({ createdAt: importBatches.createdAt })
      .from(importBatches)
      .where(eq(importBatches.id, cursor))
      .limit(1);

    if (cursorBatch.length > 0) {
      conditions.push(
        sql`${importBatches.createdAt} < ${cursorBatch[0].createdAt}`
      );
    }
  }

  const batches = await db
    .select()
    .from(importBatches)
    .where(and(...conditions))
    .orderBy(desc(importBatches.createdAt))
    .limit(limit + 1);

  const hasMore = batches.length > limit;
  const results = hasMore ? batches.slice(0, limit) : batches;
  const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : null;

  return {
    batches: results,
    nextCursor,
    hasMore,
  };
}

/**
 * Recalculate and update batch statistics based on current item statuses.
 * This is idempotent and self-healing.
 */
export async function updateBatchStats(batchId: string): Promise<void> {
  // Fetch all items to get accurate counts
  const items = await db
    .select({ status: importBatchItems.status })
    .from(importBatchItems)
    .where(eq(importBatchItems.batchId, batchId));

  const total = items.length;
  const successful = items.filter((i) => i.status === "completed").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const duplicates = items.filter((i) => i.status === "duplicate").length;
  // Processed = anything in a final state
  const processed = successful + failed + duplicates;

  const isComplete = processed === total && total > 0;
  // If we have processed any, or if any are currently processing (we can't see 'processing' status in the aggregates easily without checking items), set to processing.
  // Actually, if processed > 0 and not complete, it is processing.
  // Also check if any items are explicitly "processing" to set batch to "processing" even if 0 processed.
  const hasProcessingItems = items.some((i) => i.status === "processing");
  const isProcessing = (processed > 0 || hasProcessingItems) && !isComplete;

  await db
    .update(importBatches)
    .set({
      processedFiles: processed,
      successfulFiles: successful,
      failedFiles: failed,
      duplicateFiles: duplicates,
      status: isComplete
        ? "completed"
        : isProcessing
        ? "processing"
        : "pending",
      completedAt: isComplete ? new Date() : null,
      // Set startedAt if processing has begun and it wasn't set
      startedAt: isProcessing
        ? sql`COALESCE(${importBatches.startedAt}, NOW())`
        : undefined,
      updatedAt: new Date(),
    })
    .where(eq(importBatches.id, batchId));
}

