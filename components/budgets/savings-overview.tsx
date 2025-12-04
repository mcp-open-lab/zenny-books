"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface SavingsOverviewProps {
  income: number;
  spent: number;
  savingsRate: number;
  budgeted: number;
  available: number;
  currency?: string;
}

export function SavingsOverview({
  income,
  spent,
  savingsRate,
  budgeted,
  available,
  currency = "USD",
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

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Income */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                Income
              </div>
              <div className="text-xl font-semibold text-green-600">
                {formatCurrency(income)}
              </div>
            </div>

            {/* Spent */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                Spent
              </div>
              <div className="text-xl font-semibold">
                {formatCurrency(spent)}
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

        </div>
      </CardContent>
    </Card>
  );
}
