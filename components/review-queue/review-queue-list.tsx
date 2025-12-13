"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ReviewQueueItem } from "./review-queue-item";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useRowSelection, BulkActionsBar } from "@/components/ui/data-table";
import { bulkUpdateTransactions } from "@/lib/modules/transactions/actions";
import type { ReviewQueueItem as ReviewQueueItemType } from "@/lib/modules/review/actions";
import type {
  categories as categoriesSchema,
  businesses as businessesSchema,
} from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

interface ReviewQueueListProps {
  initialItems: ReviewQueueItemType[];
  categories: Category[];
  businesses: Business[];
}

export function ReviewQueueList({
  initialItems,
  categories,
  businesses,
}: ReviewQueueListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  // Sync items when initialItems changes (after router.refresh())
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const {
    selectedIds,
    toggleItem,
    toggleAll,
    clearSelection,
    allSelected,
    someSelected,
    selectedCount,
  } = useRowSelection({ items });

  const handleBulkUpdate = async (
    categoryId: string,
    businessId: string | null
  ) => {
    startTransition(async () => {
      const updates = Array.from(selectedIds).map((id) => {
        const item = items.find((i) => i.id === id)!;
          return {
            id,
          type: (item.type === "receipt" ? "receipt" : "bank_transaction") as
            | "receipt"
            | "bank_transaction",
          categoryId,
          businessId,
          };
        });

        const result = await bulkUpdateTransactions(updates);

        if (result.success) {
        toast.success(`Updated ${result.updatedCount} transaction(s)`);
        clearSelection();
          router.refresh();
        } else {
          toast.error(result.error || "Failed to update transactions");
      }
    });
  };

  const handleItemSaved = () => {
    router.refresh();
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              No transactions need your attention right now.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Uncategorized Transactions
          </CardTitle>
          <CardDescription>
            {items.length} transaction{items.length !== 1 ? "s" : ""} need to be
            categorized
          </CardDescription>
        </CardHeader>
      </Card>

      <BulkActionsBar
        selectedCount={selectedCount}
        categories={categories}
        businesses={businesses}
        onBulkUpdate={handleBulkUpdate}
        onClear={clearSelection}
        isPending={isPending}
      />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    ref={(el) => {
                      if (el && el instanceof HTMLInputElement) {
                        el.indeterminate = someSelected;
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Business</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <ReviewQueueItem
                  key={item.id}
                  item={item}
                  categories={categories}
                  businesses={businesses}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={() => toggleItem(item.id)}
                  onSaved={handleItemSaved}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
