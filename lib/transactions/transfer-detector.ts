/**
 * Internal Transfer Detection Service
 * Detects transfers between user's own accounts to prevent double-counting
 */

import { db } from "@/lib/db";
import {
  bankStatementTransactions,
  bankStatements,
  documents,
} from "@/lib/db/schema";
import { sql, and, eq } from "drizzle-orm";
import type { TransactionFlags } from "@/lib/constants/transaction-flags";
import {
  detectInternalTransfer,
  detectCreditCardPayment,
} from "@/lib/constants/transaction-flags";

export interface TransferMatch {
  id: string;
  description: string;
  amount: string;
  date: Date | null;
  confidence: number;
  reason: string;
}

export interface TransferDetectionResult {
  isTransfer: boolean;
  transferType?: "internal" | "credit_card_payment";
  matches: TransferMatch[];
  autoDetected: boolean;
  detectionMethod?: string;
}

const AMOUNT_EXACT_MATCH_TOLERANCE = 0.01; // $0.01 tolerance
const DATE_WINDOW_DAYS = 2; // Look within 2 days

/**
 * Check if two amounts are exact matches (within small tolerance)
 */
function _amountsExactMatch(amount1: string, amount2: string): boolean {
  const a1 = Math.abs(parseFloat(amount1) || 0);
  const a2 = Math.abs(parseFloat(amount2) || 0);

  return Math.abs(a1 - a2) <= AMOUNT_EXACT_MATCH_TOLERANCE;
}

/**
 * Detect if a transaction is likely a credit card payment
 */
export function detectCreditCardPaymentTransaction(
  description: string | null
): TransferDetectionResult {
  if (!description) {
    return {
      isTransfer: false,
      matches: [],
      autoDetected: false,
    };
  }

  const isCreditCardPayment = detectCreditCardPayment(description);

  if (isCreditCardPayment) {
    return {
      isTransfer: true,
      transferType: "credit_card_payment",
      matches: [],
      autoDetected: true,
      detectionMethod: "description_pattern",
    };
  }

  return {
    isTransfer: false,
    matches: [],
    autoDetected: false,
  };
}

/**
 * Detect if a transaction is likely an internal transfer by description
 */
export function detectInternalTransferByDescription(
  description: string | null
): TransferDetectionResult {
  if (!description) {
    return {
      isTransfer: false,
      matches: [],
      autoDetected: false,
    };
  }

  const isInternalTransfer = detectInternalTransfer(description);

  if (isInternalTransfer) {
    return {
      isTransfer: true,
      transferType: "internal",
      matches: [],
      autoDetected: true,
      detectionMethod: "description_pattern",
    };
  }

  return {
    isTransfer: false,
    matches: [],
    autoDetected: false,
  };
}

/**
 * Find matching transfers (opposite amount on same date)
 * This detects transfers between accounts by finding matching debits/credits
 */
