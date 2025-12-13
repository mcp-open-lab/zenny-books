"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  documents,
  importBatchItems,
  receipts,
} from "@/lib/db/schema";
import { ReceiptProcessor } from "@/lib/import/processors/receipt-processor";
import { calculateFileHash } from "@/lib/utils/file-hash";
import { getFileFormatFromUrl, getMimeTypeFromUrl } from "@/lib/constants";
import { ActivityLogger } from "@/lib/import/activity-logger";
import { getUserSettings, getUserSettingsByUserId } from "@/app/actions/user-settings";
import { logError, logInfo } from "@/lib/observability/log";
import { DuplicateFileError } from "@/lib/errors";
import { assertUserScope } from "@/lib/db/helpers";

export type ProcessReceiptResult = {
  documentId: string;
  batchItemId?: string;
};

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

export async function processReceipt({
  imageUrl,
  batchId,
  userId,
  fileName,
}: {
  imageUrl: string;
  batchId?: string;
  userId?: string;
  fileName?: string;
}): Promise<ProcessReceiptResult> {
  const authResult = userId ? { userId } : await auth();
  const finalUserId = assertUserScope(userId ?? authResult?.userId ?? undefined);

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

    if (!displayFileName) {
      displayFileName = getFileName(imageUrl) || "receipt.jpg";
    }

    // Check duplicate by hash
    const fileHash = await calculateFileHash(imageUrl);
    const existingDocument = await db
      .select()
      .from(documents)
      .where(
        and(eq(documents.userId, finalUserId), eq(documents.fileHash, fileHash))
      )
      .limit(1);

    if (existingDocument.length > 0) {
      throw new DuplicateFileError(
        `Duplicate file detected. This file has already been uploaded (${existingDocument[0].fileName || "previous upload"})`,
        "This file was already uploaded."
      );
    }

    const processor = new ReceiptProcessor({
      userId: finalUserId,
      country,
      province,
      currency,
    });

    const extractedData = await processor.processDocument(
      imageUrl,
      displayFileName
    );

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
        status: "extracted",
        extractionMethod: "ai_gemini",
        extractedAt: new Date(),
        importBatchId: batchId || null,
      })
      .returning();

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

    const paymentMethod =
      extractedData.paymentMethod || defaultValues.paymentMethod || null;
    const businessPurpose = defaultValues.businessPurpose || null;
    const isBusinessExpense =
      defaultValues.isBusinessExpense !== null &&
      defaultValues.isBusinessExpense !== undefined
        ? String(defaultValues.isBusinessExpense)
        : null;

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
      discountAmount: null,
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

    if (batchId && batchItem) {
      const totalDuration = Date.now() - startTime;
      await db
        .update(importBatchItems)
        .set({ status: "completed" })
        .where(eq(importBatchItems.id, batchItem.id));
      await ActivityLogger.itemCompleted(
        batchId,
        batchItem.id,
        displayFileName,
        totalDuration
      );
    }

    logInfo("Receipt processed successfully", {
      userId: finalUserId,
      documentId: document.id,
    });

    return {
      documentId: document.id,
      batchItemId: batchItem?.id,
    };
  } catch (error) {
    if (batchId && typeof batchItem !== "undefined") {
      try {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await db
          .update(importBatchItems)
          .set({
            status: "failed",
            errorMessage,
          })
          .where(eq(importBatchItems.id, batchItem.id));

        const item = await db
          .select({ fileName: importBatchItems.fileName })
          .from(importBatchItems)
          .where(eq(importBatchItems.id, batchItem.id))
          .limit(1);
        const errorFileName =
          item[0]?.fileName || getFileName(imageUrl) || "receipt.jpg";

        await ActivityLogger.itemFailed(
          batchId,
          batchItem.id,
          errorFileName,
          errorMessage
        );
      } catch (batchError) {
        logError("Failed to update batch item on error", batchError, {
          originalError: error,
        });
      }
    }

    logError("Failed to process receipt", error, { userId: userId || null });
    throw error;
  }
}


