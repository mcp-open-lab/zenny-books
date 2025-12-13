/**
 * Plaid Integration Service
 * Handles Plaid transaction imports and deduplication
 */

import { db } from "@/lib/db";
import { receipts, bankStatementTransactions, bankStatements, documents } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import type { TransactionFlags } from "@/lib/constants/transaction-flags";

export interface PlaidTransaction {
  plaidTransactionId: string;
  plaidAccountId: string;
  merchantName: string;
  amount: string;
  date: Date;
  description: string;
  status: "pending" | "posted";
  category?: string[];
}

export interface PlaidImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  transactionIds: string[];
}

/**
 * Check if a Plaid transaction already exists
 */
async function plaidTransactionExists(
  plaidTransactionId: string,
  userId: string
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS(
      SELECT 1 
      FROM ${bankStatementTransactions} bst
      INNER JOIN ${bankStatements} bs ON bst.bank_statement_id = bs.id
      INNER JOIN ${documents} d ON bs.document_id = d.id
      WHERE d.user_id = ${userId}
        AND (bst.transaction_flags->>'plaidTransactionId')::text = ${plaidTransactionId}
    ) as exists
  `);

  return (result.rows[0] as any)?.exists || false;
}

/**
 * Import a single Plaid transaction
 */
export async function importPlaidTransaction(
  userId: string,
  bankStatementId: string,
  transaction: PlaidTransaction
): Promise<{ success: boolean; transactionId?: string; isDuplicate?: boolean }> {
  // Check if already imported
  const exists = await plaidTransactionExists(transaction.plaidTransactionId, userId);
  
  if (exists) {
    return { success: false, isDuplicate: true };
  }

  // Create transaction flags
  const flags: TransactionFlags = {
    isPlaidImported: true,
    plaidTransactionId: transaction.plaidTransactionId,
    plaidAccountId: transaction.plaidAccountId,
    plaidStatus: transaction.status,
  };

  // Insert transaction
  const result = await db
    .insert(bankStatementTransactions)
    .values({
      bankStatementId,
      transactionDate: transaction.date,
      description: transaction.description,
      merchantName: transaction.merchantName,
      amount: transaction.amount,
      currency: "USD", // Default, can be customized
      transactionFlags: flags,
      order: 0, // Will be updated by batch processor
    })
    .returning({ id: bankStatementTransactions.id });

  return {
    success: true,
    transactionId: result[0]?.id,
  };
}

/**
 * Import multiple Plaid transactions
 */
export async function importPlaidTransactions(
  userId: string,
  bankStatementId: string,
  transactions: PlaidTransaction[]
): Promise<PlaidImportResult> {
  const result: PlaidImportResult = {
    imported: 0,
    duplicates: 0,
    errors: 0,
    transactionIds: [],
  };

  for (const tx of transactions) {
    try {
      const importResult = await importPlaidTransaction(userId, bankStatementId, tx);
      
      if (importResult.success) {
        result.imported++;
        if (importResult.transactionId) {
          result.transactionIds.push(importResult.transactionId);
        }
      } else if (importResult.isDuplicate) {
        result.duplicates++;
      } else {
        result.errors++;
      }
    } catch (_error) {
      result.errors++;
    }
  }

  return result;
}

/**
 * Update Plaid transaction status (pending -> posted)
 */
export async function updatePlaidTransactionStatus(
  userId: string,
  plaidTransactionId: string,
  status: "pending" | "posted"
): Promise<void> {
  // Find the transaction first
  const txResult = await db.execute(sql`
    SELECT ${bankStatementTransactions.id} as id
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE (${bankStatementTransactions.transactionFlags}->>'plaidTransactionId')::text = ${plaidTransactionId}
      AND ${documents.userId} = ${userId}
    LIMIT 1
  `);

  if (txResult.rows.length === 0) return;

  const txId = (txResult.rows[0] as any).id;
  
  // Get existing flags
  const existing = await db
    .select({ transactionFlags: bankStatementTransactions.transactionFlags })
    .from(bankStatementTransactions)
    .where(eq(bankStatementTransactions.id, txId))
    .limit(1);

  if (existing.length > 0) {
    const flags = (existing[0].transactionFlags as TransactionFlags) || {};
    flags.plaidStatus = status;

    await db
      .update(bankStatementTransactions)
      .set({ transactionFlags: flags })
      .where(eq(bankStatementTransactions.id, txId));
  }
}

/**
 * Remove a Plaid transaction (e.g., when deleted in Plaid)
 */
export async function removePlaidTransaction(
  userId: string,
  plaidTransactionId: string
): Promise<void> {
  await db.execute(sql`
    DELETE FROM ${bankStatementTransactions}
    USING ${bankStatements}, ${documents}
    WHERE (${bankStatementTransactions.transactionFlags}->>'plaidTransactionId')::text = ${plaidTransactionId}
      AND ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
      AND ${bankStatements.documentId} = ${documents.id}
      AND ${documents.userId} = ${userId}
  `);
}

/**
 * Get all Plaid-imported transactions for a user
 */
export async function getPlaidTransactions(userId: string): Promise<{
  id: string;
  plaidTransactionId: string;
  plaidAccountId: string;
  merchantName: string;
  amount: string;
  date: Date;
  status: string;
}[]> {
  const result = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      ${bankStatementTransactions.merchantName} as "merchantName",
      ${bankStatementTransactions.amount} as amount,
      ${bankStatementTransactions.transactionDate} as date,
      ${bankStatementTransactions.transactionFlags}->>'plaidTransactionId' as "plaidTransactionId",
      ${bankStatementTransactions.transactionFlags}->>'plaidAccountId' as "plaidAccountId",
      ${bankStatementTransactions.transactionFlags}->>'plaidStatus' as status
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND (${bankStatementTransactions.transactionFlags}->>'isPlaidImported')::boolean = true
    ORDER BY ${bankStatementTransactions.transactionDate} DESC
  `);

  return result.rows as any[];
}

