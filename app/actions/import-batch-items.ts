"use server";

import { db } from "@/lib/db";
import { importBatchItems, importBatches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createAuthenticatedAction } from "@/lib/safe-action";
import { z } from "zod";
import { enqueueBatchItem } from "@/lib/import/queue-sender";
import type { ImportJobPayload } from "@/lib/import/queue-types";

const createBatchItemSchema = z.object({
  batchId: z.string(),
  fileName: z.string(),
  fileUrl: z.string().optional(),
  fileSizeBytes: z.number().int().optional(),
  order: z.number().int().min(0),
});

export const createBatchItem = createAuthenticatedAction(
  "createBatchItem",
  async (userId, input: z.infer<typeof createBatchItemSchema>) => {
    const validated = createBatchItemSchema.parse(input);

    const batch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, validated.batchId))
      .limit(1);

    if (batch.length === 0 || batch[0].userId !== userId) {
      throw new Error("Batch not found or unauthorized");
    }

    const item = await db
      .insert(importBatchItems)
      .values({
        batchId: validated.batchId,
        fileName: validated.fileName,
        fileUrl: validated.fileUrl || null,
        fileSizeBytes: validated.fileSizeBytes || null,
        order: validated.order,
        status: "pending",
        retryCount: 0,
      })
      .returning();

    return { success: true, itemId: item[0].id };
  }
);

const updateItemStatusSchema = z.object({
  itemId: z.string(),
  status: z
    .enum([
      "pending",
      "processing",
      "completed",
      "failed",
      "duplicate",
      "skipped",
    ])
    .optional(),
  documentId: z.string().optional(),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
  duplicateOfDocumentId: z.string().optional(),
  duplicateMatchType: z
    .enum(["exact_image", "merchant_date_amount", "manual"])
    .optional(),
});

export const updateItemStatus = createAuthenticatedAction(
  "updateItemStatus",
  async (userId, input: z.infer<typeof updateItemStatusSchema>) => {
    const validated = updateItemStatusSchema.parse(input);

    const item = await db
      .select()
      .from(importBatchItems)
      .where(eq(importBatchItems.id, validated.itemId))
      .limit(1);

    if (item.length === 0) {
      throw new Error("Batch item not found");
    }

    const batch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, item[0].batchId))
      .limit(1);

    if (batch.length === 0 || batch[0].userId !== userId) {
      throw new Error("Batch not found or unauthorized");
    }

    const updateData: Partial<typeof importBatchItems.$inferInsert> = {};

    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.documentId !== undefined)
      updateData.documentId = validated.documentId;
    if (validated.errorMessage !== undefined)
      updateData.errorMessage = validated.errorMessage;
    if (validated.errorCode !== undefined)
      updateData.errorCode = validated.errorCode;
    if (validated.duplicateOfDocumentId !== undefined)
      updateData.duplicateOfDocumentId = validated.duplicateOfDocumentId;
    if (validated.duplicateMatchType !== undefined)
      updateData.duplicateMatchType = validated.duplicateMatchType;

    const updated = await db
      .update(importBatchItems)
      .set(updateData)
      .where(eq(importBatchItems.id, validated.itemId))
      .returning();

    return { success: true, item: updated[0] };
  }
);

const getFailedItemsSchema = z.object({
  batchId: z.string(),
});

export const getFailedItems = createAuthenticatedAction(
  "getFailedItems",
  async (userId, input: z.infer<typeof getFailedItemsSchema>) => {
    const validated = getFailedItemsSchema.parse(input);

    const batch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, validated.batchId))
      .limit(1);

    if (batch.length === 0 || batch[0].userId !== userId) {
      throw new Error("Batch not found or unauthorized");
    }

    const failedItems = await db
      .select()
      .from(importBatchItems)
      .where(
        and(
          eq(importBatchItems.batchId, validated.batchId),
          eq(importBatchItems.status, "failed")
        )
      )
      .orderBy(importBatchItems.order);

    return { success: true, items: failedItems };
  }
);

const retryBatchItemSchema = z.object({
  itemId: z.string(),
});

function getFileFormat(url: string): ImportJobPayload["fileFormat"] {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  const formatMap: Record<string, ImportJobPayload["fileFormat"]> = {
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    gif: "gif",
    pdf: "pdf",
    csv: "csv",
    xlsx: "xlsx",
    xls: "xls",
  };
  return formatMap[ext] || "jpg";
}

