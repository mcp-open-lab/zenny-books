import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
  categories,
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
      // Net spend: expenses (negative) increase spend, refunds/credits (positive) reduce spend
      total: sql<number>`COALESCE(SUM(CAST(${bankStatementTransactions.amount} AS NUMERIC) * -1), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(bankStatementTransactions)
    .innerJoin(
      bankStatements,
      eq(bankStatementTransactions.bankStatementId, bankStatements.id)
    )
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .innerJoin(
      categories,
      eq(bankStatementTransactions.categoryId, categories.id)
    )
    .where(
      and(
        eq(documents.userId, userId),
        gte(bankStatementTransactions.transactionDate, start),
        lte(bankStatementTransactions.transactionDate, end),
        sql`${bankStatementTransactions.categoryId} IS NOT NULL`,
        // Exclude Plaid income/transfer categories from spending
        sql`${categories.description} NOT LIKE 'Plaid: INCOME%'`,
        sql`${categories.description} NOT LIKE 'Plaid: TRANSFER%'`,
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
    .innerJoin(
      categories,
      eq(bankStatementTransactions.categoryId, categories.id)
    )
    .where(
      and(
        eq(documents.userId, userId),
        gte(bankStatementTransactions.transactionDate, start),
        lte(bankStatementTransactions.transactionDate, end),
        sql`CAST(${bankStatementTransactions.amount} AS NUMERIC) > 0`,
        // Only count Plaid INCOME categories as income
        sql`${categories.description} LIKE 'Plaid: INCOME%'`,
        sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
      )
    );

  return Number(result[0]?.total) || 0;
}

export async function getPreviousMonthTotals(
  userId: string,
  month: string
): Promise<{ lastMonthIncome: number; lastMonthSpent: number }> {
  const [year, monthNum] = month.split("-").map(Number);
  const prevStart = new Date(year, monthNum - 2, 1);
  const prevEnd = new Date(year, monthNum - 1, 0, 23, 59, 59, 999);

  const spentTotalExpr = sql<number>`COALESCE(SUM(CAST(${bankStatementTransactions.amount} AS NUMERIC) * -1), 0)`;
  const incomeTotalExpr = sql<number>`COALESCE(SUM(CAST(${bankStatementTransactions.amount} AS NUMERIC)), 0)`;

  const [spentResult, incomeResult] = await Promise.all([
    db
      .select({ total: spentTotalExpr })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .innerJoin(
        categories,
        eq(bankStatementTransactions.categoryId, categories.id)
      )
      .where(
        and(
          eq(documents.userId, userId),
          gte(bankStatementTransactions.transactionDate, prevStart),
          lte(bankStatementTransactions.transactionDate, prevEnd),
          sql`${bankStatementTransactions.categoryId} IS NOT NULL`,
          sql`${categories.description} NOT LIKE 'Plaid: INCOME%'`,
          sql`${categories.description} NOT LIKE 'Plaid: TRANSFER%'`,
          sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
        )
      ),
    db
      .select({ total: incomeTotalExpr })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .innerJoin(
        categories,
        eq(bankStatementTransactions.categoryId, categories.id)
      )
      .where(
        and(
          eq(documents.userId, userId),
          gte(bankStatementTransactions.transactionDate, prevStart),
          lte(bankStatementTransactions.transactionDate, prevEnd),
          sql`CAST(${bankStatementTransactions.amount} AS NUMERIC) > 0`,
          sql`${categories.description} LIKE 'Plaid: INCOME%'`,
          sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
        )
      ),
  ]);

  return {
    lastMonthIncome: Number(incomeResult[0]?.total) || 0,
    lastMonthSpent: Number(spentResult[0]?.total) || 0,
  };
}

export async function getSpendingInsights(
  userId: string,
  start: Date,
  end: Date
): Promise<{
  topCategory: { id: string; name: string; amount: number } | null;
  largestTransaction: { merchant: string; amount: number } | null;
  transactionCount: number;
  expenseCount: number;
  expenseTotal: number;
}> {
  const spentTotalExpr = sql<number>`COALESCE(SUM(CAST(${bankStatementTransactions.amount} AS NUMERIC) * -1), 0)`;
  const absAmountExpr = sql<number>`ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC))`;

  const baseWhere = and(
    eq(documents.userId, userId),
    gte(bankStatementTransactions.transactionDate, start),
    lte(bankStatementTransactions.transactionDate, end),
    sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
  );

  const [topCategoryRows, largestRows, countRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        total: spentTotalExpr,
      })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .innerJoin(
        categories,
        eq(bankStatementTransactions.categoryId, categories.id)
      )
      .where(
        and(
          baseWhere,
          sql`${bankStatementTransactions.categoryId} IS NOT NULL`,
          sql`${categories.description} NOT LIKE 'Plaid: INCOME%'`,
          sql`${categories.description} NOT LIKE 'Plaid: TRANSFER%'`
        )
      )
      .groupBy(categories.id, categories.name)
      .orderBy(desc(spentTotalExpr))
      .limit(1),
    db
      .select({
        merchantName: bankStatementTransactions.merchantName,
        description: bankStatementTransactions.description,
        absAmount: absAmountExpr,
      })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .innerJoin(
        categories,
        eq(bankStatementTransactions.categoryId, categories.id)
      )
      .where(
        and(
          baseWhere,
          sql`${bankStatementTransactions.categoryId} IS NOT NULL`,
          sql`${categories.description} NOT LIKE 'Plaid: INCOME%'`,
          sql`${categories.description} NOT LIKE 'Plaid: TRANSFER%'`,
          sql`CAST(${bankStatementTransactions.amount} AS NUMERIC) < 0`
        )
      )
      .orderBy(desc(absAmountExpr))
      .limit(1),
    db
      .select({
        transactionCount: sql<number>`COUNT(*)`,
        expenseCount: sql<number>`COUNT(*) FILTER (WHERE CAST(${bankStatementTransactions.amount} AS NUMERIC) < 0)`,
        expenseTotal: sql<number>`COALESCE(SUM(ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC))) FILTER (WHERE CAST(${bankStatementTransactions.amount} AS NUMERIC) < 0), 0)`,
      })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .innerJoin(
        categories,
        eq(bankStatementTransactions.categoryId, categories.id)
      )
      .where(
        and(
          baseWhere,
          sql`${bankStatementTransactions.categoryId} IS NOT NULL`,
          sql`${categories.description} NOT LIKE 'Plaid: INCOME%'`,
          sql`${categories.description} NOT LIKE 'Plaid: TRANSFER%'`
        )
      ),
  ]);

  const top = topCategoryRows[0];
  const largest = largestRows[0];
  const counts = countRows[0];

  return {
    topCategory:
      top && Number(top.total) > 0
        ? { id: top.id, name: top.name, amount: Number(top.total) || 0 }
        : null,
    largestTransaction: largest
      ? {
          merchant:
            largest.merchantName?.trim() ||
            largest.description?.trim() ||
            "Unknown",
          amount: Number(largest.absAmount) || 0,
        }
      : null,
    transactionCount: Number(counts?.transactionCount) || 0,
    expenseCount: Number(counts?.expenseCount) || 0,
    expenseTotal: Number(counts?.expenseTotal) || 0,
  };
}

export async function getUncategorizedCount(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  const result = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(bankStatementTransactions)
    .innerJoin(
      bankStatements,
      eq(bankStatementTransactions.bankStatementId, bankStatements.id)
    )
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .leftJoin(
      categories,
      eq(bankStatementTransactions.categoryId, categories.id)
    )
    .where(
      and(
        eq(documents.userId, userId),
        gte(bankStatementTransactions.transactionDate, start),
        lte(bankStatementTransactions.transactionDate, end),
        sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`,
        sql`${bankStatementTransactions.categoryId} IS NULL OR ${categories.name} = 'Uncategorized'`
      )
    );

  return Number(result[0]?.count) || 0;
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
        sql`(${bankStatementTransactions.transactionFlags} IS NULL OR (${bankStatementTransactions.transactionFlags}->>'isExcludedFromTotals')::boolean IS NOT TRUE)`
      )
    )
    .orderBy(desc(bankStatementTransactions.transactionDate));
}
