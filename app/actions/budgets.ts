"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { categoryBudgets, categories } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { getMonthDateRange, getBudgetStatus } from "@/lib/budgets/utils";
import { EXCLUDED_BUDGET_CATEGORIES } from "@/lib/budgets/constants";
import {
  getBankTransactionSpending,
  getTotalIncome,
  getCategoryReceiptsForMonth,
  getCategoryBankTransactionsForMonth,
  getPreviousMonthTotals,
  getSpendingInsights,
  getUncategorizedCount,
} from "@/lib/budgets/queries";

export type BudgetStatus = "under" | "caution" | "over" | "unbudgeted";

export interface CategoryBudgetItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  budgeted: number;
  spent: number;
  available: number;
  status: BudgetStatus;
  transactionCount: number;
}

export interface BudgetOverview {
  month: string;
  categories: CategoryBudgetItem[];
  totalBudgeted: number;
  totalSpent: number;
  totalAvailable: number;
  readyToAssign: number;
  totalIncome: number;
  insights?: BudgetInsights;
}

export interface CategoryTransaction {
  id: string;
  date: Date | null;
  merchantName: string | null;
  description: string | null;
  amount: number;
  currency: string;
  entityType: "receipt" | "bank_transaction";
  categoryId: string | null;
  businessId: string | null;
}

export type BudgetPaceStatus = "on_track" | "ahead" | "behind";

export interface BudgetInsights {
  // Comparisons
  lastMonthSpent: number;
  lastMonthIncome: number;
  spendingChangePct: number | null;
  incomeChangePct: number | null;

  // Spending insights
  topCategory: { id: string; name: string; amount: number } | null;
  largestExpense: { merchant: string; amount: number } | null;
  transactionCount: number;
  expenseCount: number;
  avgExpense: number;

  // Budget health
  daysElapsed: number;
  daysRemaining: number;
  spendingPace: BudgetPaceStatus | null;
  categoriesOverBudget: number;
  uncategorizedCount: number;
}

async function getLatestBudgetsForCategories(
  userId: string,
  categoryIds: string[],
  beforeMonth: string
): Promise<Map<string, number>> {
  if (categoryIds.length === 0) return new Map();

  const allBudgets = await db
    .select({
      categoryId: categoryBudgets.categoryId,
      budgeted: categoryBudgets.budgeted,
      month: categoryBudgets.month,
    })
    .from(categoryBudgets)
    .where(
      and(
        eq(categoryBudgets.userId, userId),
        inArray(categoryBudgets.categoryId, categoryIds)
      )
    );

  const categoryLatest = new Map<string, { month: string; budgeted: number }>();
  for (const budget of allBudgets) {
    if (budget.month < beforeMonth) {
      const existing = categoryLatest.get(budget.categoryId);
      if (!existing || budget.month > existing.month) {
        categoryLatest.set(budget.categoryId, {
          month: budget.month,
          budgeted: Number(budget.budgeted),
        });
      }
    }
  }

  return new Map(
    Array.from(categoryLatest.entries()).map(([id, value]) => [
      id,
      value.budgeted,
    ])
  );
}

// Only bank transactions count against budget totals
// Receipts are for record-keeping only (to avoid double-counting)
function buildSpendingMap(
  txSpending: Array<{ categoryId: string | null; total: number; count: number }>
): Map<string, { total: number; count: number }> {
  const spendingMap = new Map<string, { total: number; count: number }>();

  txSpending.forEach((t) => {
    if (t.categoryId) {
      spendingMap.set(t.categoryId, {
        total: Number(t.total) || 0,
        count: Number(t.count) || 0,
      });
    }
  });

  return spendingMap;
}

export async function getLatestTransactionMonth(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const result = await db.execute(sql`
    SELECT GREATEST(
      (SELECT TO_CHAR(MAX(transaction_date), 'YYYY-MM') FROM bank_statement_transactions bst
       JOIN bank_statements bs ON bst.bank_statement_id = bs.id
       JOIN documents d ON bs.document_id = d.id
       WHERE d.user_id = ${userId}),
      (SELECT TO_CHAR(MAX(date), 'YYYY-MM') FROM receipts WHERE user_id = ${userId})
    ) as latest_month
  `);

  return (
    (result.rows[0] as { latest_month: string | null })?.latest_month || null
  );
}

