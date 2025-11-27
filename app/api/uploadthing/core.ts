import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { devLogger } from "@/lib/dev-logger";
import {
  MAX_FILE_SIZE,
  MAX_FILE_COUNT_SINGLE,
  MAX_FILE_COUNT_BATCH,
} from "@/lib/constants";

const f = createUploadthing();

export const ourFileRouter = {
  // Single receipt uploader - supports images, PDFs, and HEIC/HEIF
  receiptUploader: f({
    image: { maxFileSize: MAX_FILE_SIZE, maxFileCount: MAX_FILE_COUNT_SINGLE },
    pdf: { maxFileSize: MAX_FILE_SIZE, maxFileCount: MAX_FILE_COUNT_SINGLE },
  })
    .middleware(async ({ req }) => {
      const { userId } = await auth();
      if (!userId) {
        devLogger.error("UploadThing unauthorized", { 
          hasRequest: !!req,
          action: "receiptUploader" 
        });
        throw new Error("Unauthorized");
      }
      return { userId };
    })
    .onUploadComplete(({ metadata, file }) => {
      // Dev logging only - uploads contain PII
      devLogger.info("Upload complete", {
        userId: metadata.userId,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: file.url,
        action: "uploadComplete",
      });
      // Return immediately - processing happens via client-triggered action
      return { uploadedBy: metadata.userId, url: file.url };
    }),
  // Batch uploader for multiple files (images, PDFs, HEIC/HEIF, and spreadsheets)
  batchUploader: f({
    image: { maxFileSize: MAX_FILE_SIZE, maxFileCount: MAX_FILE_COUNT_BATCH },
    pdf: { maxFileSize: MAX_FILE_SIZE, maxFileCount: MAX_FILE_COUNT_BATCH },
    text: { maxFileSize: MAX_FILE_SIZE, maxFileCount: MAX_FILE_COUNT_BATCH }, // CSV files
    blob: { maxFileSize: MAX_FILE_SIZE, maxFileCount: MAX_FILE_COUNT_BATCH }, // XLSX/XLS files
  })
    .middleware(async ({ req }) => {
      const { userId } = await auth();
      if (!userId) {
        devLogger.error("UploadThing unauthorized", { 
          hasRequest: !!req,
          action: "batchUploader" 
        });
        throw new Error("Unauthorized");
      }
      return { userId };
    })
    .onUploadComplete(({ metadata, file }) => {
      // Dev logging only - uploads contain PII
      devLogger.info("Batch upload complete", {
        userId: metadata.userId,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: file.url,
        action: "batchUploadComplete",
      });
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
