"use client";

import Link from "next/link";
import { format } from "date-fns";
import { formatBudgetCurrency } from "@/lib/budget/utils";
import type { CategoryTransaction } from "@/app/actions/budgets";

interface TransactionListProps {
  transactions: CategoryTransaction[];
  isLoading: boolean;
  currency: string;
  variant?: "mobile" | "desktop";
}

export function TransactionList({
  transactions,
  isLoading,
  currency,
  variant = "desktop",
}: TransactionListProps) {
  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        Loading transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        No transactions found
      </div>
    );
  }

  const isMobile = variant === "mobile";

  return (
    <div className={isMobile ? "space-y-2" : "space-y-1 max-h-64 overflow-y-auto"}>
      {transactions.map((tx) => {
        const href =
          tx.entityType === "bank_transaction"
            ? `/app/transactions/${tx.id}`
            : `/app/receipts/${tx.id}`;

        return (
          <Link
            key={tx.id}
            href={href}
            className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate group-hover:text-primary">
                {tx.merchantName || tx.description || "Unknown"}
              </div>
              {tx.date && (
                <div className="text-muted-foreground text-[10px] mt-0.5">
                  {format(new Date(tx.date), isMobile ? "MMM d" : "MMM d, yyyy")}
                </div>
              )}
            </div>
            <div className={`text-right flex-shrink-0 ${isMobile ? "ml-2" : "ml-4"}`}>
              <div className="font-medium text-red-600">
                -{formatBudgetCurrency(tx.amount, currency)}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

