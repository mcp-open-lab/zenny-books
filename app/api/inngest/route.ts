/**
 * Inngest API route handler
 * Handles Inngest webhooks and function registration
 */

import { serve } from "inngest/next";
import { processBatchItem } from "@/lib/import/process-batch-item";
import type { ImportJobPayload } from "@/lib/import/queue-types";
import { devLogger } from "@/lib/dev-logger";
import { inngest } from "@/lib/inngest/client";
import type { NextRequest } from "next/server";

/**
 * Inngest function to process batch import items
 */
export const processImportJob = inngest.createFunction(
  {
    id: "process-import-job",
    name: "Process Import Job",
    retries: 0, // Disable retries during development - errors should fail fast
  },
  { event: "import/process.item" },
  async ({ event, step }) => {
    const payload = event.data as ImportJobPayload;

    devLogger.info("Processing import job", {
      eventId: event.id,
      batchItemId: payload.batchItemId,
      fileName: payload.fileName,
      batchId: payload.batchId,
      userId: payload.userId,
    });

    try {
      return await step.run("process-batch-item", async () => {
        const result = await processBatchItem(payload);

        if (!result.success) {
          devLogger.error("Import job failed", {
            batchItemId: payload.batchItemId,
            error: result.error,
            errorCode: result.errorCode,
          });
          throw new Error(result.error || "Processing failed");
        }

        devLogger.info("Import job completed successfully", {
          batchItemId: payload.batchItemId,
          documentId: result.documentId,
        });

        return result;
      });
    } catch (error) {
      // Log any unexpected errors that occur outside processBatchItem
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      devLogger.error("Unexpected error in Inngest function", {
        batchItemId: payload.batchItemId,
        eventId: event.id,
        error: errorMessage,
        stack: errorStack,
      });

      // Re-throw to let Inngest handle retries
      throw error;
    }
  }
);

// Export the Inngest serve handler
// The serve function automatically reads INNGEST_SIGNING_KEY from env for authentication
// Make sure INNGEST_SERVE_URL is set in Inngest dashboard to https://turboinvoice.ai/api/inngest
const handlers = serve({
  client: inngest,
  functions: [processImportJob],
});

// Wrap handlers to catch and log errors gracefully
export const GET = handlers.GET;
export const POST = handlers.POST;

// Handle PUT requests with better error handling
// PUT is used by Inngest for syncing functions, body may be empty
export const PUT = async (request: NextRequest, context: any) => {
  try {
    return await handlers.PUT(request, context);
  } catch (error) {
    // Log but don't fail on body parsing errors for PUT requests
    // This is a known issue with Inngest dev server sync
    if (
      error instanceof SyntaxError &&
      error.message.includes("Unexpected end of JSON input")
    ) {
      devLogger.warn("Inngest PUT request with empty body (sync request)", {
        url: request.url,
        method: request.method,
      });
      // Return 200 OK for sync requests with empty bodies
      return new Response(JSON.stringify({ synced: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Re-throw other errors
    throw error;
  }
};

// Runtime configuration for Next.js
export const runtime = "nodejs";
export const maxDuration = 300;
