/**
 * Plaid Transaction Sync
 * Handles fetching transactions from Plaid and storing them in the database
 */

import { db } from "@/lib/db";
import {
  linkedBankAccounts,
  documents,
  bankStatements,
  bankStatementTransactions,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { plaidClient } from "./client";
import { mapPlaidTransactions } from "./transaction-mapper";
import type { linkedBankAccounts as LinkedBankAccountsTable } from "@/lib/db/schema";

type LinkedBankAccount = typeof LinkedBankAccountsTable.$inferSelect;

/**
 * Sync transactions for a linked bank account
 */
export async function syncPlaidTransactions(account: LinkedBankAccount): Promise<{
  success: boolean;
  transactionCount?: number;
  error?: string;
}> {
  try {
    // Update sync status to indicate sync is in progress
    await db
      .update(linkedBankAccounts)
      .set({ syncStatus: "syncing", syncErrorMessage: null })
      .where(eq(linkedBankAccounts.id, account.id));

    // Use Plaid's sync endpoint for incremental updates
    let cursor = account.lastSyncCursor || undefined;
    let hasMore = true;
    let addedTransactions: any[] = [];
    let modifiedTransactions: any[] = [];
    let removedTransactionIds: string[] = [];

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: account.plaidAccessToken,
        cursor,
        count: 500,
      });

      addedTransactions = addedTransactions.concat(response.data.added);
      modifiedTransactions = modifiedTransactions.concat(response.data.modified);
      removedTransactionIds = removedTransactionIds.concat(
        response.data.removed.map((t) => t.transaction_id)
      );

      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }

    // If no new transactions, just update the cursor and return
    if (addedTransactions.length === 0 && modifiedTransactions.length === 0) {
      await db
        .update(linkedBankAccounts)
        .set({
          lastSyncedAt: new Date(),
          lastSyncCursor: cursor,
          syncStatus: "active",
        })
        .where(eq(linkedBankAccounts.id, account.id));

      return { success: true, transactionCount: 0 };
    }

    // Create a document record for this sync
    const documentId = createId();
    await db.insert(documents).values({
      id: documentId,
      userId: account.userId,
      documentType: "bank_statement",
      fileFormat: "plaid_sync",
      fileName: `${account.institutionName || "Bank"} - ${account.accountName || "Account"} Sync`,
      fileUrl: `plaid://${account.plaidItemId}/${account.plaidAccountId}`,
      status: "completed",
      extractionMethod: "plaid_sync",
      extractionConfidence: "1.00",
      extractedAt: new Date(),
      processedAt: new Date(),
    });

    // Create a bank statement record
    const bankStatementId = createId();
    await db.insert(bankStatements).values({
      id: bankStatementId,
      documentId,
      bankName: account.institutionName,
      accountType: account.accountType,
      accountNumber: account.accountMask ? `****${account.accountMask}` : undefined,
      transactionCount: addedTransactions.length,
      processedTransactionCount: addedTransactions.length,
    });

    // Map and insert transactions
    const normalizedTransactions = mapPlaidTransactions(
      addedTransactions,
      account.plaidAccountId
    );

    let order = 0;
    for (const tx of normalizedTransactions) {
      await db.insert(bankStatementTransactions).values({
        id: createId(),
        bankStatementId,
        transactionDate: tx.transactionDate,
        postedDate: tx.postedDate,
        description: tx.description,
        merchantName: tx.merchantName,
        referenceNumber: tx.referenceNumber,
        amount: (tx.amount ?? 0).toString(),
        currency: tx.currency,
        order: order++,
      });
    }

    // Update the account with sync results
    await db
      .update(linkedBankAccounts)
      .set({
        lastSyncedAt: new Date(),
        lastSyncCursor: cursor,
        syncStatus: "active",
        syncErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(linkedBankAccounts.id, account.id));

    return {
      success: true,
      transactionCount: addedTransactions.length,
    };
  } catch (error) {
    console.error("Plaid sync failed:", error);

    // Update account with error status
    await db
      .update(linkedBankAccounts)
      .set({
        syncStatus: "error",
        syncErrorMessage: error instanceof Error ? error.message : "Sync failed",
        updatedAt: new Date(),
      })
      .where(eq(linkedBankAccounts.id, account.id));

    return {
      success: false,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

