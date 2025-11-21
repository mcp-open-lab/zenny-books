"use server";

import { db } from "@/lib/db";
import { importBatchItems, importBatches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createSafeAction } from "@/lib/safe-action";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const createBatchItemSchema = z.object({
  batchId: z.string(),
  fileName: z.string(),
  fileUrl: z.string().optional(),
  fileSizeBytes: z.number().int().optional(),
  order: z.number().int().min(0),
});

async function createBatchItemHandler(
  input: z.infer<typeof createBatchItemSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify batch belongs to user
  const batch = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, input.batchId))
    .limit(1);

  if (batch.length === 0 || batch[0].userId !== userId) {
    throw new Error("Batch not found or unauthorized");
  }

  const item = await db
    .insert(importBatchItems)
    .values({
      batchId: input.batchId,
      fileName: input.fileName,
      fileUrl: input.fileUrl || null,
      fileSizeBytes: input.fileSizeBytes || null,
      order: input.order,
      status: "pending",
      retryCount: 0,
    })
    .returning();

  return { success: true, itemId: item[0].id };
}

export const createBatchItem = createSafeAction(
  "createBatchItem",
  async (input: unknown) => {
    const validated = createBatchItemSchema.parse(input);
    return createBatchItemHandler(validated);
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

async function updateItemStatusHandler(
  input: z.infer<typeof updateItemStatusSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify item belongs to user's batch
  const item = await db
    .select()
    .from(importBatchItems)
    .where(eq(importBatchItems.id, input.itemId))
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

  if (input.status !== undefined) updateData.status = input.status;
  if (input.documentId !== undefined) updateData.documentId = input.documentId;
  if (input.errorMessage !== undefined)
    updateData.errorMessage = input.errorMessage;
  if (input.errorCode !== undefined) updateData.errorCode = input.errorCode;
  if (input.duplicateOfDocumentId !== undefined)
    updateData.duplicateOfDocumentId = input.duplicateOfDocumentId;
  if (input.duplicateMatchType !== undefined)
    updateData.duplicateMatchType = input.duplicateMatchType;

  const updated = await db
    .update(importBatchItems)
    .set(updateData)
    .where(eq(importBatchItems.id, input.itemId))
    .returning();

  return { success: true, item: updated[0] };
}

export const updateItemStatus = createSafeAction(
  "updateItemStatus",
  async (input: unknown) => {
    const validated = updateItemStatusSchema.parse(input);
    return updateItemStatusHandler(validated);
  }
);

const getFailedItemsSchema = z.object({
  batchId: z.string(),
});

async function getFailedItemsHandler(
  input: z.infer<typeof getFailedItemsSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify batch belongs to user
  const batch = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, input.batchId))
    .limit(1);

  if (batch.length === 0 || batch[0].userId !== userId) {
    throw new Error("Batch not found or unauthorized");
  }

  const failedItems = await db
    .select()
    .from(importBatchItems)
    .where(
      and(
        eq(importBatchItems.batchId, input.batchId),
        eq(importBatchItems.status, "failed")
      )
    )
    .orderBy(importBatchItems.order);

  return { success: true, items: failedItems };
}

export const getFailedItems = createSafeAction(
  "getFailedItems",
  async (input: unknown) => {
    const validated = getFailedItemsSchema.parse(input);
    return getFailedItemsHandler(validated);
  }
);

const retryBatchItemSchema = z.object({
  itemId: z.string(),
});

async function retryBatchItemHandler(
  input: z.infer<typeof retryBatchItemSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify item belongs to user's batch
  const item = await db
    .select()
    .from(importBatchItems)
    .where(eq(importBatchItems.id, input.itemId))
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

  const updated = await db
    .update(importBatchItems)
    .set({
      status: "pending",
      retryCount: item[0].retryCount + 1,
      errorMessage: null,
      errorCode: null,
    })
    .where(eq(importBatchItems.id, input.itemId))
    .returning();

  return { success: true, item: updated[0] };
}

export const retryBatchItem = createSafeAction(
  "retryBatchItem",
  async (input: unknown) => {
    const validated = retryBatchItemSchema.parse(input);
    return retryBatchItemHandler(validated);
  }
);
