"use server";

import { db } from "@/lib/db";
import { importBatches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createSafeAction } from "@/lib/safe-action";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  getBatchStatusSummary,
  getBatchProgress,
  getBatchItemsStatus,
} from "@/lib/import/batch-tracker";

const createImportBatchSchema = z.object({
  importType: z.enum(["receipts", "bank_statements", "invoices", "mixed"]),
  sourceFormat: z.enum(["pdf", "csv", "xlsx", "images"]).optional(),
  totalFiles: z.number().int().positive(),
});

async function createImportBatchHandler(
  input: z.infer<typeof createImportBatchSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const batch = await db
    .insert(importBatches)
    .values({
      userId,
      importType: input.importType,
      sourceFormat: input.sourceFormat || null,
      totalFiles: input.totalFiles,
      status: "pending",
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      duplicateFiles: 0,
    })
    .returning();

  return { success: true, batchId: batch[0].id };
}

export const createImportBatch = createSafeAction(
  "createImportBatch",
  async (input: unknown) => {
    const validated = createImportBatchSchema.parse(input);
    return createImportBatchHandler(validated);
  }
);

const updateBatchStatusSchema = z.object({
  batchId: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed", "cancelled"]).optional(),
  processedFiles: z.number().int().min(0).optional(),
  successfulFiles: z.number().int().min(0).optional(),
  failedFiles: z.number().int().min(0).optional(),
  duplicateFiles: z.number().int().min(0).optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  errors: z.array(z.string()).optional(),
});

async function updateBatchStatusHandler(
  input: z.infer<typeof updateBatchStatusSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const updateData: Partial<typeof importBatches.$inferInsert> = {};

  if (input.status !== undefined) updateData.status = input.status;
  if (input.processedFiles !== undefined) updateData.processedFiles = input.processedFiles;
  if (input.successfulFiles !== undefined) updateData.successfulFiles = input.successfulFiles;
  if (input.failedFiles !== undefined) updateData.failedFiles = input.failedFiles;
  if (input.duplicateFiles !== undefined) updateData.duplicateFiles = input.duplicateFiles;
  if (input.startedAt !== undefined) updateData.startedAt = input.startedAt;
  if (input.completedAt !== undefined) updateData.completedAt = input.completedAt;
  if (input.errors !== undefined) updateData.errors = JSON.stringify(input.errors);

  updateData.updatedAt = new Date();

  const updated = await db
    .update(importBatches)
    .set(updateData)
    .where(
      and(eq(importBatches.id, input.batchId), eq(importBatches.userId, userId))
    )
    .returning();

  if (updated.length === 0) {
    throw new Error("Batch not found or unauthorized");
  }

  return { success: true, batch: updated[0] };
}

export const updateBatchStatus = createSafeAction(
  "updateBatchStatus",
  async (input: unknown) => {
    const validated = updateBatchStatusSchema.parse(input);
    return updateBatchStatusHandler(validated);
  }
);

const getBatchStatusSchema = z.object({
  batchId: z.string(),
});

async function getBatchStatusHandler(
  input: z.infer<typeof getBatchStatusSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const batch = await getBatchStatusSummary(input.batchId, userId);

  return {
    success: true,
    batch,
  };
}

export const getBatchStatus = createSafeAction(
  "getBatchStatus",
  async (input: unknown) => {
    const validated = getBatchStatusSchema.parse(input);
    return getBatchStatusHandler(validated);
  }
);

const getBatchProgressSchema = z.object({
  batchId: z.string(),
});

async function getBatchProgressHandler(
  input: z.infer<typeof getBatchProgressSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const progress = await getBatchProgress(input.batchId, userId);

  return {
    success: true,
    progress,
  };
}

export const getBatchProgressAction = createSafeAction(
  "getBatchProgress",
  async (input: unknown) => {
    const validated = getBatchProgressSchema.parse(input);
    return getBatchProgressHandler(validated);
  }
);

const getBatchItemsSchema = z.object({
  batchId: z.string(),
});

async function getBatchItemsHandler(
  input: z.infer<typeof getBatchItemsSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const items = await getBatchItemsStatus(input.batchId, userId);

  return {
    success: true,
    items,
  };
}

export const getBatchItems = createSafeAction(
  "getBatchItems",
  async (input: unknown) => {
    const validated = getBatchItemsSchema.parse(input);
    return getBatchItemsHandler(validated);
  }
);

const completeBatchSchema = z.object({
  batchId: z.string(),
  status: z.enum(["completed", "failed"]),
  errors: z.array(z.string()).optional(),
});

async function completeBatchHandler(
  input: z.infer<typeof completeBatchSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const updateData: Partial<typeof importBatches.$inferInsert> = {
    status: input.status,
    completedAt: new Date(),
    updatedAt: new Date(),
  };

  if (input.errors !== undefined) {
    updateData.errors = JSON.stringify(input.errors);
  }

  const updated = await db
    .update(importBatches)
    .set(updateData)
    .where(
      and(eq(importBatches.id, input.batchId), eq(importBatches.userId, userId))
    )
    .returning();

  if (updated.length === 0) {
    throw new Error("Batch not found or unauthorized");
  }

  return { success: true, batch: updated[0] };
}

export const completeBatch = createSafeAction(
  "completeBatch",
  async (input: unknown) => {
    const validated = completeBatchSchema.parse(input);
    return completeBatchHandler(validated);
  }
);
