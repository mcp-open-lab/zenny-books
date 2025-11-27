"use client";

import { useEffect, useState } from "react";
import { getSimilarTransactions, getSimilarTransactionStats, type SimilarTransaction } from "@/app/actions/transactions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp, Receipt, CreditCard, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SimilarTransactionsPanelProps {
  merchantName: string | null;
  transactionId?: string;
  entityType?: "receipt" | "bank_transaction";
  currency?: string;
  onRuleSuggestion?: (categoryId: string, businessId: string | null) => void;
  onCreateRuleForTransaction?: (
    merchantName: string,
    categoryId: string | null,
    businessId: string | null
  ) => void;
}

export function SimilarTransactionsPanel({
  merchantName,
  transactionId,
  entityType,
  currency = "USD",
  onRuleSuggestion,
  onCreateRuleForTransaction,
}: SimilarTransactionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<SimilarTransaction[]>([]);
  const [stats, setStats] = useState<{
    totalCount: number;
    categorizedCount: number;
    mostCommonCategory: { id: string; name: string; count: number } | null;
    mostCommonBusiness: { id: string; name: string; count: number } | null;
  } | null>(null);

  useEffect(() => {
    if (!merchantName || merchantName.trim().length === 0) {
      setTransactions([]);
      setStats(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [txData, statsData] = await Promise.all([
          getSimilarTransactions({
            merchantName,
            excludeTransactionId: transactionId,
            excludeEntityType: entityType,
          }),
          getSimilarTransactionStats({
            merchantName,
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
  }, [merchantName, transactionId, entityType]);

  if (!merchantName || merchantName.trim().length === 0) {
    return null;
  }

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

  if (!stats || stats.totalCount === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Similar Transactions
            </CardTitle>
            <CardDescription className="mt-1">
              {stats.totalCount} transaction{stats.totalCount === 1 ? "" : "s"} found for this merchant
              {stats.categorizedCount > 0 && (
                <>
                  {" "}
                  · {stats.categorizedCount} categorized
                </>
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Summary Statistics */}
          {(stats.mostCommonCategory || stats.mostCommonBusiness) && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Most Common</p>
              {stats.mostCommonCategory && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{stats.mostCommonCategory.name}</Badge>
                    <span className="text-xs text-muted-foreground">
                      ({stats.mostCommonCategory.count} time{stats.mostCommonCategory.count === 1 ? "" : "s"})
                    </span>
                  </div>
                </div>
              )}
              {stats.mostCommonBusiness && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Business:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{stats.mostCommonBusiness.name}</Badge>
                    <span className="text-xs text-muted-foreground">
                      ({stats.mostCommonBusiness.count} time{stats.mostCommonBusiness.count === 1 ? "" : "s"})
                    </span>
                  </div>
                </div>
              )}
              {onRuleSuggestion && stats.mostCommonCategory && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() =>
                    onRuleSuggestion(
                      stats.mostCommonCategory!.id,
                      stats.mostCommonBusiness?.id || null
                    )
                  }
                >
                  Use for Rule
                </Button>
              )}
            </div>
          )}

          {/* Transaction List */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent History</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {transactions.slice(0, 10).map((tx) => {
                const txUrl = tx.type === "receipt" 
                  ? `/app/receipts/${tx.id}` 
                  : `/app/transactions/${tx.id}`;

                return (
                  <div
                    key={`${tx.type}-${tx.id}`}
                    className="group relative border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Link
                      href={txUrl}
                      className="flex items-center justify-between p-2"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {tx.type === "receipt" ? (
                          <Receipt className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tx.merchantName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(tx.date), { addSuffix: true })}
                            </p>
                            {tx.categoryName && (
                              <Badge variant="secondary" className="text-xs">
                                {tx.categoryName}
                              </Badge>
                            )}
                            {tx.businessName && (
                              <Badge variant="outline" className="text-xs">
                                {tx.businessName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-semibold ml-2 flex-shrink-0">
                        {formatCurrency(parseFloat(tx.amount), currency)}
                      </p>
                    </Link>
                    
                    {/* Create Rule Button - Only show if transaction is categorized and handler is provided */}
                    {tx.categoryId && onCreateRuleForTransaction && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
                          "hover:bg-primary/10"
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onCreateRuleForTransaction(
                            tx.merchantName,
                            tx.categoryId,
                            tx.businessId
                          );
                        }}
                        title="Create rule from this transaction"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

