"use client";

import { useState } from "react";
import { CategoryBudgetRow } from "./category-budget-row";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { CategoryBudgetItem } from "@/lib/modules/budgets/actions";
import type {
  categories as categoriesSchema,
  businesses as businessesSchema,
} from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

interface CategoryBudgetGridProps {
  categories: CategoryBudgetItem[];
  currency?: string;
  month: string;
  onBudgetChange: (categoryId: string, amount: number) => void;
  allCategories: Category[];
  businesses: Business[];
}

export function CategoryBudgetGrid({
  categories,
  currency = "USD",
  month,
  onBudgetChange,
  allCategories,
  businesses,
}: CategoryBudgetGridProps) {
  const [showInactive, setShowInactive] = useState(false);

  // Active = has budget OR has spending this month
  const activeCategories = categories.filter((c) => c.budgeted > 0 || c.spent > 0);
  const inactiveCategories = categories.filter((c) => c.budgeted === 0 && c.spent === 0);

  // Sort: budgeted items first (by status), then unbudgeted by spent
  const sortedActive = [...activeCategories].sort((a, b) => {
    const aHasBudget = a.budgeted > 0;
    const bHasBudget = b.budgeted > 0;
    
    // Budgeted items come first
    if (aHasBudget && !bHasBudget) return -1;
    if (!aHasBudget && bHasBudget) return 1;
    
    // Within budgeted items: over > caution > under
    if (aHasBudget && bHasBudget) {
      if (a.status === "over" && b.status !== "over") return -1;
      if (a.status !== "over" && b.status === "over") return 1;
      if (a.status === "caution" && b.status === "under") return -1;
      if (a.status === "under" && b.status === "caution") return 1;
    }
    
    // Sort by spent amount
    return b.spent - a.spent;
  });

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        <p>No categories found.</p>
        <p className="text-sm mt-1">
          Add categories in Settings to start budgeting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hidden md:grid md:grid-cols-[1fr,100px,100px,100px] gap-2 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <div>Category</div>
        <div className="text-right">Budget</div>
        <div className="text-right">Spent</div>
        <div className="text-right">Left</div>
      </div>

      {/* Active Categories */}
      {sortedActive.length > 0 ? (
        <div className="space-y-2">
          {sortedActive.map((category) => (
            <CategoryBudgetRow
              key={category.categoryId}
              {...category}
              currency={currency}
              month={month}
              onBudgetChange={onBudgetChange}
              allCategories={allCategories}
              businesses={businesses}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
          <p className="text-sm">No budgets set for this month</p>
          <p className="text-xs mt-1">
            Click a category below to set a budget
          </p>
        </div>
      )}

      {/* Inactive Categories Toggle */}
      {inactiveCategories.length > 0 && (
        <div className="pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Hide {inactiveCategories.length} inactive categories
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add budget ({inactiveCategories.length} categories)
              </>
            )}
          </Button>

          {showInactive ? <div className="mt-2 space-y-2 opacity-70">
              {inactiveCategories.map((category) => (
                <CategoryBudgetRow
                  key={category.categoryId}
                  {...category}
                  currency={currency}
                  month={month}
                  onBudgetChange={onBudgetChange}
                  allCategories={allCategories}
                  businesses={businesses}
                  compact
                />
              ))}
            </div> : null}
        </div>
      )}
    </div>
  );
}
