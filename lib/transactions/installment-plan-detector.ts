/**
 * Installment Plan Credit Detection Service
 * Detects when purchases are converted to installment plans (e.g., Amex Plan It)
 * These credits should be excluded from totals as they're not real income
 */

import { db } from "@/lib/db";
import {
  bankStatementTransactions,
  bankStatements,
  documents,
} from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import type { TransactionFlags } from "@/lib/constants/transaction-flags";
import { detectInstallmentPlanCredit } from "@/lib/constants/transaction-flags";

export interface InstallmentPlanDetectionResult {
  isInstallmentPlanCredit: boolean;
  confidence: number;
  detectionMethod?: string;
}

/**
 * Detect if a transaction is an installment plan credit
 */
export function detectInstallmentPlanCreditTransaction(
  merchantName: string | null,
  description: string | null,
  amount: number
): InstallmentPlanDetectionResult {
  const isCredit = detectInstallmentPlanCredit(merchantName, description, amount);

  if (isCredit) {
    return {
      isInstallmentPlanCredit: true,
      confidence: 0.95,
      detectionMethod: "merchant_description_pattern",
    };
  }

  return {
    isInstallmentPlanCredit: false,
    confidence: 0,
  };
}

/**
 * Auto-detect and flag installment plan credits for all user transactions
 */
export async function autoDetectInstallmentPlanCredits(userId: string): Promise<{
  flaggedCount: number;
  transactionIds: string[];
}> {
  const flaggedIds: string[] = [];

  // Get all unflagged positive transactions (credits)
  const transactions = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      ${bankStatementTransactions.merchantName} as "merchantName",
      ${bankStatementTransactions.description} as description,
      ${bankStatementTransactions.amount} as amount
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND CAST(${bankStatementTransactions.amount} AS NUMERIC) > 0
      AND (
        ${bankStatementTransactions.transactionFlags} IS NULL
        OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE
      )
  `);

  for (const row of transactions.rows as any[]) {
    const amount = parseFloat(row.amount || "0");
    const result = detectInstallmentPlanCreditTransaction(
      row.merchantName,
      row.description,
      amount
    );

    if (result.isInstallmentPlanCredit && result.confidence >= 0.9) {
      const flags: TransactionFlags = {
        isExcludedFromTotals: true,
        exclusionReason: "installment_plan_credit",
        autoDetected: true,
        detectionMethod: result.detectionMethod,
        detectionConfidence: result.confidence,
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
 * Mark a transaction as an installment plan credit
 */
export async function markAsInstallmentPlanCredit(
  transactionId: string,
  userId: string
): Promise<void> {
  const flags: TransactionFlags = {
    isExcludedFromTotals: true,
    exclusionReason: "installment_plan_credit",
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
      sql`${bankStatementTransactions.id} = ${transactionId} AND ${documents.userId} = ${userId}`
    )
    .limit(1);

  if (txCheck.length > 0) {
    await db
      .update(bankStatementTransactions)
      .set({ transactionFlags: flags })
      .where(eq(bankStatementTransactions.id, transactionId));
  }
}

