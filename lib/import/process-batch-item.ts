/**
 * Process a single batch item
 * Handles receipt/invoice/statement processing based on import type
 */

import { db } from "@/lib/db";
import { importBatchItems, importBatches, documents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
// Import the handler directly to avoid Server Action wrapper issues in queue context
// We'll need to call the internal logic directly
import { scanReceiptHandler } from "@/app/actions/scan-receipt";
import type { ImportJobPayload, JobProcessingResult } from "@/lib/import/queue-types";
import { devLogger } from "@/lib/dev-logger";

/**
 * Process a single batch item based on import type
 */
export async function processBatchItem(
  payload: ImportJobPayload
): Promise<JobProcessingResult> {
  const { batchId, batchItemId, fileUrl, fileName, fileFormat, userId, importType } = payload;

  try {
    // Update batch item status to processing
    await db
      .update(importBatchItems)
      .set({
        status: "processing",
        processedAt: new Date(),
      })
      .where(eq(importBatchItems.id, batchItemId));

    // Update batch status to processing if not already
    const batch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, batchId))
      .limit(1);

    if (batch.length > 0 && batch[0].status === "pending") {
      await db
        .update(importBatches)
        .set({
          status: "processing",
          startedAt: new Date(),
        })
        .where(eq(importBatches.id, batchId));
    }

    // Process based on import type
    let documentId: string | undefined;

    if (importType === "receipts") {
      // Call handler directly to avoid Server Action wrapper issues in queue context
      await scanReceiptHandler(fileUrl, batchId, userId);
      
      // Find the created document
      const createdDoc = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.fileUrl, fileUrl),
            eq(documents.userId, userId),
            eq(documents.importBatchId, batchId)
          )
        )
        .orderBy(documents.createdAt)
        .limit(1);

      if (createdDoc.length > 0) {
        documentId = createdDoc[0].id;
      }
    } else if (importType === "bank_statements") {
      // TODO: Implement bank statement processing
      throw new Error("Bank statement processing not yet implemented");
    } else if (importType === "invoices") {
      // TODO: Implement invoice processing
      throw new Error("Invoice processing not yet implemented");
    } else {
      // Mixed - try to detect type from file
      // For now, treat as receipt
      await scanReceiptHandler(fileUrl, batchId, userId);
      
      const createdDoc = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.fileUrl, fileUrl),
            eq(documents.userId, userId),
            eq(documents.importBatchId, batchId)
          )
        )
        .orderBy(documents.createdAt)
        .limit(1);

      if (createdDoc.length > 0) {
        documentId = createdDoc[0].id;
      }
    }

    // Update batch item to completed
    await db
      .update(importBatchItems)
      .set({
        status: "completed",
        documentId: documentId || null,
      })
      .where(eq(importBatchItems.id, batchItemId));

    // Update batch counts
    const updatedBatch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, batchId))
      .limit(1);

    if (updatedBatch.length > 0) {
      const newProcessedFiles = (updatedBatch[0].processedFiles || 0) + 1;
      const newSuccessfulFiles = (updatedBatch[0].successfulFiles || 0) + 1;
      const isComplete = newProcessedFiles >= updatedBatch[0].totalFiles;

      await db
        .update(importBatches)
        .set({
          processedFiles: newProcessedFiles,
          successfulFiles: newSuccessfulFiles,
          status: isComplete ? "completed" : "processing",
          completedAt: isComplete ? new Date() : null,
        })
        .where(eq(importBatches.id, batchId));
    }

    return {
      success: true,
      batchItemId,
      documentId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Update batch item to failed
    await db
      .update(importBatchItems)
      .set({
        status: "failed",
        errorMessage,
        errorCode: "PROCESSING_ERROR",
      })
      .where(eq(importBatchItems.id, batchItemId));

    // Update batch counts
    const updatedBatch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, batchId))
      .limit(1);

    if (updatedBatch.length > 0) {
      const newProcessedFiles = (updatedBatch[0].processedFiles || 0) + 1;
      const newFailedFiles = (updatedBatch[0].failedFiles || 0) + 1;
      const isComplete = newProcessedFiles >= updatedBatch[0].totalFiles;

      await db
        .update(importBatches)
        .set({
          processedFiles: newProcessedFiles,
          failedFiles: newFailedFiles,
          status: isComplete ? "completed" : "processing",
          completedAt: isComplete ? new Date() : null,
        })
        .where(eq(importBatches.id, batchId));
    }

    devLogger.error("Failed to process batch item", {
      batchItemId,
      error: errorMessage,
    });

    return {
      success: false,
      batchItemId,
      error: errorMessage,
      errorCode: "PROCESSING_ERROR",
    };
  }
}

