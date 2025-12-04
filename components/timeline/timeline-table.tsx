"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  useRowSelection,
  useInlineEdit,
  EditableCategoryCell,
  EditableBusinessCell,
  TransactionAmount,
  RowActions,
  BulkActionsBar,
} from "@/components/ui/data-table";
import {
  updateTransaction,
  bulkUpdateTransactions,
} from "@/lib/transactions/update";
import type { TimelineItem } from "@/lib/api/timeline";
import type {
  categories as categoriesSchema,
  businesses as businessesSchema,
} from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

interface TimelineTableProps {
  items: TimelineItem[];
  categories: Category[];
  businesses: Business[];
}

export function TimelineTable({
  items,
  categories,
  businesses,
}: TimelineTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  const {
    selectedIds,
    toggleItem,
    toggleAll,
    clearSelection,
    allSelected,
    someSelected,
    selectedCount,
  } = useRowSelection({ items });

  const {
    editingId,
    editState,
    startEdit,
    cancelEdit,
    isEditing,
    setCategoryId,
    setBusinessId,
  } = useInlineEdit();

  const handleStartEdit = (item: TimelineItem) => {
    startEdit(item.id, {
      categoryId: item.categoryId || "",
      businessId: item.businessId || null,
    });
  };

  const handleSaveEdit = async (item: TimelineItem) => {
    if (!editState.categoryId) {
      toast.error("Please select a category");
      return;
    }

    startTransition(async () => {
      const result = await updateTransaction({
            id: item.id,
        type: item.type === "receipt" ? "receipt" : "bank_transaction",
        categoryId: editState.categoryId,
        businessId: editState.businessId,
        merchantName: item.merchantName || undefined,
          });

      if (result.success) {
        toast.success("Updated");
        cancelEdit();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update");
      }
    });
  };

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
          merchantName: item.merchantName || undefined,
        };
      });

      const result = await bulkUpdateTransactions(updates);

      if (result.success) {
        toast.success(
          `Updated ${result.updatedCount} of ${selectedCount} transaction(s)`
        );
        clearSelection();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update transactions");
      }
    });
  };

  const getTransactionType = (item: TimelineItem): "income" | "expense" => {
    const amount = parseFloat(item.amount);
    return item.type === "transaction" && amount >= 0 ? "income" : "expense";
  };

  return (
    <div className="space-y-2">
      <BulkActionsBar
        selectedCount={selectedCount}
        categories={categories}
        businesses={businesses}
        onBulkUpdate={handleBulkUpdate}
        onClear={clearSelection}
        isPending={isPending}
      />

      <div className="border rounded-md overflow-hidden">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 px-2">
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
              <TableHead className="w-[180px] px-3">Merchant</TableHead>
              <TableHead className="w-24 px-3">Date</TableHead>
              <TableHead className="w-32 px-3 text-right">Amount</TableHead>
              <TableHead className="w-[150px] px-3">Category</TableHead>
              <TableHead className="w-[120px] px-3">Business</TableHead>
              <TableHead className="w-12 px-2"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const amount = parseFloat(item.amount);
              const editing = isEditing(item.id);
              const href =
                item.type === "transaction"
                ? `/app/transactions/${item.id}`
                : `/app/receipts/${item.id}`;

              return (
                <TableRow
                  key={item.id}
                  className={selectedIds.has(item.id) ? "bg-muted/50" : ""}
                >
                  <TableCell className="w-12 px-2 py-1.5">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                  </TableCell>

                  <TableCell className="w-[180px] px-3 py-1.5">
                    <Link
                      href={href}
                      className="font-medium text-sm hover:text-primary hover:underline truncate block"
                    >
                      {item.merchantName || "Unknown"}
                    </Link>
                  </TableCell>

                  <TableCell className="w-24 px-3 py-1.5 text-xs text-muted-foreground">
                    {item.date ? format(new Date(item.date), "MMM d") : "N/A"}
                  </TableCell>

                  <TableCell className="w-32 px-3 py-1.5 text-right">
                    <TransactionAmount
                      amount={amount}
                      currency={item.currency || "USD"}
                    />
                  </TableCell>

                  <TableCell className="w-[150px] px-3 py-1.5">
                    <EditableCategoryCell
                      isEditing={editing}
                      value={editing ? editState.categoryId : item.categoryId || ""}
                      displayValue={item.category || undefined}
                      onChange={setCategoryId}
                      categories={categories}
                      transactionType={getTransactionType(item)}
                      size="sm"
                    />
                  </TableCell>

                  <TableCell className="w-[120px] px-3 py-1.5">
                    <EditableBusinessCell
                      isEditing={editing}
                      value={editing ? editState.businessId : item.businessId || null}
                      displayValue={item.businessName || undefined}
                      onChange={setBusinessId}
                      businesses={businesses}
                      size="sm"
                    />
                  </TableCell>

                  <TableCell className="w-12 px-2 py-1.5">
                    <RowActions
                      isEditing={editing}
                      onEdit={() => handleStartEdit(item)}
                      onSave={() => handleSaveEdit(item)}
                      onCancel={cancelEdit}
                      isPending={isPending}
                      canSave={!!editState.categoryId}
                      detailsHref={href}
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
