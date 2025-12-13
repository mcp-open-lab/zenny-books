"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BudgetHeader } from "./budget-header";
import { CategoryBudgetGrid } from "./category-budget-grid";
import { SavingsOverview } from "./savings-overview";
import {
  setBudgetAmount,
  type BudgetOverview,
} from "@/lib/modules/budgets/actions";
import type {
  categories as categoriesSchema,
  businesses as businessesSchema,
} from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

interface BudgetPageClientProps {
  initialData: BudgetOverview;
  currency?: string;
  categories: Category[];
  businesses: Business[];
}

export function BudgetPageClient({
  initialData,
  currency = "USD",
  categories,
  businesses,
}: BudgetPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<BudgetOverview>(initialData);

  // Sync state when initialData changes (e.g., month navigation)
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleMonthChange = (month: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("month", month);
    router.push(`/app/budgets?${params.toString()}`);
  };

  const handleBudgetChange = async (categoryId: string, amount: number) => {
    setData((prev) => {
      const newCategories = prev.categories.map((c) => {
        if (c.categoryId === categoryId) {
          const newAvailable = amount - c.spent;
          // Calculate status based on budget amount
          let newStatus: "under" | "caution" | "over" | "unbudgeted";
          if (amount === 0) {
            newStatus = "unbudgeted";
          } else {
            const percentUsed = (c.spent / amount) * 100;
            if (percentUsed > 100) newStatus = "over";
            else if (percentUsed >= 75) newStatus = "caution";
            else newStatus = "under";
          }
          return {
            ...c,
            budgeted: amount,
            available: newAvailable,
            status: newStatus,
          };
        }
        return c;
      });

      const totalBudgeted = newCategories.reduce((sum, c) => sum + c.budgeted, 0);
      const totalAvailable = newCategories.reduce((sum, c) => sum + c.available, 0);
      const readyToAssign = prev.totalIncome - totalBudgeted;

      return {
        ...prev,
        categories: newCategories,
        totalBudgeted,
        totalAvailable,
        readyToAssign,
      };
    });

    startTransition(async () => {
      const result = await setBudgetAmount(categoryId, data.month, amount);
      if (!result.success) {
        toast.error(result.error || "Failed to update budget");
        router.refresh();
      }
    });
  };


  // Calculate savings rate
  const savingsRate = data.totalIncome > 0 
    ? ((data.totalIncome - data.totalSpent) / data.totalIncome) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Month Navigation - Compact */}
      <BudgetHeader
        month={data.month}
        onMonthChange={handleMonthChange}
      />

      {/* Mobile: Key metrics first */}
      <div className="lg:hidden space-y-4">
        <SavingsOverview
          income={data.totalIncome}
          spent={data.totalSpent}
          savingsRate={savingsRate}
          budgeted={data.totalBudgeted}
          available={data.totalAvailable}
          currency={currency}
          insights={data.insights}
        />
      </div>

      {/* Desktop: Single column layout */}
      <div className="hidden lg:block space-y-6">
        <SavingsOverview
          income={data.totalIncome}
          spent={data.totalSpent}
          savingsRate={savingsRate}
          budgeted={data.totalBudgeted}
          available={data.totalAvailable}
          currency={currency}
          insights={data.insights}
        />
        <CategoryBudgetGrid
          categories={data.categories}
          currency={currency}
          month={data.month}
          onBudgetChange={handleBudgetChange}
          allCategories={categories}
          businesses={businesses}
        />
      </div>

      {/* Mobile: Categories below */}
      <div className="lg:hidden">
        <CategoryBudgetGrid
          categories={data.categories}
          currency={currency}
          month={data.month}
          onBudgetChange={handleBudgetChange}
          allCategories={categories}
          businesses={businesses}
        />
      </div>

      {isPending ? <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow-lg">
          Saving...
        </div> : null}
    </div>
  );
}
