"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createRuleFromTransaction,
  getSimilarTransactions,
  getSimilarTransactionStats,
  type SimilarTransaction,
} from "@/lib/modules/transactions/actions";
import { bulkUpdateMerchantCategory } from "@/lib/modules/categories/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { CreditCard, Receipt, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CategoryAssigner } from "@/components/categorization/category-assigner";

type Category = {
  id: string;
  name: string;
  transactionType: string;
};

type Business = {
  id: string;
  name: string;
};

interface SimilarTransactionsPanelProps {
  merchantName: string | null;
  transactionId?: string;
  entityType?: "receipt" | "bank_transaction";
  currency?: string;
  categories?: Category[];
  transactionType?: "income" | "expense";
}

export function SimilarTransactionsPanel({
  merchantName,
  transactionId,
  entityType,
  currency = "USD",
  categories = [],
  transactionType,
}: SimilarTransactionsPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, startApplyTransition] = useTransition();
  const [transactions, setTransactions] = useState<SimilarTransaction[]>([]);
  const [stats, setStats] = useState<{
    totalCount: number;
    categorizedCount: number;
    mostCommonCategory: { id: string; name: string; count: number } | null;
    mostCommonBusiness: { id: string; name: string; count: number } | null;
  } | null>(null);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");

  const normalizedMerchantName = (merchantName || "").trim();
  const hasMerchantName = normalizedMerchantName.length > 0;

  const availableCategories = useMemo(() => {
    if (!transactionType) return categories;
    return categories.filter((c) => c.transactionType === transactionType);
  }, [categories, transactionType]);

  useEffect(() => {
    if (!hasMerchantName) {
      setTransactions([]);
      setStats(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [txData, statsData] = await Promise.all([
          getSimilarTransactions({
            merchantName: normalizedMerchantName,
            excludeTransactionId: transactionId,
            excludeEntityType: entityType,
          }),
          getSimilarTransactionStats({
            merchantName: normalizedMerchantName,
            excludeTransactionId: transactionId,
            excludeEntityType: entityType,
          }),
        ]);
        setTransactions(txData);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to fetch similar transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [entityType, hasMerchantName, normalizedMerchantName, transactionId]);

  useEffect(() => {
    if (!bulkCategoryId && stats?.mostCommonCategory?.id) {
      setBulkCategoryId(stats.mostCommonCategory.id);
    }
  }, [bulkCategoryId, stats?.mostCommonCategory?.id]);

  const handleApplyToAll = () => {
    if (!hasMerchantName) {
      toast.error("Enter a merchant name to use similar transactions.");
      return;
    }
    if (!bulkCategoryId) {
      toast.error("Select a category first.");
      return;
    }

    startApplyTransition(async () => {
      try {
        await bulkUpdateMerchantCategory({
          merchantName: normalizedMerchantName,
          categoryId: bulkCategoryId,
          businessId: null,
        });

        await createRuleFromTransaction({
          merchantName: normalizedMerchantName,
          categoryId: bulkCategoryId,
          businessId: null,
          matchType: "contains",
          displayName: normalizedMerchantName,
          source: "similar_transactions",
          createdFrom: transactionId ?? null,
        });

        toast.success("Updated similar transactions", {
          description: "Applied to existing transactions and future imports.",
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update transactions"
        );
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Similar Transactions
        </CardTitle>
        <CardDescription className="mt-1">
          {hasMerchantName ? (
            stats ? (
              <>
                {stats.totalCount} transaction{stats.totalCount === 1 ? "" : "s"} found
                {stats.categorizedCount > 0 ? ` · ${stats.categorizedCount} categorized` : null}
              </>
            ) : (
              "Loading history…"
            )
          ) : (
            "Enter a merchant name to see history and recategorize."
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary (read-only) */}
        {hasMerchantName && stats && (stats.mostCommonCategory || stats.mostCommonBusiness) ? <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Most Common</p>
            {stats.mostCommonCategory ? <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Category:</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{stats.mostCommonCategory.name}</Badge>
                  <span className="text-xs text-muted-foreground">
                    ({stats.mostCommonCategory.count} time{stats.mostCommonCategory.count === 1 ? "" : "s"})
                  </span>
                </div>
              </div> : null}
          </div> : null}

        {/* Only control: change all to a new category */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Change All For This Merchant</p>
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <CategoryAssigner
              value={bulkCategoryId}
              onChange={setBulkCategoryId}
              categories={availableCategories}
              transactionType={transactionType}
              merchantName={null}
              showApplyToFuture={false}
              disabled={!hasMerchantName || isApplying}
            />
            <Button
              onClick={handleApplyToAll}
              disabled={!hasMerchantName || !bulkCategoryId || isApplying}
              className="md:h-9"
            >
              {isApplying
                ? "Applying…"
                : `Apply to all${stats?.totalCount ? ` (${stats.totalCount})` : ""}`}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This updates existing transactions for this merchant and saves the choice for future imports.
          </p>
        </div>

        {/* Recent History (read-only, no links/buttons) */}
        {hasMerchantName ? <div className="space-y-2">
            <p className="text-sm font-medium">Recent History</p>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No similar transactions found yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {transactions.slice(0, 10).map((tx) => (
                  <div
                    key={`${tx.type}-${tx.id}`}
                    className="border rounded-lg p-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {tx.type === "receipt" ? (
                          <Receipt className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.merchantName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(tx.date), { addSuffix: true })}
                            </p>
                            {tx.categoryName ? <Badge variant="secondary" className="text-xs">
                                {tx.categoryName}
                              </Badge> : null}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-semibold flex-shrink-0">
                        {formatCurrency(parseFloat(tx.amount), currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div> : null}
      </CardContent>
    </Card>
  );
}

