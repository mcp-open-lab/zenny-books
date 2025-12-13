"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { BudgetInsights, BudgetPaceStatus } from "@/app/actions/budgets";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPct(value: number) {
  return `${Math.abs(value).toFixed(0)}%`;
}

function paceLabel(pace: BudgetPaceStatus) {
  if (pace === "on_track") return "On track";
  if (pace === "ahead") return "Ahead of pace";
  return "Behind pace";
}

export function InsightsPanel({
  insights,
  currency = "USD",
}: {
  insights: BudgetInsights | undefined;
  currency?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!insights) return null;

  const spendingChangePct = insights.spendingChangePct;
  const incomeChangePct = insights.incomeChangePct;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center justify-between rounded-md border bg-background px-3 py-2",
            "text-sm font-medium hover:bg-muted/40"
          )}
        >
          <span>More insights</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-3">
        {/* Comparisons */}
        <div className="rounded-md border bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            vs last month
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Spending</div>
              {spendingChangePct === null ? (
                <div className="text-sm font-medium">—</div>
              ) : (
                <div className="flex items-center gap-1 text-sm font-medium">
                  {spendingChangePct <= 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  <span>{formatPct(spendingChangePct)}</span>
                </div>
              )}
            </div>
            <div className="space-y-1 text-right">
              <div className="text-[11px] text-muted-foreground">Income</div>
              {incomeChangePct === null ? (
                <div className="text-sm font-medium">—</div>
              ) : (
                <div className="flex items-center justify-end gap-1 text-sm font-medium">
                  {incomeChangePct >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span>{formatPct(incomeChangePct)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Spending */}
        <div className="rounded-md border bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            spending
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Top category</span>
              <span className="font-medium">
                {insights.topCategory
                  ? `${insights.topCategory.name} (${formatMoney(
                      insights.topCategory.amount,
                      currency
                    )})`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Largest expense</span>
              <span className="font-medium">
                {insights.largestExpense
                  ? `${insights.largestExpense.merchant} (${formatMoney(
                      insights.largestExpense.amount,
                      currency
                    )})`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Transactions</span>
              <span className="font-medium">
                {insights.expenseCount} expenses · {insights.transactionCount} total
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Avg expense</span>
              <span className="font-medium">
                {formatMoney(insights.avgExpense, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Budget health */}
        <div className="rounded-md border bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            budget health
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Pace</span>
              <span className="font-medium">
                {insights.spendingPace ? paceLabel(insights.spendingPace) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Days remaining</span>
              <span className="font-medium">{insights.daysRemaining}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Over budget</span>
              <span className="font-medium">{insights.categoriesOverBudget}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Needs review</span>
              <span className="font-medium">{insights.uncategorizedCount}</span>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}


