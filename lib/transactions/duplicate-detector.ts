/**
 * Duplicate Detection Service
 * Uses fuzzy matching to detect potential duplicates between receipts and bank transactions
 */

import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
} from "@/lib/db/schema";
import { sql, and, eq } from "drizzle-orm";
import { SIMILARITY_THRESHOLD } from "@/lib/constants";
import type { TransactionFlags } from "@/lib/constants/transaction-flags";

export interface DuplicateMatch {
  id: string;
  type: "receipt" | "bank_transaction";
  merchantName: string;
  amount: string;
  date: Date | null;
  confidence: number;
  matchReasons: string[];
}

export interface DuplicateDetectionResult {
  hasDuplicates: boolean;
  matches: DuplicateMatch[];
  topMatch?: DuplicateMatch;
}

const AMOUNT_TOLERANCE = 0.05; // 5% tolerance for amount matching
const DATE_WINDOW_DAYS = 3; // Look within 3 days

/**
 * Check if two amounts are similar (within tolerance)
 */
function amountsMatch(amount1: string, amount2: string): boolean {
  const a1 = Math.abs(parseFloat(amount1) || 0);
  const a2 = Math.abs(parseFloat(amount2) || 0);

  if (a1 === 0 && a2 === 0) return true;
  if (a1 === 0 || a2 === 0) return false;

  const diff = Math.abs(a1 - a2);
  const avg = (a1 + a2) / 2;
  const percentDiff = diff / avg;

  return percentDiff <= AMOUNT_TOLERANCE;
}

/**
 * Check if two dates are within the acceptable window
 */
function datesMatch(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;

  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= DATE_WINDOW_DAYS;
}

/**
 * Calculate confidence score for a potential duplicate
 */
