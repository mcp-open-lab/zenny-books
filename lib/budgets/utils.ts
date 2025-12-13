import type { BudgetStatus } from "@/lib/modules/budgets/actions";

export function getMonthDateRange(month: string): { start: Date; end: Date } {
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getBudgetStatus(budgeted: number, spent: number): BudgetStatus {
  if (budgeted === 0) return "unbudgeted";
  const percentUsed = (spent / budgeted) * 100;
  if (percentUsed > 100) return "over";
  if (percentUsed >= 75) return "caution";
  return "under";
}

export function formatBudgetCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

