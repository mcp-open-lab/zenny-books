"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { linkedBankAccounts, documents, bankStatements } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  plaidClient,
  PLAID_PRODUCTS,
  PLAID_COUNTRY_CODES,
  isPlaidConfigured,
} from "@/lib/plaid/client";
import { CountryCode, Products } from "plaid";
import { syncPlaidTransactions } from "@/lib/plaid/sync";

/**
 * Get the webhook URL for Plaid
 */
function getWebhookUrl(): string | undefined {
  // Use VERCEL_URL in production, or explicit PLAID_WEBHOOK_URL
  const baseUrl = process.env.PLAID_WEBHOOK_URL 
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || process.env.NEXT_PUBLIC_APP_URL;
  
  if (!baseUrl) return undefined;
  return `${baseUrl}/api/plaid/webhook`;
}

/**
 * Create a Plaid Link token for initializing the Link modal
 */
export async function createLinkToken() {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPlaidConfigured()) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    const webhookUrl = getWebhookUrl();
    
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Turbo Invoice",
      products: PLAID_PRODUCTS as unknown as Products[],
      country_codes: PLAID_COUNTRY_CODES as unknown as CountryCode[],
      language: "en",
      webhook: webhookUrl,
    });

    return {
      success: true,
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  } catch (error) {
    console.error("Failed to create link token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create link token",
    };
  }
}

/**
 * Create an update mode Link token for reconnecting an expired bank connection
 */
export async function createUpdateLinkToken(accountId: string) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPlaidConfigured()) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    // Get the account to get the access token
    const [account] = await db
      .select()
      .from(linkedBankAccounts)
      .where(
        and(
          eq(linkedBankAccounts.id, accountId),
          eq(linkedBankAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    const webhookUrl = getWebhookUrl();

    // Create update mode link token
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Turbo Invoice",
      country_codes: PLAID_COUNTRY_CODES as unknown as CountryCode[],
      language: "en",
      webhook: webhookUrl,
      access_token: account.plaidAccessToken,
    });

    return {
      success: true,
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  } catch (error) {
    console.error("Failed to create update link token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create update link token",
    };
  }
}

/**
 * Update webhook URL for an existing linked account/item
 */
export async function updateItemWebhook(accountId: string) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPlaidConfigured()) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    const [account] = await db
      .select()
      .from(linkedBankAccounts)
      .where(
        and(
          eq(linkedBankAccounts.id, accountId),
          eq(linkedBankAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      return { success: false, error: "Webhook URL not configured" };
    }

    await plaidClient.itemWebhookUpdate({
      access_token: account.plaidAccessToken,
      webhook: webhookUrl,
    });

    return { success: true, webhookUrl };
  } catch (error) {
    console.error("Failed to update webhook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update webhook",
    };
  }
}

/**
 * Handle successful reconnection - reset error state
 */
export async function handleReconnectSuccess(accountId: string) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db
      .update(linkedBankAccounts)
      .set({
        syncStatus: "active",
        syncErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(linkedBankAccounts.id, accountId),
          eq(linkedBankAccounts.userId, userId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error("Failed to update reconnect status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}

/**
 * Exchange public token for access token and save linked account
 */
export async function exchangePublicToken(publicToken: string, metadata: {
  institution?: { institution_id: string; name: string } | null;
  accounts?: Array<{
    id: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
  }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPlaidConfigured()) {
    return { success: false, error: "Plaid is not configured" };
  }

  try {
    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Save each linked account
    const savedAccounts = [];
    for (const account of metadata.accounts || []) {
      const linkedAccount = await db
        .insert(linkedBankAccounts)
        .values({
          id: createId(),
          userId,
          plaidItemId: itemId,
          plaidAccessToken: accessToken,
          plaidAccountId: account.id,
          institutionId: metadata.institution?.institution_id,
          institutionName: metadata.institution?.name,
          accountMask: account.mask,
          accountName: account.name,
          accountType: account.type,
          accountSubtype: account.subtype,
          syncStatus: "active",
        })
        .returning();

      savedAccounts.push(linkedAccount[0]);
    }

    return {
      success: true,
      accounts: savedAccounts,
    };
  } catch (error) {
    console.error("Failed to exchange public token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to link account",
    };
  }
}

/**
 * Get all linked bank accounts for the current user
 */
export async function getLinkedAccounts() {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized", accounts: [] };
  }

  try {
    const accounts = await db
      .select({
        id: linkedBankAccounts.id,
        institutionName: linkedBankAccounts.institutionName,
        accountName: linkedBankAccounts.accountName,
        accountMask: linkedBankAccounts.accountMask,
        accountType: linkedBankAccounts.accountType,
        accountSubtype: linkedBankAccounts.accountSubtype,
        lastSyncedAt: linkedBankAccounts.lastSyncedAt,
        syncStatus: linkedBankAccounts.syncStatus,
        syncErrorMessage: linkedBankAccounts.syncErrorMessage,
        createdAt: linkedBankAccounts.createdAt,
      })
      .from(linkedBankAccounts)
      .where(eq(linkedBankAccounts.userId, userId))
      .orderBy(linkedBankAccounts.createdAt);

    return { success: true, accounts };
  } catch (error) {
    console.error("Failed to get linked accounts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get accounts",
      accounts: [],
    };
  }
}

/**
 * Unlink a bank account
 */
export async function unlinkAccount(accountId: string) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get the account to verify ownership and get access token
    const [account] = await db
      .select()
      .from(linkedBankAccounts)
      .where(
        and(
          eq(linkedBankAccounts.id, accountId),
          eq(linkedBankAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    // Check if there are other accounts using the same item
    const otherAccounts = await db
      .select()
      .from(linkedBankAccounts)
      .where(
        and(
          eq(linkedBankAccounts.plaidItemId, account.plaidItemId),
          eq(linkedBankAccounts.userId, userId)
        )
      );

    // If this is the only account for this item, remove the item from Plaid
    if (otherAccounts.length === 1) {
      try {
        await plaidClient.itemRemove({
          access_token: account.plaidAccessToken,
        });
      } catch (e) {
        // Log but don't fail - the item might already be removed
        console.warn("Failed to remove Plaid item:", e);
      }
    }

    // Delete the account from our database
    await db
      .delete(linkedBankAccounts)
      .where(eq(linkedBankAccounts.id, accountId));

    return { success: true };
  } catch (error) {
    console.error("Failed to unlink account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unlink account",
    };
  }
}

/**
 * Manually trigger a sync for a specific account
 */
export async function syncAccount(accountId: string) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get the account
    const [account] = await db
      .select()
      .from(linkedBankAccounts)
      .where(
        and(
          eq(linkedBankAccounts.id, accountId),
          eq(linkedBankAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    // Perform the sync
    const result = await syncPlaidTransactions(account);

    return result;
  } catch (error) {
    console.error("Failed to sync account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync account",
    };
  }
}

