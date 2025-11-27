/**
 * Buy Now Pay Later (BNPL) Detection Service
 * Detects BNPL transactions and helps track installment obligations
 */

import { db } from "@/lib/db";
import { receipts, bankStatementTransactions, bankStatements, documents } from "@/lib/db/schema";
import { sql, and, eq, or } from "drizzle-orm";
import type { TransactionFlags } from "@/lib/constants/transaction-flags";

export interface BnplTransaction {
  id: string;
  type: "receipt" | "bank_transaction";
  merchantName: string;
  amount: string;
  date: Date | null;
  provider?: string;
  originalAmount?: string;
  remainingInstallments?: number;
}

export interface BnplDetectionResult {
  isBnpl: boolean;
  provider?: string;
  confidence: number;
}

// Provider patterns with confidence scores
const BNPL_PROVIDER_PATTERNS: Array<{
  pattern: RegExp;
  provider: "affirm" | "klarna" | "afterpay" | "apple_pay_later" | "other";
  confidence: number;
}> = [
  { pattern: /affirm/i, provider: "affirm", confidence: 1.0 },
  { pattern: /klarna/i, provider: "klarna", confidence: 1.0 },
  { pattern: /afterpay/i, provider: "afterpay", confidence: 1.0 },
  { pattern: /apple\s*pay\s*later/i, provider: "apple_pay_later", confidence: 1.0 },
  { pattern: /sezzle/i, provider: "other", confidence: 0.9 },
  { pattern: /zip\s*pay/i, provider: "other", confidence: 0.9 },
  { pattern: /quadpay/i, provider: "other", confidence: 0.9 },
  { pattern: /splitit/i, provider: "other", confidence: 0.9 },
];

/**
 * Detect BNPL provider from merchant name
 */
export function detectBnplProvider(merchantName: string): BnplDetectionResult {
  if (!merchantName) {
    return { isBnpl: false, confidence: 0 };
  }

  for (const { pattern, provider, confidence } of BNPL_PROVIDER_PATTERNS) {
    if (pattern.test(merchantName)) {
      return { isBnpl: true, provider, confidence };
    }
  }

  return { isBnpl: false, confidence: 0 };
}

/**
 * Get all BNPL transactions for a user
 */
