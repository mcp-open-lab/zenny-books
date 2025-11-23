"use server";

import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
  categories,
  businesses,
} from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { sql, eq, and, gte, lte, isNull, desc, inArray } from "drizzle-orm";
import { startOfMonth, subMonths, format } from "date-fns";

export interface SpendingTrend {
  month: string;
  totalSpent: number;
  income: number;
  expense: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  totalSpent: number;
  count: number;
  percentage: number;
}

export interface BusinessSplit {
  type: "personal" | "business";
  businessName?: string;
  totalSpent: number;
  count: number;
  percentage: number;
}

export interface TopMerchant {
  merchantName: string;
  totalSpent: number;
  count: number;
  categoryName?: string;
}

export interface AnalyticsSummary {
  totalSpent: number;
  avgMonthlySpent: number;
  topCategory: string;
  topCategoryAmount: number;
  totalIncome: number;
  totalExpense: number;
  businessExpense: number;
  personalExpense: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  spendingTrends: SpendingTrend[];
  categoryBreakdown: CategoryBreakdown[];
  businessSplit: BusinessSplit[];
  topMerchants: TopMerchant[];
}

/**
 * Get comprehensive analytics data for the user
 */
export async function getAnalyticsData(
  startDate?: Date,
  endDate?: Date
): Promise<AnalyticsData> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Default to last 12 months if no date range provided
  const defaultStartDate = startOfMonth(subMonths(new Date(), 11));
  const defaultEndDate = new Date();

  const finalStartDate = startDate || defaultStartDate;
  const finalEndDate = endDate || defaultEndDate;

  // Fetch all data in parallel
  const [
    spendingTrends,
    categoryBreakdown,
    businessSplit,
    topMerchants,
    summary,
  ] = await Promise.all([
    getSpendingTrends(userId, finalStartDate, finalEndDate),
    getCategoryBreakdown(userId, finalStartDate, finalEndDate),
    getBusinessSplit(userId, finalStartDate, finalEndDate),
    getTopMerchants(userId, finalStartDate, finalEndDate),
    getAnalyticsSummary(userId, finalStartDate, finalEndDate),
  ]);

  return {
    summary,
    spendingTrends,
    categoryBreakdown,
    businessSplit,
    topMerchants,
  };
}

/**
 * Get monthly spending trends
 */
