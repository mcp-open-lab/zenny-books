import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
} from "@/lib/db/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

const EXCLUDED_FROM_ANALYTICS_FILTER = sql`(transaction_flags IS NULL OR (transaction_flags->>'isExcludedFromAnalytics')::boolean IS NOT TRUE)`;

export async function getReceiptSpending(
  userId: string,
  start: Date,
  end: Date
) {
  return db
    .select({
      categoryId: receipts.categoryId,
      total: sql<number>`COALESCE(SUM(ABS(CAST(${receipts.totalAmount} AS NUMERIC))), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        gte(receipts.date, start),
        lte(receipts.date, end),
        sql`${receipts.categoryId} IS NOT NULL`,
        sql`(${receipts.transactionFlags} IS NULL OR (${receipts.transactionFlags}->>'isExcludedFromAnalytics')::boolean IS NOT TRUE)`
      )
    )
    .groupBy(receipts.categoryId);
}

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
        sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromAnalytics')::boolean IS NOT TRUE)`
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
        sql`CAST(${bankStatementTransactions.amount} AS NUMERIC) > 0`
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
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        eq(receipts.categoryId, categoryId),
        gte(receipts.date, start),
        lte(receipts.date, end),
        sql`(${receipts.transactionFlags} IS NULL OR (${receipts.transactionFlags}->>'isExcludedFromAnalytics')::boolean IS NOT TRUE)`
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
        sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromAnalytics')::boolean IS NOT TRUE)`
      )
    )
    .orderBy(desc(bankStatementTransactions.transactionDate));
}