/**
 * Sync Plaid transaction updates
 * Handles updates from Plaid webhooks
 */
export async function syncPlaidTransactionUpdate(
  userId: string,
  plaidTransactionId: string,
  updates: {
    merchantName?: string;
    amount?: string;
    date?: Date;
    status?: "pending" | "posted";
  }
): Promise<void> {
  const updateFields: any = {};
  
  if (updates.merchantName !== undefined) {
    updateFields.merchantName = updates.merchantName;
  }
  
  if (updates.amount !== undefined) {
    updateFields.amount = updates.amount;
  }
  
  if (updates.date !== undefined) {
    updateFields.transactionDate = updates.date;
  }

  // Update status in flags if provided
  if (updates.status !== undefined) {
    await updatePlaidTransactionStatus(userId, plaidTransactionId, updates.status);
  }

  // Update main fields if any
  if (Object.keys(updateFields).length > 0) {
    // Find the transaction first
    const txResult = await db.execute(sql`
      SELECT ${bankStatementTransactions.id} as id
      FROM ${bankStatementTransactions}
      INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
      INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
      WHERE (${bankStatementTransactions.transactionFlags}->>'plaidTransactionId')::text = ${plaidTransactionId}
        AND ${documents.userId} = ${userId}
      LIMIT 1
    `);

    if (txResult.rows.length > 0) {
      const txId = (txResult.rows[0] as any).id;

      await db
        .update(bankStatementTransactions)
        .set(updateFields)
        .where(eq(bankStatementTransactions.id, txId));
    }
  }
}

/**
 * Find potential duplicates between Plaid and manual transactions
 * This helps users identify manual entries that can be removed after Plaid import
 */
export async function findPlaidDuplicates(
  userId: string,
  plaidTransactionId: string
): Promise<{
  receipts: Array<{ id: string; merchantName: string; amount: string; date: Date | null }>;
  manualBankTransactions: Array<{ id: string; merchantName: string; amount: string; date: Date | null }>;
}> {
  // Get the Plaid transaction details
  const plaidTxResult = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.merchantName} as "merchantName",
      ${bankStatementTransactions.amount} as amount,
      ${bankStatementTransactions.transactionDate} as date
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND (${bankStatementTransactions.transactionFlags}->>'plaidTransactionId')::text = ${plaidTransactionId}
    LIMIT 1
  `);

  if (plaidTxResult.rows.length === 0) {
    return { receipts: [], manualBankTransactions: [] };
  }

  const plaidTx = plaidTxResult.rows[0] as any;
  const { merchantName, amount, date } = plaidTx;

  // Find matching receipts
  const matchingReceipts = await db.execute(sql`
    SELECT 
      ${receipts.id} as id,
      ${receipts.merchantName} as "merchantName",
      ${receipts.totalAmount} as amount,
      ${receipts.date} as date
    FROM ${receipts}
    WHERE ${receipts.userId} = ${userId}
      AND ${receipts.merchantName} IS NOT NULL
      AND ${receipts.date} IS NOT NULL
      AND ABS(CAST(${receipts.totalAmount} AS NUMERIC) - ABS(${amount})) <= 0.01
      AND ABS(EXTRACT(EPOCH FROM (${receipts.date} - ${date}))) <= 86400 * 3
      AND similarity(${receipts.merchantName}, ${merchantName}) > 0.3
    ORDER BY similarity(${receipts.merchantName}, ${merchantName}) DESC
    LIMIT 5
  `);

  // Find matching manual bank transactions (not Plaid)
  const matchingManualTx = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      ${bankStatementTransactions.merchantName} as "merchantName",
      ${bankStatementTransactions.amount} as amount,
      ${bankStatementTransactions.transactionDate} as date
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND ${bankStatementTransactions.merchantName} IS NOT NULL
      AND ${bankStatementTransactions.transactionDate} IS NOT NULL
      AND (${bankStatementTransactions.transactionFlags}->>'isPlaidImported')::boolean IS NOT TRUE
      AND ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC) - ${amount}) <= 0.01
      AND ABS(EXTRACT(EPOCH FROM (${bankStatementTransactions.transactionDate} - ${date}))) <= 86400 * 3
      AND similarity(${bankStatementTransactions.merchantName}, ${merchantName}) > 0.3
    ORDER BY similarity(${bankStatementTransactions.merchantName}, ${merchantName}) DESC
    LIMIT 5
  `);

  return {
    receipts: matchingReceipts.rows as any[],
    manualBankTransactions: matchingManualTx.rows as any[],
  };
}