export const retryBatchItem = createAuthenticatedAction(
  "retryBatchItem",
  async (userId, input: z.infer<typeof retryBatchItemSchema>) => {
    const validated = retryBatchItemSchema.parse(input);

    const item = await db
      .select()
      .from(importBatchItems)
      .where(eq(importBatchItems.id, validated.itemId))
      .limit(1);

    if (item.length === 0) {
      throw new Error("Batch item not found");
    }

    const batch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, item[0].batchId))
      .limit(1);

    if (batch.length === 0 || batch[0].userId !== userId) {
      throw new Error("Batch not found or unauthorized");
    }

    if (item[0].status !== "failed") {
      throw new Error("Item is not in failed status");
    }

    if (!item[0].fileUrl) {
      throw new Error("Item missing fileUrl, cannot retry");
    }

    const updated = await db
      .update(importBatchItems)
      .set({
        status: "pending",
        retryCount: item[0].retryCount + 1,
        errorMessage: null,
        errorCode: null,
      })
      .where(eq(importBatchItems.id, validated.itemId))
      .returning();

    const payload: ImportJobPayload = {
      batchId: batch[0].id,
      batchItemId: updated[0].id,
      fileUrl: item[0].fileUrl,
      fileName: item[0].fileName,
      fileFormat: getFileFormat(item[0].fileUrl),
      userId,
      importType: batch[0].importType as ImportJobPayload["importType"],
      sourceFormat: batch[0].sourceFormat as
        | ImportJobPayload["sourceFormat"]
        | undefined,
      order: item[0].order,
    };

    const enqueueResult = await enqueueBatchItem(payload);

    if (!enqueueResult.success) {
      await db
        .update(importBatchItems)
        .set({
          status: "failed",
          errorMessage: enqueueResult.error || "Failed to enqueue retry",
        })
        .where(eq(importBatchItems.id, validated.itemId));

      throw new Error(enqueueResult.error || "Failed to enqueue retry");
    }

    return { success: true, item: updated[0], eventId: enqueueResult.eventId };
  }
);

const retryAllFailedItemsSchema = z.object({
  batchId: z.string(),
});

export const retryAllFailedItems = createAuthenticatedAction(
  "retryAllFailedItems",
  async (userId, input: z.infer<typeof retryAllFailedItemsSchema>) => {
    const validated = retryAllFailedItemsSchema.parse(input);

    const batch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, validated.batchId))
      .limit(1);

    if (batch.length === 0 || batch[0].userId !== userId) {
      throw new Error("Batch not found or unauthorized");
    }

    const failedItems = await db
      .select()
      .from(importBatchItems)
      .where(
        and(
          eq(importBatchItems.batchId, validated.batchId),
          eq(importBatchItems.status, "failed")
        )
      );

    if (failedItems.length === 0) {
      return { success: true, retriedCount: 0 };
    }

    let retriedCount = 0;
    const errors: string[] = [];

    for (const item of failedItems) {
      if (!item.fileUrl) {
        errors.push(`${item.fileName}: Missing fileUrl`);
        continue;
      }

      try {
        const updated = await db
          .update(importBatchItems)
          .set({
            status: "pending",
            retryCount: item.retryCount + 1,
            errorMessage: null,
            errorCode: null,
          })
          .where(eq(importBatchItems.id, item.id))
          .returning();

        const payload: ImportJobPayload = {
          batchId: batch[0].id,
          batchItemId: updated[0].id,
          fileUrl: item.fileUrl,
          fileName: item.fileName,
          fileFormat: getFileFormat(item.fileUrl),
          userId,
          importType: batch[0].importType as ImportJobPayload["importType"],
          sourceFormat: batch[0].sourceFormat as
            | ImportJobPayload["sourceFormat"]
            | undefined,
          order: item.order,
        };

        const enqueueResult = await enqueueBatchItem(payload);

        if (!enqueueResult.success) {
          await db
            .update(importBatchItems)
            .set({
              status: "failed",
              errorMessage: enqueueResult.error || "Failed to enqueue retry",
            })
            .where(eq(importBatchItems.id, item.id));

          errors.push(
            `${item.fileName}: ${enqueueResult.error || "Failed to enqueue"}`
          );
        } else {
          retriedCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push(`${item.fileName}: ${errorMessage}`);
      }
    }

    return {
      success: retriedCount > 0,
      retriedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);