function calculateConfidence(
  merchantSimilarity: number,
  amountMatch: boolean,
  dateMatch: boolean,
  exactAmountMatch: boolean
): number {
  let confidence = 0;

  // Merchant similarity (40% weight)
  confidence += merchantSimilarity * 0.4;

  // Amount match (40% weight)
  if (exactAmountMatch) {
    confidence += 0.4;
  } else if (amountMatch) {
    confidence += 0.3;
  }

  // Date match (20% weight)
  if (dateMatch) {
    confidence += 0.2;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Find potential duplicate bank transactions for a receipt
 */
export async function findDuplicateBankTransactions(
  userId: string,
  receiptMerchantName: string | null,
  receiptAmount: string | null,
  receiptDate: Date | null
): Promise<DuplicateDetectionResult> {
  if (!receiptMerchantName || !receiptAmount || !receiptDate) {
    return { hasDuplicates: false, matches: [] };
  }

  // Calculate date range
  const startDate = new Date(receiptDate);
  startDate.setDate(startDate.getDate() - DATE_WINDOW_DAYS);

  const endDate = new Date(receiptDate);
  endDate.setDate(endDate.getDate() + DATE_WINDOW_DAYS);

  // Query bank transactions with similarity matching
  const results = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      ${bankStatementTransactions.merchantName} as "merchantName",
      ${bankStatementTransactions.amount} as amount,
      ${bankStatementTransactions.transactionDate} as date,
      similarity(${
        bankStatementTransactions.merchantName
      }, ${receiptMerchantName}) as sim_score,
      'bank_transaction' as type
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${
    bankStatementTransactions.bankStatementId
  } = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND ${bankStatementTransactions.merchantName} IS NOT NULL
      AND ${bankStatementTransactions.transactionDate} >= ${startDate}
      AND ${bankStatementTransactions.transactionDate} <= ${endDate}
      AND similarity(${
        bankStatementTransactions.merchantName
      }, ${receiptMerchantName}) > ${SIMILARITY_THRESHOLD}
      AND (
        ${bankStatementTransactions.transactionFlags}->>'isDuplicate' IS NULL
        OR ${
          bankStatementTransactions.transactionFlags
        }->>'isDuplicate' = 'false'
      )
    ORDER BY sim_score DESC, ABS(ABS(CAST(${
      bankStatementTransactions.amount
    } AS NUMERIC)) - ${Math.abs(parseFloat(receiptAmount))}) ASC
    LIMIT 5
  `);

  const matches: DuplicateMatch[] = [];

  for (const row of results.rows as any[]) {
    const merchantSimilarity = row.sim_score || 0;
    const amountMatch = amountsMatch(receiptAmount, row.amount);
    const exactAmountMatch =
      Math.abs(parseFloat(receiptAmount)) === Math.abs(parseFloat(row.amount));
    const dateMatch = datesMatch(receiptDate, row.date);

    const confidence = calculateConfidence(
      merchantSimilarity,
      amountMatch,
      dateMatch,
      exactAmountMatch
    );

    // Only include matches with confidence > 0.5
    if (confidence > 0.5) {
      const matchReasons: string[] = [];
      if (merchantSimilarity > 0.8) matchReasons.push("Similar merchant");
      if (exactAmountMatch) matchReasons.push("Exact amount");
      else if (amountMatch) matchReasons.push("Similar amount");
      if (dateMatch) matchReasons.push("Same date range");

      matches.push({
        id: row.id,
        type: "bank_transaction",
        merchantName: row.merchantName,
        amount: row.amount,
        date: row.date,
        confidence,
        matchReasons,
      });
    }
  }

  return {
    hasDuplicates: matches.length > 0,
    matches,
    topMatch: matches[0],
  };
}

/**
 * Find potential duplicate receipts for a bank transaction
 */
export async function findDuplicateReceipts(
  userId: string,
  txMerchantName: string | null,
  txAmount: string | null,
  txDate: Date | null
): Promise<DuplicateDetectionResult> {
  if (!txMerchantName || !txAmount || !txDate) {
    return { hasDuplicates: false, matches: [] };
  }

  // Calculate date range
  const startDate = new Date(txDate);
  startDate.setDate(startDate.getDate() - DATE_WINDOW_DAYS);

  const endDate = new Date(txDate);
  endDate.setDate(endDate.getDate() + DATE_WINDOW_DAYS);

  // Query receipts with similarity matching
  const results = await db.execute(sql`
    SELECT 
      ${receipts.id} as id,
      ${receipts.merchantName} as "merchantName",
      ${receipts.totalAmount} as amount,
      ${receipts.date} as date,
      similarity(${receipts.merchantName}, ${txMerchantName}) as sim_score,
      'receipt' as type
    FROM ${receipts}
    WHERE ${receipts.userId} = ${userId}
      AND ${receipts.merchantName} IS NOT NULL
      AND ${receipts.date} >= ${startDate}
      AND ${receipts.date} <= ${endDate}
      AND similarity(${
        receipts.merchantName
      }, ${txMerchantName}) > ${SIMILARITY_THRESHOLD}
      AND (
        ${receipts.transactionFlags}->>'isDuplicate' IS NULL
        OR ${receipts.transactionFlags}->>'isDuplicate' = 'false'
      )
    ORDER BY sim_score DESC, ABS(CAST(${
      receipts.totalAmount
    } AS NUMERIC) - ${Math.abs(parseFloat(txAmount))}) ASC
    LIMIT 5
  `);

  const matches: DuplicateMatch[] = [];

  for (const row of results.rows as any[]) {
    const merchantSimilarity = row.sim_score || 0;
    const amountMatch = amountsMatch(
      Math.abs(parseFloat(txAmount)).toString(),
      row.amount
    );
    const exactAmountMatch =
      Math.abs(parseFloat(txAmount)) === parseFloat(row.amount);
    const dateMatch = datesMatch(txDate, row.date);

    const confidence = calculateConfidence(
      merchantSimilarity,
      amountMatch,
      dateMatch,
      exactAmountMatch
    );

    // Only include matches with confidence > 0.5
    if (confidence > 0.5) {
      const matchReasons: string[] = [];
      if (merchantSimilarity > 0.8) matchReasons.push("Similar merchant");
      if (exactAmountMatch) matchReasons.push("Exact amount");
      else if (amountMatch) matchReasons.push("Similar amount");
      if (dateMatch) matchReasons.push("Same date range");

      matches.push({
        id: row.id,
        type: "receipt",
        merchantName: row.merchantName,
        amount: row.amount,
        date: row.date,
        confidence,
        matchReasons,
      });
    }
  }

  return {
    hasDuplicates: matches.length > 0,
    matches,
    topMatch: matches[0],
  };
}

/**
 * Mark a transaction as a duplicate
 */
export async function markAsDuplicate(
  transactionId: string,
  transactionType: "receipt" | "bank_transaction",
  linkedTransactionId: string,
  linkedTransactionType: "receipt" | "bank_transaction",
  userId: string
): Promise<void> {
  const flags: TransactionFlags = {
    isDuplicate: true,
    linkedTransactionId,
    linkedTransactionType,
    isExcludedFromTotals: true,
    exclusionReason: "duplicate",
    userVerified: true,
    verifiedAt: new Date().toISOString(),
    detectionMethod: "user_manual",
  };

  if (transactionType === "receipt") {
    await db
      .update(receipts)
      .set({ transactionFlags: flags })
      .where(and(eq(receipts.id, transactionId), eq(receipts.userId, userId)));
  } else {
    // For bank transactions, verify ownership first, then update
    const txCheck = await db
      .select({ id: bankStatementTransactions.id })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .where(
        and(
          eq(bankStatementTransactions.id, transactionId),
          eq(documents.userId, userId)
        )
      )
      .limit(1);

    if (txCheck.length > 0) {
      await db
        .update(bankStatementTransactions)
        .set({ transactionFlags: flags })
        .where(eq(bankStatementTransactions.id, transactionId));
    }
  }
}

/**
 * Remove duplicate flag from a transaction (preserves other flags)
 */
export async function unmarkAsDuplicate(
  transactionId: string,
  transactionType: "receipt" | "bank_transaction",
  userId: string
): Promise<void> {
  if (transactionType === "receipt") {
    const existing = await db
      .select({ transactionFlags: receipts.transactionFlags })
      .from(receipts)
      .where(and(eq(receipts.id, transactionId), eq(receipts.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      const flags = (existing[0].transactionFlags as TransactionFlags) || {};
      delete flags.isDuplicate;
      delete flags.linkedTransactionId;
      delete flags.linkedTransactionType;
      delete flags.duplicateConfidence;
      if (flags.exclusionReason === "duplicate") {
        delete flags.isExcludedFromTotals;
        delete flags.exclusionReason;
      }

      const hasFlags = Object.keys(flags).length > 0;
      await db
        .update(receipts)
        .set({ transactionFlags: hasFlags ? flags : null })
        .where(
          and(eq(receipts.id, transactionId), eq(receipts.userId, userId))
        );
    }
  } else {
    // Verify ownership and get existing flags
    const existing = await db
      .select({
        id: bankStatementTransactions.id,
        transactionFlags: bankStatementTransactions.transactionFlags,
      })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .where(
        and(
          eq(bankStatementTransactions.id, transactionId),
          eq(documents.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const flags = (existing[0].transactionFlags as TransactionFlags) || {};
      delete flags.isDuplicate;
      delete flags.linkedTransactionId;
      delete flags.linkedTransactionType;
      delete flags.duplicateConfidence;
      if (flags.exclusionReason === "duplicate") {
        delete flags.isExcludedFromTotals;
        delete flags.exclusionReason;
      }

      const hasFlags = Object.keys(flags).length > 0;
      await db
        .update(bankStatementTransactions)
        .set({ transactionFlags: hasFlags ? flags : null })
        .where(eq(bankStatementTransactions.id, transactionId));
    }
  }
}