export async function getBudgetOverview(
  month?: string
): Promise<{ success: boolean; data?: BudgetOverview; error?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const { start, end } = getMonthDateRange(targetMonth);

  try {
    // Fetch all data in parallel
    // Note: Only bank transactions count against budget totals
    // Receipts are for record-keeping only (to avoid double-counting)
    const [
      userCategories,
      budgets,
      txSpending,
      totalIncome,
      prevTotals,
      spendingInsights,
      uncategorizedCount,
    ] = await Promise.all([
        db
          .select()
          .from(categories)
          .where(
            sql`(${categories.type} = 'system' AND ${categories.description} LIKE 'Plaid:%') OR (${categories.type} = 'user' AND ${categories.userId} = ${userId})`
          ),
        db
          .select()
          .from(categoryBudgets)
          .where(
            and(
              eq(categoryBudgets.userId, userId),
              eq(categoryBudgets.month, targetMonth)
            )
          ),
        getBankTransactionSpending(userId, start, end),
        getTotalIncome(userId, start, end),
        getPreviousMonthTotals(userId, targetMonth),
        getSpendingInsights(userId, start, end),
        getUncategorizedCount(userId, start, end),
      ]);

    // Build budget map with persistence from previous months
    const budgetMap = new Map(
      budgets.map((b) => [b.categoryId, Number(b.budgeted)])
    );

    const categoriesWithoutBudget = userCategories
      .filter((c) => !budgetMap.has(c.id))
      .map((c) => c.id);

    const latestBudgets = await getLatestBudgetsForCategories(
      userId,
      categoriesWithoutBudget,
      targetMonth
    );

    latestBudgets.forEach((budgeted, categoryId) => {
      budgetMap.set(categoryId, budgeted);
    });

    // Build spending map from bank transactions only
    const spendingMap = buildSpendingMap(txSpending);

    // Build category items (exclude transfer categories)
    const categoryItems: CategoryBudgetItem[] = userCategories
      .filter(
        (c) =>
          (c.transactionType === "expense" || !c.transactionType) &&
          !EXCLUDED_BUDGET_CATEGORIES.includes(
            c.name as (typeof EXCLUDED_BUDGET_CATEGORIES)[number]
          )
      )
      .map((category) => {
        const budgeted = budgetMap.get(category.id) || 0;
        const spending = spendingMap.get(category.id) || { total: 0, count: 0 };
        const spent = spending.total;

        return {
          categoryId: category.id,
          categoryName: category.name,
          categoryColor: category.color,
          budgeted,
          spent,
          available: budgeted - spent,
          status: getBudgetStatus(budgeted, spent),
          transactionCount: spending.count,
        };
      })
      .sort((a, b) => {
        if (a.budgeted > 0 && b.budgeted === 0) return -1;
        if (a.budgeted === 0 && b.budgeted > 0) return 1;
        return b.spent - a.spent;
      });

    const totalBudgeted = categoryItems.reduce((sum, c) => sum + c.budgeted, 0);
    const totalSpent = categoryItems.reduce((sum, c) => sum + c.spent, 0);

    const lastMonthSpent = prevTotals.lastMonthSpent;
    const lastMonthIncome = prevTotals.lastMonthIncome;
    const spendingChangePct =
      lastMonthSpent > 0
        ? ((totalSpent - lastMonthSpent) / lastMonthSpent) * 100
        : null;
    const incomeChangePct =
      lastMonthIncome > 0
        ? ((totalIncome - lastMonthIncome) / lastMonthIncome) * 100
        : null;

    const now = new Date();
    const isCurrentMonth = targetMonth === now.toISOString().slice(0, 7);
    const daysInMonth = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0
    ).getDate();
    const daysElapsed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
    const daysRemaining = isCurrentMonth ? Math.max(0, daysInMonth - now.getDate()) : 0;

    const categoriesOverBudget = categoryItems.filter((c) => c.status === "over")
      .length;

    const effectiveSpentForPace = Math.max(0, totalSpent);
    const paceRatio = totalBudgeted > 0 ? effectiveSpentForPace / totalBudgeted : null;
    const timeRatio = daysInMonth > 0 ? daysElapsed / daysInMonth : null;
    const spendingPace: BudgetPaceStatus | null =
      paceRatio === null || timeRatio === null
        ? null
        : paceRatio > timeRatio + 0.05
          ? "behind"
          : paceRatio < timeRatio - 0.05
            ? "ahead"
            : "on_track";

    const avgExpense =
      spendingInsights.expenseCount > 0
        ? spendingInsights.expenseTotal / spendingInsights.expenseCount
        : 0;

    return {
      success: true,
      data: {
        month: targetMonth,
        categories: categoryItems,
        totalBudgeted,
        totalSpent,
        totalAvailable: totalBudgeted - totalSpent,
        readyToAssign: totalIncome - totalBudgeted,
        totalIncome,
        insights: {
          lastMonthSpent,
          lastMonthIncome,
          spendingChangePct,
          incomeChangePct,
          topCategory: spendingInsights.topCategory,
          largestExpense: spendingInsights.largestTransaction,
          transactionCount: spendingInsights.transactionCount,
          expenseCount: spendingInsights.expenseCount,
          avgExpense,
          daysElapsed,
          daysRemaining,
          spendingPace,
          categoriesOverBudget,
          uncategorizedCount,
        },
      },
    };
  } catch (error) {
    console.error("Failed to get budget overview:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get budget overview",
    };
  }
}