export async function getBnplTransactions(userId: string): Promise<BnplTransaction[]> {
  // Get from receipts
  const receiptBnpl = await db
    .select({
      id: receipts.id,
      merchantName: receipts.merchantName,
      amount: receipts.totalAmount,
      date: receipts.date,
      transactionFlags: receipts.transactionFlags,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        sql`(${receipts.transactionFlags}->>'isBnplPurchase')::boolean = true`
      )
    );

  // Get from bank transactions
  const bankBnpl = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      ${bankStatementTransactions.merchantName} as "merchantName",
      ${bankStatementTransactions.amount} as amount,
      ${bankStatementTransactions.transactionDate} as date,
      ${bankStatementTransactions.transactionFlags} as "transactionFlags"
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND (${bankStatementTransactions.transactionFlags}->>'isBnplPurchase')::boolean = true
  `);

  const transactions: BnplTransaction[] = [];

  // Process receipts
  for (const row of receiptBnpl) {
    const flags = row.transactionFlags as TransactionFlags | null;
    transactions.push({
      id: row.id,
      type: "receipt",
      merchantName: row.merchantName || "",
      amount: row.amount || "0",
      date: row.date,
      provider: flags?.bnplProvider,
      originalAmount: flags?.bnplOriginalAmount,
      remainingInstallments: flags?.bnplRemainingInstallments,
    });
  }

  // Process bank transactions
  for (const row of bankBnpl.rows as any[]) {
    const flags = row.transactionFlags as TransactionFlags | null;
    transactions.push({
      id: row.id,
      type: "bank_transaction",
      merchantName: row.merchantName || "",
      amount: row.amount || "0",
      date: row.date,
      provider: flags?.bnplProvider,
      originalAmount: flags?.bnplOriginalAmount,
      remainingInstallments: flags?.bnplRemainingInstallments,
    });
  }

  return transactions.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.getTime() - a.date.getTime();
  });
}

/**
 * Get upcoming BNPL obligations (installments due)
 * This provides a summary of money committed to BNPL purchases
 */
export async function getBnplObligations(userId: string): Promise<{
  totalObligations: number;
  upcomingInstallments: number;
  transactions: BnplTransaction[];
}> {
  const transactions = await getBnplTransactions(userId);

  let totalObligations = 0;
  let upcomingInstallments = 0;

  for (const tx of transactions) {
    if (tx.originalAmount && tx.remainingInstallments) {
      const installmentAmount = parseFloat(tx.originalAmount) / (tx.remainingInstallments + 1);
      totalObligations += installmentAmount * tx.remainingInstallments;
      upcomingInstallments += tx.remainingInstallments;
    }
  }

  return {
    totalObligations,
    upcomingInstallments,
    transactions,
  };
}

/**
 * Auto-detect BNPL transactions and flag them
 */
export async function autoDetectBnplTransactions(userId: string): Promise<{
  flaggedCount: number;
  transactionIds: string[];
}> {
  const flaggedIds: string[] = [];

  // Check receipts
  const receiptsToCheck = await db
    .select({
      id: receipts.id,
      merchantName: receipts.merchantName,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        or(
          sql`${receipts.transactionFlags} IS NULL`,
          sql`(${receipts.transactionFlags}->>'isBnplPurchase')::boolean IS NOT TRUE`
        )
      )
    );

  for (const row of receiptsToCheck) {
    if (row.merchantName) {
      const detection = detectBnplProvider(row.merchantName);
      
      if (detection.isBnpl && detection.confidence >= 0.9) {
        const flags: TransactionFlags = {
          isBnplPurchase: true,
          bnplProvider: detection.provider as any,
          autoDetected: true,
          detectionMethod: "merchant_pattern",
          detectionConfidence: detection.confidence,
        };

        await db
          .update(receipts)
          .set({ transactionFlags: flags })
          .where(eq(receipts.id, row.id));

        flaggedIds.push(row.id);
      }
    }
  }

  // Check bank transactions
  const bankTxToCheck = await db.execute(sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      ${bankStatementTransactions.merchantName} as "merchantName"
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND (
        ${bankStatementTransactions.transactionFlags} IS NULL
        OR (${bankStatementTransactions.transactionFlags}->>'isBnplPurchase')::boolean IS NOT TRUE
      )
  `);

  for (const row of bankTxToCheck.rows as any[]) {
    if (row.merchantName) {
      const detection = detectBnplProvider(row.merchantName);
      
      if (detection.isBnpl && detection.confidence >= 0.9) {
        const flags: TransactionFlags = {
          isBnplPurchase: true,
          bnplProvider: detection.provider as any,
          autoDetected: true,
          detectionMethod: "merchant_pattern",
          detectionConfidence: detection.confidence,
        };

        await db
          .update(bankStatementTransactions)
          .set({ transactionFlags: flags })
          .where(eq(bankStatementTransactions.id, row.id));

        flaggedIds.push(row.id);
      }
    }
  }

  return {
    flaggedCount: flaggedIds.length,
    transactionIds: flaggedIds,
  };
}

/**
 * Update BNPL installment information
 */
export async function updateBnplInstallments(
  transactionId: string,
  transactionType: "receipt" | "bank_transaction",
  userId: string,
  remainingInstallments: number
): Promise<void> {
  if (transactionType === "receipt") {
    const existing = await db
      .select({ transactionFlags: receipts.transactionFlags })
      .from(receipts)
      .where(and(eq(receipts.id, transactionId), eq(receipts.userId, userId)))
      .limit(1);

    if (existing.length > 0) {
      const flags = (existing[0].transactionFlags as TransactionFlags) || {};
      flags.bnplRemainingInstallments = remainingInstallments;

      await db
        .update(receipts)
        .set({ transactionFlags: flags })
        .where(and(eq(receipts.id, transactionId), eq(receipts.userId, userId)));
    }
  } else {
    // Verify ownership first
    const txCheck = await db
      .select({ id: bankStatementTransactions.id, transactionFlags: bankStatementTransactions.transactionFlags })
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
      const flags = (txCheck[0].transactionFlags as TransactionFlags) || {};
      flags.bnplRemainingInstallments = remainingInstallments;

      await db
        .update(bankStatementTransactions)
        .set({ transactionFlags: flags })
        .where(eq(bankStatementTransactions.id, transactionId));
    }
  }
}

