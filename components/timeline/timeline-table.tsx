"use client";

import { Fragment, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useRowSelection,
  useInlineEdit,
  EditableCategoryCell,
  TransactionAmount,
  RowActions,
  BulkActionsBar,
} from "@/components/ui/data-table";
import { bulkUpdateTransactions } from "@/lib/modules/transactions/actions";
import { useCategoryAssignment } from "@/lib/hooks/use-category-assignment";
import { CategoryAssigner } from "@/components/categorization/category-assigner";
import type { TimelineItem } from "@/lib/api/timeline";
import type {
  categories as categoriesSchema,
  businesses as businessesSchema,
} from "@/lib/db/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

interface TimelineTableProps {
  items: TimelineItem[];
  categories: Category[];
  businesses: Business[];
  onItemUpdated?: (
    id: string,
    patch: Partial<
      Pick<
        TimelineItem,
        "categoryId" | "category" | "businessId" | "businessName"
      >
    >
  ) => void;
}

export function TimelineTable({
  items,
  categories,
  businesses,
  onItemUpdated,
}: TimelineTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const assignment = useCategoryAssignment({ initialApplyToFuture: true });

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
    setApplyToFuture,
  } = useInlineEdit();

  const handleStartEdit = (item: TimelineItem) => {
    startEdit(item.id, {
      categoryId: item.categoryId || "",
      businessId: item.businessId || null,
      applyToFuture: true,
    });
  };

  const handleSaveEdit = async (item: TimelineItem) => {
    if (!editState.categoryId) {
      toast.error("Please select a category");
      return;
    }

    startTransition(async () => {
      const result = await assignment.assignCategory({
        id: item.id,
        type: item.type === "receipt" ? "receipt" : "bank_transaction",
        categoryId: editState.categoryId,
        businessId: editState.businessId,
        merchantName: item.merchantName || undefined,
        applyToFuture: editState.applyToFuture,
      });

      if (result.success) {
        const categoryName =
          categories.find((c) => c.id === editState.categoryId)?.name ?? null;
        const businessName = editState.businessId
          ? businesses.find((b) => b.id === editState.businessId)?.name ?? null
          : null;

        onItemUpdated?.(item.id, {
          categoryId: editState.categoryId,
          category: categoryName,
          businessId: editState.businessId,
          businessName,
        });

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
                <Fragment key={item.id}>
                  <TableRow
                    className={cn(
                      selectedIds.has(item.id) && "bg-muted/50",
                      editing && "bg-muted/30"
                    )}
                  >
                    <TableCell className="w-12 px-2 py-2 align-top">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                    </TableCell>

                    <TableCell className="w-[180px] px-3 py-2 align-top">
                      <Link
                        href={href}
                        className="font-medium text-sm hover:text-primary hover:underline truncate block"
                      >
                        {item.merchantName || "Unknown"}
                      </Link>
                    </TableCell>

                    <TableCell className="w-24 px-3 py-2 align-top text-xs text-muted-foreground">
                      {item.date ? format(new Date(item.date), "MMM d") : "N/A"}
                    </TableCell>

                    <TableCell className="w-32 px-3 py-2 align-top text-right">
                      <TransactionAmount
                        amount={amount}
                        currency={item.currency || "USD"}
                      />
                    </TableCell>

                    <TableCell className="w-[150px] px-3 py-2 align-top">
                      <EditableCategoryCell
                        isEditing={false}
                        value={item.categoryId || ""}
                        displayValue={item.category || undefined}
                        onChange={() => {}}
                        categories={categories}
                        transactionType={getTransactionType(item)}
                        size="sm"
                      />
                    </TableCell>

                    <TableCell className="w-[120px] px-3 py-2 align-top">
                      <span className="text-xs text-muted-foreground truncate block">
                        {item.businessName || "Personal"}
                      </span>
                    </TableCell>

                    <TableCell className="w-12 px-2 py-2 align-top">
                      {!editing && (
                        <RowActions
                          isEditing={false}
                          onEdit={() => handleStartEdit(item)}
                          onSave={() => {}}
                          onCancel={() => {}}
                          isPending={isPending}
                          detailsHref={href}
                          size="sm"
                        />
                      )}
                    </TableCell>
                  </TableRow>

                  {editing ? <TableRow key={`${item.id}-edit`}>
                      <TableCell colSpan={7} className="px-3 py-3 bg-muted/10">
                        <div className="rounded-lg border bg-background p-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-muted-foreground">
                                Editing
                              </div>
                              <div className="text-sm font-medium truncate">
                                {item.merchantName || "Unknown"}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleSaveEdit(item)}
                                disabled={isPending || !editState.categoryId}
                              >
                                Save
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Category
                              </div>
                              <CategoryAssigner
                                value={editState.categoryId}
                                onChange={setCategoryId}
                                categories={categories}
                                transactionType={getTransactionType(item)}
                                merchantName={item.merchantName}
                                applyToFuture={editState.applyToFuture}
                                onApplyToFutureChange={setApplyToFuture}
                                disabled={isPending}
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Business
                              </div>
                              <Select
                                value={editState.businessId || "personal"}
                                onValueChange={(v) =>
                                  setBusinessId(v === "personal" ? null : v)
                                }
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    value="personal"
                                    className="text-xs"
                                  >
                                    Personal
                                  </SelectItem>
                                  {businesses.map((b) => (
                                    <SelectItem
                                      key={b.id}
                                      value={b.id}
                                      className="text-xs"
                                    >
                                      {b.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {businesses.length === 0 && (
                                <div className="text-[11px] text-muted-foreground">
                                  Create a business in Settings to assign
                                  transactions.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow> : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
