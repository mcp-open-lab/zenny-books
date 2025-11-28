/**
 * Process a single batch item
 * Handles receipt/invoice/statement processing based on import type
 */

import { db } from "@/lib/db";
import { importBatchItems, documents, receipts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
// Import the handler directly to avoid Server Action wrapper issues in queue context
// We'll need to call the internal logic directly
import { scanReceiptHandler } from "@/app/actions/scan-receipt";
import { processBankStatement } from "@/lib/import/process-bank-statement";
import type {
  ImportJobPayload,
  JobProcessingResult,
} from "@/lib/import/queue-types";
import { devLogger } from "@/lib/dev-logger";
import { updateBatchStats } from "@/lib/import/batch-tracker";
import {
  checkBatchItemDuplicate,
  markBatchItemAsDuplicate,
} from "@/lib/import/duplicate-detector";

/**
 * Process a single batch item based on import type
 */
export async function processBatchItem(
  payload: ImportJobPayload
): Promise<JobProcessingResult> {
  const { batchId, batchItemId, fileUrl, userId, importType } = payload;

  devLogger.info("Processing batch item", {
    batchItemId,
    fileName: payload.fileName,
    importType,
    fileFormat: payload.fileFormat,
  });

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

    // For "mixed" type, detect PDFs as bank statements
    const isPdf = payload.fileFormat === "pdf";
    const effectiveImportType =
      importType === "mixed" && isPdf ? "bank_statements" : importType;

    if (effectiveImportType === "receipts") {
      // Call handler directly to avoid Server Action wrapper issues in queue context
      await scanReceiptHandler(fileUrl, batchId, userId, payload.fileName);

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
    } else if (effectiveImportType === "bank_statements") {
      // Process bank statement using AI orchestrator
      const result = await processBankStatement(
        fileUrl,
        payload.fileName,
        batchId,
        userId,
        payload.currency,
        payload.statementType
      );

      documentId = result.documentId;

      devLogger.info("Bank statement processed", {
        batchItemId,
        documentId,
        transactionCount: result.transactionCount,
      });
    } else {
      // Mixed - non-PDF files default to receipts
      await scanReceiptHandler(fileUrl, batchId, userId, payload.fileName);

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

    // 4. Check for duplicates after extraction
    if (documentId && effectiveImportType === "receipts") {
      const duplicateMatch = await checkBatchItemDuplicate(
        batchItemId,
        userId,
        documentId
      );

      if (duplicateMatch) {
        // Mark as duplicate instead of completed
        await markBatchItemAsDuplicate(
          batchItemId,
          duplicateMatch.documentId,
          duplicateMatch.matchType
        );

        devLogger.info("Duplicate detected", {
          batchItemId,
          duplicateOfDocumentId: duplicateMatch.documentId,
          matchType: duplicateMatch.matchType,
          confidence: duplicateMatch.confidence,
        });

        // Update batch stats and return early
        await updateBatchStats(batchId);

        return {
          success: true,
          batchItemId,
          documentId,
          isDuplicate: true,
          duplicateOfDocumentId: duplicateMatch.documentId,
        };
      }
    }

    // 5. Update batch item to completed (not a duplicate)
    await db
      .update(importBatchItems)
      .set({
        status: "completed",
        documentId: documentId || null,
      })
      .where(eq(importBatchItems.id, batchItemId));

    // 6. Update batch counts (will handle completion check)
    await updateBatchStats(batchId);

    return {
      success: true,
      batchItemId,
      documentId,
    };
  } catch (error) {
    let errorMessage = "Unknown error";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    }

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
