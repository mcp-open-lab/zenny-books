/**
 * Queue sender for batch import jobs
 * Handles enqueueing jobs to Inngest
 */

import { inngest } from "@/lib/inngest/client";
import type { ImportJobPayload } from "@/lib/import/queue-types";
import { devLogger } from "@/lib/dev-logger";

/**
 * Enqueue a single batch item for processing using Inngest
 *
 * @param payload The job payload to enqueue
 * @returns Success status and event ID if successful
 */
export async function enqueueBatchItem(
  payload: ImportJobPayload
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const result = await inngest.send({
      name: "import/process.item",
      data: payload,
    });

    const eventId = Array.isArray(result)
      ? result[0]?.ids?.[0]
      : result.ids?.[0];

    devLogger.info("Enqueued batch item", {
      eventId: eventId || "unknown",
      batchItemId: payload.batchItemId,
      fileName: payload.fileName,
    });

    return { success: true, eventId: eventId || undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails =
      error instanceof Error
        ? {
            message: error.message,
            name: error.name,
            stack: error.stack,
          }
        : { error: String(error) };

    devLogger.error("Failed to enqueue batch item", error, {
      batchItemId: payload.batchItemId,
      error: errorMessage,
      errorDetails,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Enqueue all items in a batch
 */
export async function enqueueBatch(items: ImportJobPayload[]): Promise<{
  success: boolean;
  enqueued: number;
  failed: number;
  errors: string[];
}> {
  const results = await Promise.allSettled(
    items.map((item) => enqueueBatchItem(item))
  );

  const enqueued = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;
  const failed = results.length - enqueued;
  const errors = results
    .filter((r) => r.status === "rejected" || !r.value.success)
    .map((r) =>
      r.status === "rejected"
        ? r.reason?.message || "Unknown error"
        : r.value.error || "Unknown error"
    );

  return {
    success: failed === 0,
    enqueued,
    failed,
    errors,
  };
}
