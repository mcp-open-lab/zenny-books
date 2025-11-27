"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";
import { format } from "date-fns";
import { Receipt, CreditCard, TrendingDown, Calendar, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { bulkUpdateMerchantCategory } from "@/app/actions/financial-categories";
import type { categories as categoriesSchema, businesses as businessesSchema } from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

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
  totalCount: number;
  totalPages: number;
  currentPage: number;
  categories: Category[];
  businesses: Business[];
};

export function MerchantDetailView({
  merchantName,
  transactions,
  totalCount,
  totalPages,
  currentPage,
  categories,
  businesses,
}: MerchantDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  // Bulk edit state
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [bulkBusinessId, setBulkBusinessId] = useState<string | null>(null);

  const handleBulkUpdate = async () => {
    if (!bulkCategoryId) {
      toast.error("Please select a category");
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkUpdateMerchantCategory({
          merchantName,
          categoryId: bulkCategoryId,
          businessId: bulkBusinessId,
        });

        toast.success(`Updated ${result.updatedCount} transaction(s) for ${merchantName}`);
        setBulkEditOpen(false);
        setBulkCategoryId("");
        setBulkBusinessId(null);
        router.refresh();
      } catch (error) {
        console.error("Bulk update error:", error);
        toast.error("Failed to update transactions");
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Transaction History ({totalCount} total)
          </h2>
          
          {/* Bulk Edit Button */}
          <Popover open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                Update All Categories
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">
                    Update All {totalCount} Transaction{totalCount !== 1 ? "s" : ""}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    This will update the category for all transactions from "{merchantName}"
                  </p>
                </div>

                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-medium">Category</label>
                  <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Business Selection */}
                {businesses.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Business (Optional)</label>
                    <Select
                      value={bulkBusinessId || "personal"}
                      onValueChange={(v) => setBulkBusinessId(v === "personal" ? null : v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal</SelectItem>
                        {businesses.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleBulkUpdate}
                    disabled={isPending || !bulkCategoryId}
                    className="flex-1"
                  >
                    {isPending ? "Updating..." : "Update All"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkEditOpen(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * 25 + 1}-{Math.min(currentPage * 25, totalCount)} of {totalCount}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-9"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

