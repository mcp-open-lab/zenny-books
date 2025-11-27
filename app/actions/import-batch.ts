"use server";

import { db } from "@/lib/db";
import { importBatches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createAuthenticatedAction } from "@/lib/safe-action";
import { z } from "zod";
import {
  getBatchStatusSummary,
  getBatchProgress,
  getBatchItemsStatus,
  listBatches,
} from "@/lib/import/batch-tracker";
import { IMPORT_TYPES, SOURCE_FORMATS, BATCH_STATUSES } from "@/lib/constants";

const createImportBatchSchema = z.object({
  importType: z.enum(IMPORT_TYPES),
  sourceFormat: z.enum(SOURCE_FORMATS).optional(),
  totalFiles: z.number().int().positive(),
});

export const createImportBatch = createAuthenticatedAction(
  "createImportBatch",
  async (userId, input: z.infer<typeof createImportBatchSchema>) => {
    const validated = createImportBatchSchema.parse(input);

    const batch = await db
      .insert(importBatches)
      .values({
        userId,
        importType: validated.importType,
        sourceFormat: validated.sourceFormat || null,
        totalFiles: validated.totalFiles,
        status: "pending",
        processedFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        duplicateFiles: 0,
      })
      .returning();

    return { success: true, batchId: batch[0].id };
  }
);

const updateBatchStatusSchema = z.object({
  batchId: z.string(),
  status: z.enum(BATCH_STATUSES).optional(),
  processedFiles: z.number().int().min(0).optional(),
  successfulFiles: z.number().int().min(0).optional(),
  failedFiles: z.number().int().min(0).optional(),
  duplicateFiles: z.number().int().min(0).optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  errors: z.array(z.string()).optional(),
});

export const updateBatchStatus = createAuthenticatedAction(
  "updateBatchStatus",
  async (userId, input: z.infer<typeof updateBatchStatusSchema>) => {
    const validated = updateBatchStatusSchema.parse(input);
    const updateData: Partial<typeof importBatches.$inferInsert> = {};

    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.processedFiles !== undefined)
      updateData.processedFiles = validated.processedFiles;
    if (validated.successfulFiles !== undefined)
      updateData.successfulFiles = validated.successfulFiles;
    if (validated.failedFiles !== undefined)
      updateData.failedFiles = validated.failedFiles;
    if (validated.duplicateFiles !== undefined)
      updateData.duplicateFiles = validated.duplicateFiles;
    if (validated.startedAt !== undefined)
      updateData.startedAt = validated.startedAt;
    if (validated.completedAt !== undefined)
      updateData.completedAt = validated.completedAt;
    if (validated.errors !== undefined)
      updateData.errors = JSON.stringify(validated.errors);

    updateData.updatedAt = new Date();

    const updated = await db
      .update(importBatches)
      .set(updateData)
      .where(
        and(
          eq(importBatches.id, validated.batchId),
          eq(importBatches.userId, userId)
        )
      )
      .returning();

    if (updated.length === 0) {
      throw new Error("Batch not found or unauthorized");
    }

    return { success: true, batch: updated[0] };
  }
);

const getBatchStatusSchema = z.object({
  batchId: z.string(),
});

export const getBatchStatus = createAuthenticatedAction(
  "getBatchStatus",
  async (userId, input: z.infer<typeof getBatchStatusSchema>) => {
    const validated = getBatchStatusSchema.parse(input);
    const batch = await getBatchStatusSummary(validated.batchId, userId);
    return { success: true, batch };
  }
);

const getBatchProgressSchema = z.object({
  batchId: z.string(),
});

export const getBatchProgressAction = createAuthenticatedAction(
  "getBatchProgress",
  async (userId, input: z.infer<typeof getBatchProgressSchema>) => {
    const validated = getBatchProgressSchema.parse(input);
    const progress = await getBatchProgress(validated.batchId, userId);
    return { success: true, progress };
  }
);

const getBatchItemsSchema = z.object({
  batchId: z.string(),
});

export const getBatchItems = createAuthenticatedAction(
  "getBatchItems",
  async (userId, input: z.infer<typeof getBatchItemsSchema>) => {
    const validated = getBatchItemsSchema.parse(input);
    const items = await getBatchItemsStatus(validated.batchId, userId);
    return { success: true, items };
  }
);

const completeBatchSchema = z.object({
  batchId: z.string(),
  status: z.enum(["completed", "failed"] as const),
  errors: z.array(z.string()).optional(),
});

export const completeBatch = createAuthenticatedAction(
  "completeBatch",
  async (userId, input: z.infer<typeof completeBatchSchema>) => {
    const validated = completeBatchSchema.parse(input);

    const updateData: Partial<typeof importBatches.$inferInsert> = {
      status: validated.status,
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    if (validated.errors !== undefined) {
      updateData.errors = JSON.stringify(validated.errors);
    }

    const updated = await db
      .update(importBatches)
      .set(updateData)
      .where(
        and(
          eq(importBatches.id, validated.batchId),
          eq(importBatches.userId, userId)
        )
      )
      .returning();

    if (updated.length === 0) {
      throw new Error("Batch not found or unauthorized");
    }

    return { success: true, batch: updated[0] };
  }
);

const listBatchesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  status: z.enum(BATCH_STATUSES).optional(),
});

export const listBatchesAction = createAuthenticatedAction(
  "listBatches",
  async (userId, input: z.infer<typeof listBatchesSchema>) => {
    const validated = listBatchesSchema.parse(input);

    const result = await listBatches(userId, {
      limit: validated.limit,
      cursor: validated.cursor,
      status: validated.status,
    });

    return {
      success: true,
      batches: result.batches,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }
);
