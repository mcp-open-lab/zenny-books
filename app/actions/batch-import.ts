"use server";

import { auth } from "@clerk/nextjs/server";
import { createSafeAction } from "@/lib/safe-action";
import { z } from "zod";
import { createImportBatch } from "@/app/actions/import-batch";
import { createBatchItem } from "@/app/actions/import-batch-items";
import { enqueueBatch } from "@/lib/import/queue-sender";
import type { ImportJobPayload } from "@/lib/import/queue-types";
import { devLogger } from "@/lib/dev-logger";
import { ActivityLogger } from "@/lib/import/activity-logger";
import { IMPORT_TYPES, SOURCE_FORMATS } from "@/lib/constants";

const batchImportSchema = z.object({
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
  // Critical processing options
  defaultBusinessId: z.string().nullable().optional(),
  dateRangeStart: z.string().optional(), // ISO date string
  dateRangeEnd: z.string().optional(),   // ISO date string
});

/**
 * Complete batch import flow:
 * 1. Create batch record
 * 2. Create batch items for each file
 * 3. Enqueue all items to Vercel Queue
 * 4. Return batch ID for status tracking
 */
async function batchImportHandler(
  input: z.infer<typeof batchImportSchema>
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (input.files.length === 0) {
    throw new Error("No files provided");
  }

  // Step 1: Create batch record
  const batchResult = await createImportBatch({
    importType: input.importType,
    sourceFormat: input.sourceFormat,
    totalFiles: input.files.length,
  });

  if (!batchResult.success || !batchResult.batchId) {
    throw new Error("Failed to create batch");
  }

  const batchId = batchResult.batchId;

  // Log batch creation
  await ActivityLogger.batchCreated(batchId, input.files.length);

  // Step 2: Create batch items
  const batchItems: Array<{ id: string; fileName: string; fileUrl: string; order: number }> = [];

  for (let i = 0; i < input.files.length; i++) {
    const file = input.files[i];
    const itemResult = await createBatchItem({
      batchId,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      fileSizeBytes: file.fileSizeBytes,
      order: i,
    });

    if (itemResult.success && itemResult.itemId) {
      batchItems.push({
        id: itemResult.itemId,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        order: i,
      });
      
      // Log file upload
      await ActivityLogger.fileUploaded(
        batchId,
        itemResult.itemId,
        file.fileName,
        file.fileSizeBytes || 0
      );
    }
  }

  if (batchItems.length === 0) {
    throw new Error("Failed to create batch items");
  }

  // Step 3: Prepare queue jobs
  const getFileFormat = (url: string): ImportJobPayload["fileFormat"] => {
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
  };

  const jobs: ImportJobPayload[] = batchItems.map((item) => ({
    batchId,
    batchItemId: item.id,
    fileUrl: item.fileUrl,
    fileName: item.fileName,
    fileFormat: getFileFormat(item.fileUrl),
    userId,
    importType: input.importType,
    sourceFormat: input.sourceFormat,
    statementType: input.statementType,
    currency: input.currency,
    order: item.order,
  }));

  // Step 4: Enqueue all jobs
  const enqueueResult = await enqueueBatch(jobs);

  if (!enqueueResult.success) {
    devLogger.error("Failed to enqueue some batch items", {
      batchId,
      enqueued: enqueueResult.enqueued,
      failed: enqueueResult.failed,
      errors: enqueueResult.errors,
    });
    // Continue anyway - some items may have been enqueued
  }

  devLogger.info("Batch import initiated", {
    batchId,
    totalFiles: input.files.length,
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

export const batchImport = createSafeAction(
  "batchImport",
  async (input: unknown) => {
    const validated = batchImportSchema.parse(input);
    return batchImportHandler(validated);
  }
);

