import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
} from "@/lib/db/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

// Only bank transactions count against budget totals
// Receipts are for record-keeping only (to avoid double-counting with bank transactions)

export async function getBankTransactionSpending(
  userId: string,
  start: Date,
  end: Date
) {
  return db
    .select({
      categoryId: bankStatementTransactions.categoryId,
      total: sql<number>`COALESCE(SUM(ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC))), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(bankStatementTransactions)
    .innerJoin(
      bankStatements,
      eq(bankStatementTransactions.bankStatementId, bankStatements.id)
    )
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        gte(bankStatementTransactions.transactionDate, start),
        lte(bankStatementTransactions.transactionDate, end),
        sql`${bankStatementTransactions.categoryId} IS NOT NULL`,
        sql`CAST(${bankStatementTransactions.amount} AS NUMERIC) < 0`,
        sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
      )
    )
    .groupBy(bankStatementTransactions.categoryId);
}

export async function getTotalIncome(userId: string, start: Date, end: Date) {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${bankStatementTransactions.amount} AS NUMERIC)), 0)`,
    })
    .from(bankStatementTransactions)
    .innerJoin(
      bankStatements,
      eq(bankStatementTransactions.bankStatementId, bankStatements.id)
    )
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        gte(bankStatementTransactions.transactionDate, start),
        lte(bankStatementTransactions.transactionDate, end),
        sql`CAST(${bankStatementTransactions.amount} AS NUMERIC) > 0`,
        // Exclude installment plan credits (not real income)
        sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
      )
    );

  return Number(result[0]?.total) || 0;
}

export async function getCategoryReceiptsForMonth(
  userId: string,
  categoryId: string,
  start: Date,
  end: Date
) {
  return db
    .select({
      id: receipts.id,
      date: receipts.date,
      merchantName: receipts.merchantName,
      description: receipts.description,
      totalAmount: receipts.totalAmount,
      currency: receipts.currency,
      categoryId: receipts.categoryId,
      businessId: receipts.businessId,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        eq(receipts.categoryId, categoryId),
        gte(receipts.date, start),
        lte(receipts.date, end),
        sql`(${receipts.transactionFlags} IS NULL OR (${receipts.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
      )
    )
    .orderBy(desc(receipts.date));
}

export async function getCategoryBankTransactionsForMonth(
  userId: string,
  categoryId: string,
  start: Date,
  end: Date
) {
  return db
    .select({
      id: bankStatementTransactions.id,
      transactionDate: bankStatementTransactions.transactionDate,
      merchantName: bankStatementTransactions.merchantName,
      description: bankStatementTransactions.description,
      amount: bankStatementTransactions.amount,
      currency: bankStatementTransactions.currency,
      categoryId: bankStatementTransactions.categoryId,
      businessId: bankStatementTransactions.businessId,
    })
    .from(bankStatementTransactions)
    .innerJoin(
      bankStatements,
      eq(bankStatementTransactions.bankStatementId, bankStatements.id)
    )
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        eq(bankStatementTransactions.categoryId, categoryId),
        gte(bankStatementTransactions.transactionDate, start),
        lte(bankStatementTransactions.transactionDate, end),
        sql`CAST(${bankStatementTransactions.amount} AS NUMERIC) < 0`,
        sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
      )
    )
    .orderBy(desc(bankStatementTransactions.transactionDate));
}

