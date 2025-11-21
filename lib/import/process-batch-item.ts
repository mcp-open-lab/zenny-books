/**
 * Process a single batch item
 * Handles receipt/invoice/statement processing based on import type
 */

import { db } from "@/lib/db";
import { importBatchItems, documents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
// Import the handler directly to avoid Server Action wrapper issues in queue context
// We'll need to call the internal logic directly
import { scanReceiptHandler } from "@/app/actions/scan-receipt";
import type {
  ImportJobPayload,
  JobProcessingResult,
} from "@/lib/import/queue-types";
import { devLogger } from "@/lib/dev-logger";
import { updateBatchStats } from "@/lib/import/batch-tracker";

/**
 * Process a single batch item based on import type
 */
export async function processBatchItem(
  payload: ImportJobPayload
): Promise<JobProcessingResult> {
  const { batchId, batchItemId, fileUrl, userId, importType } = payload;

  try {
    // 1. Update batch item status to processing
    await db
      .update(importBatchItems)
      .set({
        status: "processing",
        processedAt: new Date(),
      })
      .where(eq(importBatchItems.id, batchItemId));

    // 2. Update batch stats (will set batch status to processing if needed)
    await updateBatchStats(batchId);

    // 3. Process based on import type
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

    // 4. Update batch item to completed
    await db
      .update(importBatchItems)
      .set({
        status: "completed",
        documentId: documentId || null,
      })
      .where(eq(importBatchItems.id, batchItemId));

    // 5. Update batch counts (will handle completion check)
    await updateBatchStats(batchId);

    return {
      success: true,
      batchItemId,
      documentId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // 4. Update batch item to failed
    await db
      .update(importBatchItems)
      .set({
        status: "failed",
        errorMessage,
        errorCode: "PROCESSING_ERROR",
      })
      .where(eq(importBatchItems.id, batchItemId));

    // 5. Update batch counts
    await updateBatchStats(batchId);

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
