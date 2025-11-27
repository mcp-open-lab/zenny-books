/**
 * Activity Logger for Batch Import Processing
 * Logs real-time activities to show AI processing and system activity
 */

import { db } from "@/lib/db";
import { batchActivityLogs } from "@/lib/db/schema";
import type { ActivityType } from "@/lib/constants";

interface LogActivityParams {
  batchId: string;
  batchItemId?: string;
  activityType: ActivityType;
  message: string;
  details?: Record<string, any>;
  fileName?: string;
  duration?: number;
}

export async function logBatchActivity({
  batchId,
  batchItemId,
  activityType,
  message,
  details,
  fileName,
  duration,
}: LogActivityParams): Promise<void> {
  try {
    await db.insert(batchActivityLogs).values({
      batchId,
      batchItemId: batchItemId || null,
      activityType,
      message,
      details: details ? JSON.stringify(details) : null,
      fileName: fileName || null,
      duration: duration || null,
    });
  } catch (error) {
    // Don't fail the main process if logging fails
    console.error("[Activity Logger] Failed to log activity:", error);
  }
}

// Convenience functions for common activities
export const ActivityLogger = {
  batchCreated: (batchId: string, totalFiles: number) =>
    logBatchActivity({
      batchId,
      activityType: "batch_created",
      message: `Batch created with ${totalFiles} file${totalFiles !== 1 ? "s" : ""}`,
      details: { totalFiles },
    }),

  fileUploaded: (batchId: string, batchItemId: string, fileName: string, fileSize: number) =>
    logBatchActivity({
      batchId,
      batchItemId,
      activityType: "file_uploaded",
      message: `📁 File uploaded: ${fileName}`,
      fileName,
      details: { fileSizeBytes: fileSize },
    }),

  aiExtractionStart: (batchId: string, batchItemId: string, fileName: string) =>
    logBatchActivity({
      batchId,
      batchItemId,
      activityType: "ai_extraction_start",
      message: `🤖 AI extracting data from ${fileName}...`,
      fileName,
    }),

  aiExtractionComplete: (
    batchId: string,
    batchItemId: string,
    fileName: string,
    duration: number,
    extractedData: { merchantName?: string; amount?: number }
  ) =>
    logBatchActivity({
      batchId,
      batchItemId,
      activityType: "ai_extraction_complete",
      message: `✅ AI extraction complete: ${extractedData.merchantName || "Unknown merchant"}${
        extractedData.amount ? ` - $${extractedData.amount}` : ""
      }`,
      fileName,
      duration,
      details: extractedData,
    }),

  aiCategorizationStart: (batchId: string, batchItemId: string, fileName: string) =>
    logBatchActivity({
      batchId,
      batchItemId,
      activityType: "categorization_start",
      message: `🧠 AI categorizing transaction...`,
      fileName,
    }),

  aiCategorizationComplete: (
    batchId: string,
    batchItemId: string,
    fileName: string,
    category: string,
    method: string,
    businessName?: string
  ) =>
    logBatchActivity({
      batchId,
      batchItemId,
      activityType: "categorization_complete",
      message: `🏷️ Categorized as "${category}" (${method})${
        businessName ? ` for ${businessName}` : ""
      }`,
      fileName,
      details: { category, method, businessName },
    }),

  duplicateDetected: (batchId: string, batchItemId: string, fileName: string, matchType: string) =>
    logBatchActivity({
      batchId,
      batchItemId,
      activityType: "duplicate_detected",
      message: `⚠️ Duplicate detected: ${fileName} (${matchType})`,
      fileName,
      details: { matchType },
    }),

  itemCompleted: (batchId: string, batchItemId: string, fileName: string, duration: number) =>
    logBatchActivity({
      batchId,
      batchItemId,
      activityType: "item_completed",
      message: `✅ Successfully processed ${fileName}`,
      fileName,
      duration,
    }),

  itemFailed: (batchId: string, batchItemId: string, fileName: string, error: string) =>
    logBatchActivity({
      batchId,
      batchItemId,
      activityType: "item_failed",
      message: `❌ Failed to process ${fileName}: ${error}`,
      fileName,
      details: { error },
    }),

  batchCompleted: (batchId: string, successCount: number, failedCount: number, duration: number) =>
    logBatchActivity({
      batchId,
      activityType: "batch_completed",
      message: `🎉 Batch complete! ${successCount} successful, ${failedCount} failed`,
      duration,
      details: { successCount, failedCount },
    }),
};

