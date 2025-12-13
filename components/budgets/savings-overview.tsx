"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BudgetInsights } from "@/app/actions/budgets";
import { InsightsPanel } from "./insights-panel";

interface SavingsOverviewProps {
  income: number;
  spent: number;
  savingsRate: number;
  budgeted: number;
  available: number;
  currency?: string;
  insights?: BudgetInsights;
}

export function SavingsOverview({
  income,
  spent,
  savingsRate,
  budgeted,
  available,
  currency = "USD",
  insights,
}: SavingsOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const saved = income - spent;
  const isPositiveSavings = saved >= 0;
  // If spent is negative, it means refunds exceeded expenses (net spending is negative)
  const netSpending = spent < 0 ? Math.abs(spent) : spent;
  const hasNetRefunds = spent < 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Key Metrics - Left/Right Aligned */}
          <div className="flex items-start justify-between gap-4">
            {/* Income - Left */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                Income
              </div>
              <div className="text-xl font-semibold text-green-600">
                {formatCurrency(income)}
              </div>
            </div>

            {/* Spent / Net Spending - Right */}
            <div className="space-y-1 text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                {hasNetRefunds ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                {hasNetRefunds ? "Net Refunds" : "Spent"}
              </div>
              <div className={cn(
                "text-xl font-semibold",
                hasNetRefunds ? "text-green-600" : ""
              )}>
                {formatCurrency(netSpending)}
              </div>
            </div>
          </div>

          {/* Net / Saved */}
          <div
            className={cn(
              "p-3 rounded-lg text-center",
              isPositiveSavings
                ? "bg-green-50 dark:bg-green-950/30"
                : "bg-red-50 dark:bg-red-950/30"
            )}
          >
            <div className="text-xs text-muted-foreground mb-1">
              {isPositiveSavings ? "Saved this month" : "Overspent"}
            </div>
            <div
              className={cn(
                "text-2xl font-bold",
                isPositiveSavings ? "text-green-600" : "text-red-600"
              )}
            >
              {isPositiveSavings ? "+" : "-"}{formatCurrency(Math.abs(saved))}
            </div>
            {income > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {Math.abs(savingsRate).toFixed(0)}% of income
              </div>
            )}
          </div>

          {/* Budget Status (if budgets exist) */}
          {budgeted > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                Budget remaining
              </span>
              <span
                className={cn(
                  "font-medium",
                  available >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(available)}
              </span>
            </div>
          )}

          <InsightsPanel insights={insights} currency={currency} />

        </div>
      </CardContent>
    </Card>
  );
}