export async function setBudgetAmount(
  categoryId: string,
  month: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const existing = await db
      .select()
      .from(categoryBudgets)
      .where(
        and(
          eq(categoryBudgets.userId, userId),
          eq(categoryBudgets.categoryId, categoryId),
          eq(categoryBudgets.month, month)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(categoryBudgets)
        .set({ budgeted: amount.toString(), updatedAt: new Date() })
        .where(eq(categoryBudgets.id, existing[0].id));
    } else {
      await db.insert(categoryBudgets).values({
        id: createId(),
        userId,
        categoryId,
        month,
        budgeted: amount.toString(),
      });
    }

    revalidatePath("/app/budgets");
    return { success: true };
  } catch (error) {
    console.error("Failed to set budget amount:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set budget",
    };
  }
}

export async function deleteBudget(
  categoryId: string,
  month: string
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db
      .delete(categoryBudgets)
      .where(
        and(
          eq(categoryBudgets.userId, userId),
          eq(categoryBudgets.categoryId, categoryId),
          eq(categoryBudgets.month, month)
        )
      );

    revalidatePath("/app/budgets");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete budget:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete budget",
    };
  }
}

export async function getCategoryTransactions(
  categoryId: string,
  month: string
): Promise<{ success: boolean; data?: CategoryTransaction[]; error?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  const { start, end } = getMonthDateRange(month);

  try {
    const [receiptData, txData] = await Promise.all([
      getCategoryReceiptsForMonth(userId, categoryId, start, end),
      getCategoryBankTransactionsForMonth(userId, categoryId, start, end),
    ]);

    const transactions: CategoryTransaction[] = [
      ...receiptData.map((r) => ({
        id: r.id,
        date: r.date,
        merchantName: r.merchantName,
        description: r.description,
        amount: Math.abs(Number(r.totalAmount)),
        currency: r.currency || "USD",
        entityType: "receipt" as const,
        categoryId: r.categoryId,
        businessId: r.businessId,
      })),
      ...txData.map((t) => ({
        id: t.id,
        date: t.transactionDate,
        merchantName: t.merchantName,
        description: t.description,
        amount: Math.abs(Number(t.amount)),
        currency: t.currency || "USD",
        entityType: "bank_transaction" as const,
        categoryId: t.categoryId,
        businessId: t.businessId,
      })),
    ].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    });

    return { success: true, data: transactions };
  } catch (error) {
    console.error("Failed to get category transactions:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get category transactions",
    };
  }
}
