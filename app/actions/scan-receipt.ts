"use server";

import { db } from "@/lib/db";
import {
  receipts,
  documents,
  importBatches,
  importBatchItems,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getUserSettings, getUserSettingsByUserId } from "@/app/actions/user-settings";
import { createPublicAction } from "@/lib/safe-action";
import { devLogger } from "@/lib/dev-logger";
import { ReceiptProcessor } from "@/lib/import/processors/receipt-processor";
import { calculateFileHash } from "@/lib/utils/file-hash";
import { getMimeTypeFromUrl, getFileFormatFromUrl } from "@/lib/constants";
import { ActivityLogger } from "@/lib/import/activity-logger";

function getFileName(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split("/").pop();
    return fileName || null;
  } catch {
    return null;
  }
}

async function scanReceiptHandler(
  imageUrl: string,
  batchId?: string,
  userId?: string,
  fileName?: string
) {
  const authResult = userId ? { userId } : await auth();
  const finalUserId = userId || authResult.userId;
  if (!finalUserId) throw new Error("Unauthorized");

  // Get user settings for location context
  // Use direct function when userId is provided (background jobs), otherwise use authenticated action
  const settings = userId 
    ? await getUserSettingsByUserId(finalUserId)
    : await getUserSettings();
  const country = settings?.country || "US";
  const currency = settings?.currency || (country === "CA" ? "CAD" : "USD");
  const province = settings?.province || null;
  const defaultValues = settings?.defaultValues || {};

  let batchItem: { id: string } | undefined;
  const startTime = Date.now();

  try {
    devLogger.info("Processing receipt", {
      userId: finalUserId,
      imageUrl,
      country,
      currency,
    });

    // Use provided fileName or get from batch item, fallback only for single uploads
    let displayFileName = fileName;
    if (!displayFileName && batchId) {
      const existingItem = await db
        .select({ fileName: importBatchItems.fileName })
        .from(importBatchItems)
        .where(
          and(
            eq(importBatchItems.batchId, batchId),
            eq(importBatchItems.fileUrl, imageUrl)
          )
        )
        .limit(1);
      
      if (existingItem.length > 0 && existingItem[0].fileName) {
        displayFileName = existingItem[0].fileName;
      }
    }
    
    // Fallback only for non-batch uploads (single file uploads)
    if (!displayFileName) {
      displayFileName = getFileName(imageUrl) || "receipt.jpg";
    }

    // Log AI extraction start
    if (batchId && batchItem) {
      await ActivityLogger.aiExtractionStart(batchId, batchItem.id, displayFileName);
    }

    // Check for duplicate file first
    const fileHash = await calculateFileHash(imageUrl);
    const existingDocument = await db
      .select()
      .from(documents)
      .where(
        and(eq(documents.userId, finalUserId), eq(documents.fileHash, fileHash))
      )
      .limit(1);

    if (existingDocument.length > 0) {
      if (batchId && batchItem) {
        await ActivityLogger.duplicateDetected(
          batchId,
          batchItem.id,
          displayFileName,
          "exact_file_hash"
        );
      }
      throw new Error(
        `Duplicate file detected. This file has already been uploaded (${
          existingDocument[0].fileName || "previous upload"
        })`
      );
    }

    // Extract data FIRST before creating any DB records
    const processor = new ReceiptProcessor({
      userId: finalUserId,
      country,
      province,
      currency,
    });

    const extractedData = await processor.processDocument(imageUrl, displayFileName);

    // Log AI extraction complete
    if (batchId && batchItem) {
      const extractionDuration = Date.now() - startTime;
      await ActivityLogger.aiExtractionComplete(batchId, batchItem.id, displayFileName, extractionDuration, {
        merchantName: extractedData.merchantName || undefined,
        amount: extractedData.totalAmount || undefined,
      });

      // Log categorization start
      await ActivityLogger.aiCategorizationStart(batchId, batchItem.id, displayFileName);
    }

    // Only create document record AFTER successful extraction
    const fileFormat = getFileFormatFromUrl(imageUrl);
    const mimeType = getMimeTypeFromUrl(imageUrl);

    const [document] = await db
      .insert(documents)
      .values({
        userId: finalUserId,
        documentType: "receipt",
        fileFormat,
        fileName: displayFileName,
        fileUrl: imageUrl,
        mimeType,
        fileHash,
        status: "extracted", // Set to extracted immediately since we already succeeded
        extractionMethod: "ai_gemini",
        extractedAt: new Date(),
        importBatchId: batchId || null,
      })
      .returning();

    // Create or update batch item if batchId provided
    if (batchId) {
      const existingItem = await db
        .select()
        .from(importBatchItems)
        .where(
          and(
            eq(importBatchItems.batchId, batchId),
            eq(importBatchItems.fileUrl, imageUrl)
          )
        )
        .limit(1);

      if (existingItem.length > 0) {
        const [updated] = await db
          .update(importBatchItems)
          .set({ documentId: document.id, status: "processing" })
          .where(eq(importBatchItems.id, existingItem[0].id))
          .returning();
        batchItem = updated;
      } else {
        const [newItem] = await db
          .insert(importBatchItems)
          .values({
            batchId,
            documentId: document.id,
            fileName: displayFileName,
            fileUrl: imageUrl,
            status: "processing",
            order: 0,
            retryCount: 0,
          })
          .returning();
        batchItem = newItem;
      }
    }

    // Apply user defaults where extraction returned null
    const paymentMethod =
      extractedData.paymentMethod || defaultValues.paymentMethod || null;
    const businessPurpose = defaultValues.businessPurpose || null;
    const isBusinessExpense =
      defaultValues.isBusinessExpense !== null &&
      defaultValues.isBusinessExpense !== undefined
        ? String(defaultValues.isBusinessExpense)
        : null;

    // Log categorization complete
    if (batchId && batchItem) {
      await ActivityLogger.aiCategorizationComplete(
        batchId,
        batchItem.id,
        displayFileName,
        extractedData.category || "Uncategorized",
        "ai",
        extractedData.businessId ? "Business" : undefined
      );
    }

    // Save to database with categorization results (including businessId)
    await db.insert(receipts).values({
      documentId: document.id,
      userId: finalUserId,
      imageUrl,
      merchantName: extractedData.merchantName,
      date: extractedData.date,
      totalAmount: extractedData.totalAmount?.toString() || null,
      subtotal: extractedData.subtotal?.toString() || null,
      taxAmount: extractedData.taxAmount?.toString() || null,
      gstAmount: extractedData.gstAmount?.toString() || null,
      hstAmount: extractedData.hstAmount?.toString() || null,
      pstAmount: extractedData.pstAmount?.toString() || null,
      salesTaxAmount: extractedData.salesTaxAmount?.toString() || null,
      tipAmount: extractedData.tipAmount?.toString() || null,
      discountAmount: null, // Not currently extracted
      category: extractedData.category,
      categoryId: extractedData.categoryId,
      businessId: extractedData.businessId || null,
      description: extractedData.description,
      paymentMethod,
      businessPurpose,
      isBusinessExpense,
      country,
      province: extractedData.province,
      currency,
      status: "needs_review",
    });

    // Update batch item if part of batch
    if (batchId && batchItem) {
      const totalDuration = Date.now() - startTime;
      await db
        .update(importBatchItems)
        .set({ status: "completed" })
        .where(eq(importBatchItems.id, batchItem.id));
      
      // Log item completion
      await ActivityLogger.itemCompleted(batchId, batchItem.id, displayFileName, totalDuration);
    }

    revalidatePath("/app");
    devLogger.info("Receipt processed successfully", {
      userId: finalUserId,
      documentId: document.id,
    });
    return { success: true };
  } catch (error) {
    
    // Update batch item on error
    if (batchId && typeof batchItem !== "undefined") {
      try {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await db
          .update(importBatchItems)
          .set({
            status: "failed",
            errorMessage,
          })
          .where(eq(importBatchItems.id, batchItem.id));
        
        // Log failure
        await ActivityLogger.itemFailed(batchId, batchItem.id, fileName, errorMessage);
      } catch (batchError) {
        devLogger.error("Failed to update batch item on error", {
          batchError,
          originalError: error,
        });
      }
    }

    throw new Error(
      `Failed to scan receipt: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Wrap with automatic logging
// Note: This action accepts optional userId for server-side calls from queue processors
export const scanReceipt = createPublicAction("scanReceipt", scanReceiptHandler, {
  requireAuth: true, // Still requires auth, but allows optional userId parameter
});

// Export handler for direct server-side calls (e.g., from queue processors)
// This bypasses the Server Action wrapper which requires Next.js request context
export { scanReceiptHandler };