async function getSpendingTrends(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<SpendingTrend[]> {
  // Query receipts
  const receiptTrends = await db
    .select({
      month: sql<string>`TO_CHAR(${receipts.date}, 'YYYY-MM')`,
      totalAmount: sql<number>`COALESCE(SUM(CAST(${receipts.totalAmount} AS NUMERIC)), 0)`,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        gte(receipts.date, startDate),
        lte(receipts.date, endDate)
      )
    )
    .groupBy(sql`TO_CHAR(${receipts.date}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${receipts.date}, 'YYYY-MM')`);

  // Query bank transactions
  const txTrends = await db
    .select({
      month: sql<string>`TO_CHAR(${bankStatementTransactions.transactionDate}, 'YYYY-MM')`,
      totalAmount: sql<number>`COALESCE(SUM(CAST(${bankStatementTransactions.amount} AS NUMERIC)), 0)`,
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
        gte(bankStatementTransactions.transactionDate, startDate),
        lte(bankStatementTransactions.transactionDate, endDate)
      )
    )
    .groupBy(
      sql`TO_CHAR(${bankStatementTransactions.transactionDate}, 'YYYY-MM')`
    )
    .orderBy(
      sql`TO_CHAR(${bankStatementTransactions.transactionDate}, 'YYYY-MM')`
    );

  // Merge and calculate income vs expense
  const monthMap = new Map<string, { income: number; expense: number }>();

  // Process receipts (typically expenses)
  receiptTrends.forEach((trend) => {
    if (!monthMap.has(trend.month)) {
      monthMap.set(trend.month, { income: 0, expense: 0 });
    }
    const entry = monthMap.get(trend.month)!;
    entry.expense += Math.abs(trend.totalAmount);
  });

  // Process bank transactions
  txTrends.forEach((trend) => {
    if (!monthMap.has(trend.month)) {
      monthMap.set(trend.month, { income: 0, expense: 0 });
    }
    const entry = monthMap.get(trend.month)!;
    if (trend.totalAmount >= 0) {
      entry.income += trend.totalAmount;
    } else {
      entry.expense += Math.abs(trend.totalAmount);
    }
  });

  // Convert to array and format
  return Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      totalSpent: data.expense,
      income: data.income,
      expense: data.expense,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Get spending breakdown by category
 */
async function getCategoryBreakdown(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<CategoryBreakdown[]> {
  // Query receipts
  const receiptCategories = await db
    .select({
      categoryId: receipts.categoryId,
      totalAmount: sql<number>`COALESCE(SUM(CAST(${receipts.totalAmount} AS NUMERIC)), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        gte(receipts.date, startDate),
        lte(receipts.date, endDate),
        sql`${receipts.categoryId} IS NOT NULL`
      )
    )
    .groupBy(receipts.categoryId);

  // Query bank transactions
  const txCategories = await db
    .select({
      categoryId: bankStatementTransactions.categoryId,
      totalAmount: sql<number>`COALESCE(SUM(ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC))), 0)`,
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
        gte(bankStatementTransactions.transactionDate, startDate),
        lte(bankStatementTransactions.transactionDate, endDate),
        sql`${bankStatementTransactions.categoryId} IS NOT NULL`
      )
    )
    .groupBy(bankStatementTransactions.categoryId);

  // Merge by category
  const categoryMap = new Map<string, { totalAmount: number; count: number }>();

  receiptCategories.forEach((cat) => {
    if (cat.categoryId) {
      categoryMap.set(cat.categoryId, {
        totalAmount: Math.abs(cat.totalAmount),
        count: cat.count,
      });
    }
  });

  txCategories.forEach((cat) => {
    if (cat.categoryId) {
      const existing = categoryMap.get(cat.categoryId);
      if (existing) {
        existing.totalAmount += Math.abs(cat.totalAmount);
        existing.count += cat.count;
      } else {
        categoryMap.set(cat.categoryId, {
          totalAmount: Math.abs(cat.totalAmount),
          count: cat.count,
        });
      }
    }
  });

  // Fetch category names
  const categoryIds = Array.from(categoryMap.keys());
  if (categoryIds.length === 0) return [];

  const categoryData = await db
    .select()
    .from(categories)
    .where(inArray(categories.id, categoryIds));

  const categoryNameMap = new Map(categoryData.map((c) => [c.id, c.name]));

  // Calculate total for percentage
  const total = Array.from(categoryMap.values()).reduce(
    (sum, cat) => sum + cat.totalAmount,
    0
  );

  // Build result
  return Array.from(categoryMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: categoryNameMap.get(categoryId) || "Unknown",
      totalSpent: data.totalAmount,
      count: data.count,
      percentage: total > 0 ? (data.totalAmount / total) * 100 : 0,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * Get spending split between personal and business
 */
async function getBusinessSplit(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<BusinessSplit[]> {
  // Query receipts
  const receiptSplit = await db
    .select({
      businessId: receipts.businessId,
      totalAmount: sql<number>`COALESCE(SUM(CAST(${receipts.totalAmount} AS NUMERIC)), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        gte(receipts.date, startDate),
        lte(receipts.date, endDate)
      )
    )
    .groupBy(receipts.businessId);

  // Query bank transactions
  const txSplit = await db
    .select({
      businessId: bankStatementTransactions.businessId,
      totalAmount: sql<number>`COALESCE(SUM(ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC))), 0)`,
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
        gte(bankStatementTransactions.transactionDate, startDate),
        lte(bankStatementTransactions.transactionDate, endDate)
      )
    )
    .groupBy(bankStatementTransactions.businessId);

  // Merge data
  const businessMap = new Map<
    string | null,
    { totalAmount: number; count: number }
  >();

  receiptSplit.forEach((split) => {
    const key = split.businessId || null;
    const existing = businessMap.get(key);
    if (existing) {
      existing.totalAmount += Math.abs(split.totalAmount);
      existing.count += split.count;
    } else {
      businessMap.set(key, {
        totalAmount: Math.abs(split.totalAmount),
        count: split.count,
      });
    }
  });

  txSplit.forEach((split) => {
    const key = split.businessId || null;
    const existing = businessMap.get(key);
    if (existing) {
      existing.totalAmount += Math.abs(split.totalAmount);
      existing.count += split.count;
    } else {
      businessMap.set(key, {
        totalAmount: Math.abs(split.totalAmount),
        count: split.count,
      });
    }
  });

  // Fetch business names
  const businessIds = Array.from(businessMap.keys()).filter(
    (id) => id !== null
  ) as string[];
  const businessData =
    businessIds.length > 0
      ? await db
          .select()
          .from(businesses)
          .where(inArray(businesses.id, businessIds))
      : [];

  const businessNameMap = new Map(businessData.map((b) => [b.id, b.name]));

  // Calculate total for percentage
  const total = Array.from(businessMap.values()).reduce(
    (sum, b) => sum + b.totalAmount,
    0
  );

  // Build result
  const result: BusinessSplit[] = [];

  businessMap.forEach((data, businessId) => {
    if (businessId === null) {
      result.push({
        type: "personal",
        totalSpent: data.totalAmount,
        count: data.count,
        percentage: total > 0 ? (data.totalAmount / total) * 100 : 0,
      });
    } else {
      result.push({
        type: "business",
        businessName: businessNameMap.get(businessId) || "Unknown Business",
        totalSpent: data.totalAmount,
        count: data.count,
        percentage: total > 0 ? (data.totalAmount / total) * 100 : 0,
      });
    }
  });

  return result.sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * Get top merchants by spending
 */
async function getTopMerchants(
  userId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 10
): Promise<TopMerchant[]> {
  // Query receipts
  const receiptMerchants = await db
    .select({
      merchantName: receipts.merchantName,
      categoryId: receipts.categoryId,
      totalAmount: sql<number>`COALESCE(SUM(CAST(${receipts.totalAmount} AS NUMERIC)), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        gte(receipts.date, startDate),
        lte(receipts.date, endDate),
        sql`${receipts.merchantName} IS NOT NULL`
      )
    )
    .groupBy(receipts.merchantName, receipts.categoryId);

  // Query bank transactions
  const txMerchants = await db
    .select({
      merchantName: bankStatementTransactions.merchantName,
      categoryId: bankStatementTransactions.categoryId,
      totalAmount: sql<number>`COALESCE(SUM(ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC))), 0)`,
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
        gte(bankStatementTransactions.transactionDate, startDate),
        lte(bankStatementTransactions.transactionDate, endDate),
        sql`${bankStatementTransactions.merchantName} IS NOT NULL`
      )
    )
    .groupBy(
      bankStatementTransactions.merchantName,
      bankStatementTransactions.categoryId
    );

  // Merge merchants
  const merchantMap = new Map<
    string,
    { totalAmount: number; count: number; categoryId: string | null }
  >();

  receiptMerchants.forEach((merchant) => {
    if (merchant.merchantName) {
      const key = merchant.merchantName.toLowerCase();
      const existing = merchantMap.get(key);
      if (existing) {
        existing.totalAmount += Math.abs(merchant.totalAmount);
        existing.count += merchant.count;
      } else {
        merchantMap.set(key, {
          totalAmount: Math.abs(merchant.totalAmount),
          count: merchant.count,
          categoryId: merchant.categoryId,
        });
      }
    }
  });

  txMerchants.forEach((merchant) => {
    if (merchant.merchantName) {
      const key = merchant.merchantName.toLowerCase();
      const existing = merchantMap.get(key);
      if (existing) {
        existing.totalAmount += Math.abs(merchant.totalAmount);
        existing.count += merchant.count;
      } else {
        merchantMap.set(key, {
          totalAmount: Math.abs(merchant.totalAmount),
          count: merchant.count,
          categoryId: merchant.categoryId,
        });
      }
    }
  });

  // Fetch category names
  const categoryIds = Array.from(merchantMap.values())
    .map((m) => m.categoryId)
    .filter((id) => id !== null) as string[];

  const categoryData =
    categoryIds.length > 0
      ? await db
          .select()
          .from(categories)
          .where(inArray(categories.id, categoryIds))
      : [];

  const categoryNameMap = new Map(categoryData.map((c) => [c.id, c.name]));

  // Build result
  return Array.from(merchantMap.entries())
    .map(([merchantName, data]) => ({
      merchantName,
      totalSpent: data.totalAmount,
      count: data.count,
      categoryName: data.categoryId
        ? categoryNameMap.get(data.categoryId)
        : undefined,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}

/**
 * Get summary statistics
 */
async function getAnalyticsSummary(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsSummary> {
  // Get total spent from receipts
  const receiptTotal = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${receipts.totalAmount} AS NUMERIC)), 0)`,
      businessTotal: sql<number>`COALESCE(SUM(CASE WHEN ${receipts.businessId} IS NOT NULL THEN CAST(${receipts.totalAmount} AS NUMERIC) ELSE 0 END), 0)`,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        gte(receipts.date, startDate),
        lte(receipts.date, endDate)
      )
    );

  // Get totals from bank transactions
  const txTotal = await db
    .select({
      totalIncome: sql<number>`COALESCE(SUM(CASE WHEN CAST(${bankStatementTransactions.amount} AS NUMERIC) > 0 THEN CAST(${bankStatementTransactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
      totalExpense: sql<number>`COALESCE(SUM(CASE WHEN CAST(${bankStatementTransactions.amount} AS NUMERIC) < 0 THEN ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC)) ELSE 0 END), 0)`,
      businessExpense: sql<number>`COALESCE(SUM(CASE WHEN ${bankStatementTransactions.businessId} IS NOT NULL AND CAST(${bankStatementTransactions.amount} AS NUMERIC) < 0 THEN ABS(CAST(${bankStatementTransactions.amount} AS NUMERIC)) ELSE 0 END), 0)`,
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
        gte(bankStatementTransactions.transactionDate, startDate),
        lte(bankStatementTransactions.transactionDate, endDate)
      )
    );

  // Get category breakdown for top category
  const categoryBreakdown = await getCategoryBreakdown(
    userId,
    startDate,
    endDate
  );
  const topCategory = categoryBreakdown[0] || {
    categoryName: "None",
    totalSpent: 0,
  };

  // Calculate months in range for average
  const monthsDiff =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const months = Math.max(1, Math.round(monthsDiff));

  const totalExpense =
    Math.abs(receiptTotal[0].total) + Math.abs(txTotal[0].totalExpense);
  const businessExpense =
    Math.abs(receiptTotal[0].businessTotal) +
    Math.abs(txTotal[0].businessExpense);

  return {
    totalSpent: totalExpense,
    avgMonthlySpent: totalExpense / months,
    topCategory: topCategory.categoryName,
    topCategoryAmount: topCategory.totalSpent,
    totalIncome: txTotal[0].totalIncome,
    totalExpense,
    businessExpense,
    personalExpense: totalExpense - businessExpense,
  };
}
