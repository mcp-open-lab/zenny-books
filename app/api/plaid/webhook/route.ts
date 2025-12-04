/**
 * Plaid Webhook Handler
 * Receives real-time notifications from Plaid for transaction updates, errors, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { linkedBankAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncPlaidTransactions } from "@/lib/plaid/sync";
import { devLogger } from "@/lib/dev-logger";
import { plaidClient } from "@/lib/plaid/client";

export const runtime = "nodejs";
export const maxDuration = 60;

type PlaidWebhookBody = {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
};

async function verifyPlaidWebhook(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const plaidVerificationHeader = request.headers.get("plaid-verification");

  // In sandbox mode, allow webhooks without verification for easier testing
  if (process.env.PLAID_ENV === "sandbox") {
    if (!plaidVerificationHeader) {
      devLogger.info("Plaid webhook in sandbox mode - skipping verification");
    }
    return true;
  }

  if (!plaidVerificationHeader) {
    devLogger.warn("Plaid webhook missing verification header");
    return false;
  }

  try {
    // Fetch Plaid's current webhook verification key
    const keyResponse = await plaidClient.webhookVerificationKeyGet({
      key_id: plaidVerificationHeader,
    });

    // In production, you should verify the JWT signature using the key
    // For now, we'll trust webhooks from Plaid's IPs (configured in Vercel)
    // Full verification requires jose library for JWT validation
    
    devLogger.info("Plaid webhook verification key fetched", {
      keyId: plaidVerificationHeader,
    });
    
    return true;
  } catch (error) {
    devLogger.error("Failed to verify Plaid webhook", { error });
    return false;
  }
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  
  // Verify webhook authenticity
  const isValid = await verifyPlaidWebhook(request, bodyText);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }

  let body: PlaidWebhookBody;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { webhook_type, webhook_code, item_id, error } = body;

  devLogger.info("Plaid webhook received", {
    webhookType: webhook_type,
    webhookCode: webhook_code,
    itemId: item_id,
  });

  try {
    switch (webhook_type) {
      case "TRANSACTIONS":
        await handleTransactionsWebhook(webhook_code, item_id, body);
        break;

      case "ITEM":
        await handleItemWebhook(webhook_code, item_id, error);
        break;

      case "HOLDINGS":
      case "INVESTMENTS_TRANSACTIONS":
        // Not using investment products yet
        devLogger.info("Ignoring investment webhook", { webhookType: webhook_type });
        break;

      default:
        devLogger.info("Unhandled webhook type", { webhookType: webhook_type });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    devLogger.error("Error processing Plaid webhook", {
      error: err instanceof Error ? err.message : String(err),
      webhookType: webhook_type,
      webhookCode: webhook_code,
    });
    
    // Return 200 to prevent Plaid from retrying
    // We log the error for investigation
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}

async function handleTransactionsWebhook(
  code: string,
  itemId: string,
  body: PlaidWebhookBody
) {
  switch (code) {
    case "SYNC_UPDATES_AVAILABLE":
    case "INITIAL_UPDATE":
    case "HISTORICAL_UPDATE":
    case "DEFAULT_UPDATE":
      // New transactions available - sync all accounts for this item
      const accounts = await db
        .select()
        .from(linkedBankAccounts)
        .where(eq(linkedBankAccounts.plaidItemId, itemId));

      devLogger.info("Syncing accounts for transaction update", {
        itemId,
        accountCount: accounts.length,
        webhookCode: code,
      });

      for (const account of accounts) {
        try {
          const result = await syncPlaidTransactions(account);
          devLogger.info("Account sync completed", {
            accountId: account.id,
            transactionCount: result.transactionCount,
          });
        } catch (err) {
          devLogger.error("Account sync failed", {
            accountId: account.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      break;

    case "TRANSACTIONS_REMOVED":
      // Transactions were removed (e.g., pending cleared differently)
      devLogger.info("Transactions removed webhook", {
        itemId,
        removedCount: body.removed_transactions?.length || 0,
      });
      // TODO: Handle removed transactions if needed
      break;

    default:
      devLogger.info("Unhandled transactions webhook code", { code });
  }
}

async function handleItemWebhook(
  code: string,
  itemId: string,
  error?: PlaidWebhookBody["error"]
) {
  switch (code) {
    case "ERROR":
      // Item encountered an error
      await db
        .update(linkedBankAccounts)
        .set({
          syncStatus: "error",
          syncErrorMessage: error?.error_message || "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(linkedBankAccounts.plaidItemId, itemId));

      devLogger.error("Plaid item error", {
        itemId,
        errorType: error?.error_type,
        errorCode: error?.error_code,
        errorMessage: error?.error_message,
      });
      break;

    case "PENDING_EXPIRATION":
      // Credentials will expire soon - user should re-authenticate
      await db
        .update(linkedBankAccounts)
        .set({
          syncStatus: "pending_expiration",
          syncErrorMessage: "Bank connection will expire soon. Please reconnect.",
          updatedAt: new Date(),
        })
        .where(eq(linkedBankAccounts.plaidItemId, itemId));

      devLogger.warn("Plaid item pending expiration", { itemId });
      break;

    case "USER_PERMISSION_REVOKED":
      // User revoked access - mark as disconnected
      await db
        .update(linkedBankAccounts)
        .set({
          syncStatus: "disconnected",
          syncErrorMessage: "Bank access was revoked. Please reconnect.",
          updatedAt: new Date(),
        })
        .where(eq(linkedBankAccounts.plaidItemId, itemId));

      devLogger.warn("Plaid user permission revoked", { itemId });
      break;

    case "WEBHOOK_UPDATE_ACKNOWLEDGED":
      // Webhook URL was updated
      devLogger.info("Plaid webhook URL updated", { itemId });
      break;

    default:
      devLogger.info("Unhandled item webhook code", { code });
  }
}

