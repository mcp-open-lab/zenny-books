"use server";

import { createAuthenticatedAction } from "@/lib/safe-action";
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
  defaultBusinessId: z.string().nullable().optional(),
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
});

function getFileFormat(fileName: string): ImportJobPayload["fileFormat"] {
  // Use original filename, not URL (UploadThing URLs don't preserve extensions)
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

export const batchImport = createAuthenticatedAction(
  "batchImport",
  async (userId, input: z.infer<typeof batchImportSchema>) => {
    const validated = batchImportSchema.parse(input);

    if (validated.files.length === 0) {
      throw new Error("No files provided");
    }

    const batchResult = await createImportBatch({
      importType: validated.importType,
      sourceFormat: validated.sourceFormat,
      totalFiles: validated.files.length,
    });

    if (!batchResult.success || !batchResult.batchId) {
      throw new Error("Failed to create batch");
    }

    const batchId = batchResult.batchId;

    await ActivityLogger.batchCreated(batchId, validated.files.length);

    const batchItems: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      order: number;
    }> = [];

    for (let i = 0; i < validated.files.length; i++) {
      const file = validated.files[i];
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

    const jobs: ImportJobPayload[] = batchItems.map((item) => ({
      batchId,
      batchItemId: item.id,
      fileUrl: item.fileUrl,
      fileName: item.fileName,
      fileFormat: getFileFormat(item.fileName),
      userId,
      importType: validated.importType,
      sourceFormat: validated.sourceFormat,
      statementType: validated.statementType,
      currency: validated.currency,
      order: item.order,
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

