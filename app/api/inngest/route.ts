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
import { db } from "@/lib/db";
import { linkedBankAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncPlaidTransactions } from "@/lib/plaid/sync";

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

/**
 * Daily Plaid sync cron job
 * Runs once per day at 6 AM UTC to sync all linked bank accounts
 */
export const plaidDailySync = inngest.createFunction(
  {
    id: "plaid-daily-sync",
    name: "Plaid Daily Sync",
    retries: 2,
  },
  { cron: "0 6 * * *" }, // 6 AM UTC daily
  async ({ step }) => {
    devLogger.info("Starting daily Plaid sync");

    // Get all active linked accounts
    // Note: We query inside the step but sync outside to avoid JSON serialization issues with Date
    const accountIds = await step.run("fetch-linked-accounts", async () => {
      const accounts = await db
        .select({ id: linkedBankAccounts.id })
        .from(linkedBankAccounts)
        .where(eq(linkedBankAccounts.syncStatus, "active"));
      return accounts.map((a) => a.id);
    });

    devLogger.info(`Found ${accountIds.length} accounts to sync`);

    const results = {
      total: accountIds.length,
      success: 0,
      failed: 0,
      transactions: 0,
    };

    // Sync each account
    for (const accountId of accountIds) {
      try {
        const result = await step.run(`sync-${accountId}`, async () => {
          // Fetch the full account inside the step to get proper Date types
          const [account] = await db
            .select()
            .from(linkedBankAccounts)
            .where(eq(linkedBankAccounts.id, accountId))
            .limit(1);

          if (!account) {
            return { success: false, error: "Account not found" };
          }

          return await syncPlaidTransactions(account);
        });

        if (result.success) {
          results.success++;
          results.transactions += result.transactionCount || 0;
        } else {
          results.failed++;
          devLogger.error(`Sync failed for account ${accountId}`, {
            error: result.error,
          });
        }
      } catch (error) {
        results.failed++;
        devLogger.error(`Unexpected error syncing account ${accountId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    devLogger.info("Daily Plaid sync completed", results);

    return results;
  }
);

// Export the Inngest serve handler
// The serve function automatically reads INNGEST_SIGNING_KEY from env for authentication
// Make sure INNGEST_SERVE_URL is set in Inngest dashboard to https://turboinvoice.ai/api/inngest
const handlers = serve({
  client: inngest,
  functions: [processImportJob, plaidDailySync],
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
