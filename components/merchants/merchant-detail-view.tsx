"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { Receipt, CreditCard, TrendingDown, Calendar } from "lucide-react";

type Transaction = {
  id: string;
  merchantName: string;
  date: Date | null;
  amount: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  entityType: "receipt" | "bank_transaction" | "credit_card";
  source: "receipt" | "bank_transaction";
};

type MerchantDetailViewProps = {
  merchantName: string;
  transactions: Transaction[];
};

export function MerchantDetailView({
  merchantName,
  transactions,
}: MerchantDetailViewProps) {
  // Calculate stats
  const totalSpent = transactions.reduce(
    (sum, txn) => sum + Math.abs(parseFloat(txn.amount)),
    0
  );
  const averageAmount = totalSpent / transactions.length;
  const categoryDistribution = transactions.reduce((acc, txn) => {
    if (txn.categoryName) {
      acc[txn.categoryName] = (acc[txn.categoryName] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const mostCommonCategory = Object.entries(categoryDistribution).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0];

  const receiptsCount = transactions.filter((t) => t.source === "receipt")
    .length;
  const bankTransactionsCount = transactions.filter(
    (t) => t.source === "bank_transaction"
  ).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Transactions</div>
          <div className="text-2xl font-bold mt-1">{transactions.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {receiptsCount} receipts, {bankTransactionsCount} bank
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Spent</div>
          <div className="text-2xl font-bold mt-1">
            ${totalSpent.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Avg: ${averageAmount.toFixed(2)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Most Common Category</div>
          <div className="mt-1">
            {mostCommonCategory ? (
              <Badge variant="outline">{mostCommonCategory}</Badge>
            ) : (
              <span className="text-sm text-muted-foreground">N/A</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {mostCommonCategory
              ? `${categoryDistribution[mostCommonCategory]} transactions`
              : ""}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Date Range</div>
          <div className="text-sm font-medium mt-1">
            {transactions[transactions.length - 1]?.date
              ? format(
                  new Date(transactions[transactions.length - 1].date!),
                  "MMM yyyy"
                )
              : "N/A"}{" "}
            -{" "}
            {transactions[0]?.date
              ? format(new Date(transactions[0].date!), "MMM yyyy")
              : "N/A"}
          </div>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
        <div className="space-y-2">
          {transactions.map((txn) => (
            <Link
              key={`${txn.source}-${txn.id}`}
              href={
                txn.source === "receipt"
                  ? `/app/receipts/${txn.id}`
                  : `/app/transactions/${txn.id}`
              }
              className="block"
            >
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex-shrink-0">
                    {txn.source === "receipt" ? (
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {txn.merchantName}
                      </span>
                      {txn.categoryName && (
                        <Badge variant="outline" className="text-xs">
                          {txn.categoryName}
                        </Badge>
                      )}
                    </div>
                    {txn.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {txn.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {txn.date && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(txn.date), "MMM d, yyyy")}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-base font-semibold">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="text-red-600">
                        ${Math.abs(parseFloat(txn.amount)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

