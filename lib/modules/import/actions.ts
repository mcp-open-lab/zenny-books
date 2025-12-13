"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { importBatchItems, importBatches } from "@/lib/db/schema";
import { createAuthenticatedAction } from "@/lib/safe-action";
import {
  BATCH_STATUSES,
  IMPORT_TYPES,
  SOURCE_FORMATS,
  type BatchStatus,
} from "@/lib/constants";
import {
  getBatchItemsStatus,
  getBatchProgress,
  getBatchStatusSummary,
  listBatches,
} from "@/lib/import/batch-tracker";
import { enqueueBatch, enqueueBatchItem } from "@/lib/import/queue-sender";
import type { ImportJobPayload } from "@/lib/import/queue-types";
import { ActivityLogger } from "@/lib/import/activity-logger";
import { devLogger } from "@/lib/dev-logger";

function getFileFormatFromName(
  fileName: string
): ImportJobPayload["fileFormat"] {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
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

function getFileFormatFromUrl(url: string): ImportJobPayload["fileFormat"] {
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

async function insertImportBatch(input: {
  userId: string;
  importType: (typeof IMPORT_TYPES)[number];
  sourceFormat?: (typeof SOURCE_FORMATS)[number];
  totalFiles: number;
}): Promise<string> {
  const batch = await db
    .insert(importBatches)
    .values({
      userId: input.userId,
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

  return batch[0].id;
}

async function insertBatchItem(input: {
  userId: string;
  batchId: string;
  fileName: string;
  fileUrl?: string | null;
  fileSizeBytes?: number;
  order: number;
}): Promise<string> {
  const batch = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, input.batchId))
    .limit(1);

  if (batch.length === 0 || batch[0].userId !== input.userId) {
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

  return item[0].id;
}

// --------------------------
// Batch import (create batch + items + enqueue)
// --------------------------

const BatchImportSchema = z.object({
  importType: z.enum(IMPORT_TYPES),
  sourceFormat: z.enum(SOURCE_FORMATS).optional(),
  statementType: z.enum(["bank_account", "credit_card"] as const).optional(),
  currency: z.string().optional(),
  files: z.array(
    z.object({
      fileName: z.string(),
      fileUrl: z.string(),
      fileSizeBytes: z.number().int().optional(),
    })
  ),
  defaultBusinessId: z.string().nullable().optional(),
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
});

export const batchImport = createAuthenticatedAction(
  "batchImport",
  async (userId, input: z.infer<typeof BatchImportSchema>) => {
    const validated = BatchImportSchema.parse(input);

    if (validated.files.length === 0) {
      throw new Error("No files provided");
    }

    const batchId = await insertImportBatch({
      userId,
      importType: validated.importType,
      sourceFormat: validated.sourceFormat,
      totalFiles: validated.files.length,
    });

    await ActivityLogger.batchCreated(batchId, validated.files.length);

    const batchItems: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      order: number;
    }> = [];

    for (let i = 0; i < validated.files.length; i++) {
      const file = validated.files[i];
      const itemId = await insertBatchItem({
        userId,
        batchId,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileSizeBytes: file.fileSizeBytes,
        order: i,
      });

      batchItems.push({
        id: itemId,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        order: i,
      });

      await ActivityLogger.fileUploaded(
        batchId,
        itemId,
        file.fileName,
        file.fileSizeBytes || 0
      );
    }

    const jobs: ImportJobPayload[] = batchItems.map((item) => ({
      batchId,
      batchItemId: item.id,
      fileUrl: item.fileUrl,
      fileName: item.fileName,
      fileFormat: getFileFormatFromName(item.fileName),
      userId,
      importType: validated.importType,
      sourceFormat: validated.sourceFormat,
      statementType: validated.statementType,
      currency: validated.currency,
      order: item.order,
      defaultBusinessId: validated.defaultBusinessId ?? undefined,
      dateRangeStart: validated.dateRangeStart || undefined,
      dateRangeEnd: validated.dateRangeEnd || undefined,
    }));

    const enqueueResult = await enqueueBatch(jobs);

    if (!enqueueResult.success) {
      devLogger.error("Failed to enqueue some batch items", {
        batchId,
        enqueued: enqueueResult.enqueued,
        failed: enqueueResult.failed,
        errors: enqueueResult.errors,
      });
    }

    devLogger.info("Batch import initiated", {
      batchId,
      totalFiles: validated.files.length,
      itemsCreated: batchItems.length,
      jobsEnqueued: enqueueResult.enqueued,
      jobsFailed: enqueueResult.failed,
    });

    return {
      success: true,
      batchId,
      itemsCreated: batchItems.length,
      jobsEnqueued: enqueueResult.enqueued,
      jobsFailed: enqueueResult.failed,
    };
  }
);

// --------------------------
// Batches CRUD + status
// --------------------------

const CreateImportBatchSchema = z.object({
  importType: z.enum(IMPORT_TYPES),
  sourceFormat: z.enum(SOURCE_FORMATS).optional(),
  totalFiles: z.number().int().positive(),
});

export const createImportBatch = createAuthenticatedAction(
  "createImportBatch",
  async (userId, input: z.infer<typeof CreateImportBatchSchema>) => {
    const validated = CreateImportBatchSchema.parse(input);
    const batchId = await insertImportBatch({
      userId,
      importType: validated.importType,
      sourceFormat: validated.sourceFormat,
      totalFiles: validated.totalFiles,
    });
    return { success: true, batchId };
  }
);

const UpdateBatchStatusSchema = z.object({
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
  async (userId, input: z.infer<typeof UpdateBatchStatusSchema>) => {
    const validated = UpdateBatchStatusSchema.parse(input);
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
    if (validated.startedAt !== undefined) updateData.startedAt = validated.startedAt;
    if (validated.completedAt !== undefined)
      updateData.completedAt = validated.completedAt;
    if (validated.errors !== undefined)
      updateData.errors = JSON.stringify(validated.errors);

    updateData.updatedAt = new Date();

    const updated = await db
      .update(importBatches)
      .set(updateData)
      .where(and(eq(importBatches.id, validated.batchId), eq(importBatches.userId, userId)))
      .returning();

    if (updated.length === 0) {
      throw new Error("Batch not found or unauthorized");
    }

    return { success: true, batch: updated[0] };
  }
);

const GetBatchStatusSchema = z.object({ batchId: z.string() });

export const getBatchStatus = createAuthenticatedAction(
  "getBatchStatus",
  async (userId, input: z.infer<typeof GetBatchStatusSchema>) => {
    const validated = GetBatchStatusSchema.parse(input);
    const batch = await getBatchStatusSummary(validated.batchId, userId);
    return { success: true, batch };
  }
);

const GetBatchProgressSchema = z.object({ batchId: z.string() });

export const getBatchProgressAction = createAuthenticatedAction(
  "getBatchProgress",
  async (userId, input: z.infer<typeof GetBatchProgressSchema>) => {
    const validated = GetBatchProgressSchema.parse(input);
    const progress = await getBatchProgress(validated.batchId, userId);
    return { success: true, progress };
  }
);

const GetBatchItemsSchema = z.object({ batchId: z.string() });

export const getBatchItems = createAuthenticatedAction(
  "getBatchItems",
  async (userId, input: z.infer<typeof GetBatchItemsSchema>) => {
    const validated = GetBatchItemsSchema.parse(input);
    const items = await getBatchItemsStatus(validated.batchId, userId);
    return { success: true, items };
  }
);

const CompleteBatchSchema = z.object({
  batchId: z.string(),
  status: z.enum(["completed", "failed"] as const),
  errors: z.array(z.string()).optional(),
});

export const completeBatch = createAuthenticatedAction(
  "completeBatch",
  async (userId, input: z.infer<typeof CompleteBatchSchema>) => {
    const validated = CompleteBatchSchema.parse(input);

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
      .where(and(eq(importBatches.id, validated.batchId), eq(importBatches.userId, userId)))
      .returning();

    if (updated.length === 0) {
      throw new Error("Batch not found or unauthorized");
    }

    return { success: true, batch: updated[0] };
  }
);

const ListBatchesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  status: z.enum(BATCH_STATUSES).optional(),
});

export const listBatchesAction = createAuthenticatedAction(
  "listBatches",
  async (userId, input: z.infer<typeof ListBatchesSchema>) => {
    const validated = ListBatchesSchema.parse(input);
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

// --------------------------
// Batch items
// --------------------------

const CreateBatchItemSchema = z.object({
  batchId: z.string(),
  fileName: z.string(),
  fileUrl: z.string().optional(),
  fileSizeBytes: z.number().int().optional(),
  order: z.number().int().min(0),
});

export const createBatchItem = createAuthenticatedAction(
  "createBatchItem",
  async (userId, input: z.infer<typeof CreateBatchItemSchema>) => {
    const validated = CreateBatchItemSchema.parse(input);
    const itemId = await insertBatchItem({
      userId,
      batchId: validated.batchId,
      fileName: validated.fileName,
      fileUrl: validated.fileUrl,
      fileSizeBytes: validated.fileSizeBytes,
      order: validated.order,
    });
    return { success: true, itemId };
  }
);

const UpdateItemStatusSchema = z.object({
  itemId: z.string(),
  status: z
    .enum(["pending", "processing", "completed", "failed", "duplicate", "skipped"])
    .optional(),
  documentId: z.string().optional(),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
  duplicateOfDocumentId: z.string().optional(),
  duplicateMatchType: z.enum(["exact_image", "merchant_date_amount", "manual"]).optional(),
});

export const updateItemStatus = createAuthenticatedAction(
  "updateItemStatus",
  async (userId, input: z.infer<typeof UpdateItemStatusSchema>) => {
    const validated = UpdateItemStatusSchema.parse(input);

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
    if (validated.documentId !== undefined) updateData.documentId = validated.documentId;
    if (validated.errorMessage !== undefined) updateData.errorMessage = validated.errorMessage;
    if (validated.errorCode !== undefined) updateData.errorCode = validated.errorCode;
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

const GetFailedItemsSchema = z.object({ batchId: z.string() });

export const getFailedItems = createAuthenticatedAction(
  "getFailedItems",
  async (userId, input: z.infer<typeof GetFailedItemsSchema>) => {
    const validated = GetFailedItemsSchema.parse(input);

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

const RetryBatchItemSchema = z.object({ itemId: z.string() });

export const retryBatchItem = createAuthenticatedAction(
  "retryBatchItem",
  async (userId, input: z.infer<typeof RetryBatchItemSchema>) => {
    const validated = RetryBatchItemSchema.parse(input);

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
      fileFormat: getFileFormatFromUrl(item[0].fileUrl),
      userId,
      importType: batch[0].importType as ImportJobPayload["importType"],
      sourceFormat: batch[0].sourceFormat as ImportJobPayload["sourceFormat"] | undefined,
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

const RetryAllFailedItemsSchema = z.object({ batchId: z.string() });

export const retryAllFailedItems = createAuthenticatedAction(
  "retryAllFailedItems",
  async (userId, input: z.infer<typeof RetryAllFailedItemsSchema>) => {
    const validated = RetryAllFailedItemsSchema.parse(input);

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
      .where(and(eq(importBatchItems.batchId, validated.batchId), eq(importBatchItems.status, "failed")));

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
          fileFormat: getFileFormatFromUrl(item.fileUrl),
          userId,
          importType: batch[0].importType as ImportJobPayload["importType"],
          sourceFormat: batch[0].sourceFormat as ImportJobPayload["sourceFormat"] | undefined,
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

          errors.push(`${item.fileName}: ${enqueueResult.error || "Failed to enqueue"}`);
        } else {
          retriedCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
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

export type ListBatchesStatusFilter = BatchStatus | "all";