export async function findMatchingTransfers(
  userId: string,
  txAmount: string | null,
  txDate: Date | null,
  excludeTransactionId?: string
): Promise<TransferDetectionResult> {
  if (!txAmount || !txDate) {
    return {
      isTransfer: false,
      matches: [],
      autoDetected: false,
    };
  }

  const amount = parseFloat(txAmount);
  if (isNaN(amount)) {
    return {
      isTransfer: false,
      matches: [],
      autoDetected: false,
    };
  }
  const oppositeAmount = -amount; // Look for opposite sign

  // Calculate date range
  const startDate = new Date(txDate);
  startDate.setDate(startDate.getDate() - DATE_WINDOW_DAYS);

  const endDate = new Date(txDate);
  endDate.setDate(endDate.getDate() + DATE_WINDOW_DAYS);

  // Query for matching transactions with opposite amount
  const results = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      ${bankStatementTransactions.description} as description,
      ${bankStatementTransactions.amount} as amount,
      ${bankStatementTransactions.transactionDate} as date,
      ABS(CAST(${
        bankStatementTransactions.amount
      } AS NUMERIC) - ${oppositeAmount}) as amount_diff
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${
    bankStatementTransactions.bankStatementId
  } = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND ${bankStatementTransactions.transactionDate} >= ${startDate}
      AND ${bankStatementTransactions.transactionDate} <= ${endDate}
      AND ABS(CAST(${
        bankStatementTransactions.amount
      } AS NUMERIC) - ${oppositeAmount}) <= ${AMOUNT_EXACT_MATCH_TOLERANCE}
      ${
        excludeTransactionId
          ? sql`AND ${bankStatementTransactions.id} != ${excludeTransactionId}`
          : sql``
      }
      AND (
        ${
          bankStatementTransactions.transactionFlags
        }->>'isInternalTransfer' IS NULL
        OR ${
          bankStatementTransactions.transactionFlags
        }->>'isInternalTransfer' = 'false'
      )
    ORDER BY amount_diff ASC, ABS(EXTRACT(EPOCH FROM (${
      bankStatementTransactions.transactionDate
    } - ${txDate}))) ASC
    LIMIT 5
  `);

  const matches: TransferMatch[] = [];

  for (const row of results.rows as any[]) {
    const amountDiff = row.amount_diff || 0;
    const isExactMatch = amountDiff <= AMOUNT_EXACT_MATCH_TOLERANCE;

    if (isExactMatch) {
      matches.push({
        id: row.id,
        description: row.description || "",
        amount: row.amount,
        date: row.date,
        confidence: 1.0,
        reason: "Matching opposite amount on same date",
      });
    }
  }

  return {
    isTransfer: matches.length > 0,
    transferType: "internal",
    matches,
    autoDetected: matches.length > 0,
    detectionMethod: matches.length > 0 ? "amount_date_match" : undefined,
  };
}

/**
 * Mark a transaction as an internal transfer
 */
export async function markAsInternalTransfer(
  transactionId: string,
  userId: string,
  transferType: "internal" | "credit_card_payment" = "internal"
): Promise<void> {
  const flags: TransactionFlags = {
    isInternalTransfer: true,
    isExcludedFromTotals: true,
    exclusionReason:
      transferType === "credit_card_payment"
        ? "credit_card_payment"
        : "internal_transfer",
    userVerified: true,
    verifiedAt: new Date().toISOString(),
    detectionMethod: "user_manual",
  };

  // Verify ownership first, then update
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

/**
 * Auto-detect and flag internal transfers for all user transactions
 * This can be run as a batch job or on-demand
 */
export async function autoDetectInternalTransfers(userId: string): Promise<{
  flaggedCount: number;
  transactionIds: string[];
}> {
  // Get all unflagged transactions
  const transactions = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      ${bankStatementTransactions.description} as description,
      ${bankStatementTransactions.amount} as amount
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND (
        ${bankStatementTransactions.transactionFlags} IS NULL
        OR (
          (${bankStatementTransactions.transactionFlags}->>'isInternalTransfer')::boolean IS NOT TRUE
          AND (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE
        )
      )
  `);

  const flaggedIds: string[] = [];

  for (const row of transactions.rows as any[]) {
    // Check description patterns for transfers
    const creditCardResult = detectCreditCardPaymentTransaction(row.description);
    const transferResult = detectInternalTransferByDescription(row.description);

    if (creditCardResult.isTransfer) {
      const flags: TransactionFlags = {
        isInternalTransfer: true,
        isExcludedFromTotals: true,
        exclusionReason: "credit_card_payment",
        autoDetected: true,
        detectionMethod: "description_pattern",
      };

      await db
        .update(bankStatementTransactions)
        .set({ transactionFlags: flags })
        .where(eq(bankStatementTransactions.id, row.id));

      flaggedIds.push(row.id);
    } else if (transferResult.isTransfer) {
      const flags: TransactionFlags = {
        isInternalTransfer: true,
        isExcludedFromTotals: true,
        exclusionReason: "internal_transfer",
        autoDetected: true,
        detectionMethod: "description_pattern",
      };

      await db
        .update(bankStatementTransactions)
        .set({ transactionFlags: flags })
        .where(eq(bankStatementTransactions.id, row.id));

      flaggedIds.push(row.id);
    }
  }

  return {
    flaggedCount: flaggedIds.length,
    transactionIds: flaggedIds,
  };
}

/**
 * Remove internal transfer flag from a transaction (preserves other flags)
 */
export async function unmarkAsInternalTransfer(
  transactionId: string,
  userId: string
): Promise<void> {
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
    delete flags.isInternalTransfer;
    delete flags.transferToAccountId;
    if (
      flags.exclusionReason === "internal_transfer" ||
      flags.exclusionReason === "credit_card_payment"
    ) {
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
