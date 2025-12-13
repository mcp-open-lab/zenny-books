"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  EditableBusinessCell,
  TransactionAmount,
  RowActions,
} from "@/components/ui/data-table";
import { CategoryAssigner } from "@/components/categorization/category-assigner";
import { useCategoryAssignment } from "@/lib/hooks/use-category-assignment";
import { Check } from "lucide-react";
import type { ReviewQueueItem as ReviewQueueItemType } from "@/lib/modules/review/actions";
import type {
  categories as categoriesSchema,
  businesses as businessesSchema,
} from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

function getReasonColor(reason: string) {
  switch (reason) {
    case "uncategorized":
      return "text-red-600 dark:text-red-400";
    case "other_category":
      return "text-amber-600 dark:text-amber-400";
    case "needs_review":
      return "text-blue-600 dark:text-blue-400";
    case "no_business":
      return "text-purple-600 dark:text-purple-400";
    default:
      return "text-muted-foreground";
  }
}

interface ReviewQueueItemProps {
  item: ReviewQueueItemType;
  categories: Category[];
  businesses: Business[];
  isSelected: boolean;
  onToggleSelect: () => void;
  onSaved: () => void;
}

export function ReviewQueueItem({
  item,
  categories,
  businesses,
  isSelected,
  onToggleSelect,
  onSaved,
}: ReviewQueueItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const {
    categoryId,
    setCategoryId,
    businessId,
    setBusinessId,
    applyToFuture,
    setApplyToFuture,
    isPending,
    assignCategory,
  } = useCategoryAssignment({
    initialCategoryId: item.categoryId || "",
    initialBusinessId: item.businessId || null,
    initialApplyToFuture: true,
  });

  const [localCategoryName, setLocalCategoryName] = useState(
    item.categoryName || null
  );
  const [localBusinessName, setLocalBusinessName] = useState(
    item.businessName || null
  );

  // Update local state when item prop changes
  useEffect(() => {
    setCategoryId(item.categoryId || "");
    setBusinessId(item.businessId || null);
    setLocalCategoryName(item.categoryName || null);
    setLocalBusinessName(item.businessName || null);
  }, [
    item.businessId,
    item.categoryId,
    item.categoryName,
    item.businessName,
    setBusinessId,
    setCategoryId,
  ]);

  const amount = parseFloat(item.amount);
  const isIncome = item.type === "bank_transaction" ? amount >= 0 : false;
  const transactionType = isIncome ? "income" : "expense";

  // Find category name from selected categoryId
  const selectedCategory = categories.find((cat) => cat.id === categoryId);
  const displayCategoryName = selectedCategory?.name || localCategoryName;

  const handleSave = async () => {
    const effectiveCategoryId = categoryId;
    if (!effectiveCategoryId) {
      toast.error("Please select a category.");
      return;
    }

    const result = await assignCategory({
      id: item.id,
      type: item.type === "receipt" ? "receipt" : "bank_transaction",
      merchantName: item.merchantName,
    });

    if (!result.success) return;

    // Update local state immediately for instant UI feedback
    const selectedCategory = categories.find(
      (cat) => cat.id === effectiveCategoryId
    );
    const selectedBusiness = businesses.find((biz) => biz.id === businessId);
    setLocalCategoryName(selectedCategory?.name || null);
    setLocalBusinessName(selectedBusiness?.name || null);

    toast.success("Updated");
    setIsEditing(false);
    onSaved();
  };

  const handleQuickApprove = () => {
    if (!categoryId) {
      toast.error("Please select a category first");
      return;
    }
    handleSave();
  };

  const href = `/app/${item.type === "receipt" ? "receipts" : "transactions"}/${
    item.id
  }`;

  return (
    <TableRow className={isSelected ? "bg-muted/50" : ""}>
      <TableCell className="w-12 py-2">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
      </TableCell>

      <TableCell className="py-2 max-w-[200px]">
        <Link
          href={href}
          className="font-medium hover:text-primary hover:underline underline-offset-4 truncate block"
        >
          {item.merchantName || "Unknown"}
        </Link>
        {item.description ? <p className="text-xs text-muted-foreground truncate">
            {item.description}
          </p> : null}
      </TableCell>

      <TableCell className="py-2 text-right">
        <div className="flex flex-col items-end">
          <TransactionAmount
            amount={amount}
            currency={item.currency || "USD"}
          />
          <span className="text-[10px] text-muted-foreground">
            {item.currency || "USD"}
          </span>
        </div>
      </TableCell>

      <TableCell className="py-2 text-sm text-muted-foreground">
        {item.date ? format(item.date, "MMM d") : "N/A"}
      </TableCell>

      <TableCell className="py-2 min-w-[180px]">
        {isEditing ? (
          <CategoryAssigner
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
            transactionType={transactionType}
            size="sm"
            merchantName={item.merchantName}
            applyToFuture={applyToFuture}
            onApplyToFutureChange={setApplyToFuture}
          />
        ) : (
          <span
            className={`text-sm ${
              !displayCategoryName ? getReasonColor(item.reason) : ""
            }`}
          >
            {displayCategoryName || "Uncategorized"}
          </span>
        )}
      </TableCell>

      <TableCell className="py-2 min-w-[150px]">
        {isEditing ? (
          <EditableBusinessCell
            isEditing={true}
            value={businessId}
            onChange={setBusinessId}
            businesses={businesses}
            size="sm"
          />
        ) : (
          <span className="text-sm text-muted-foreground">
            {localBusinessName || "Personal"}
          </span>
        )}
      </TableCell>

      <TableCell className="py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {!isEditing && categoryId ? <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleQuickApprove}
              disabled={isPending}
              title="Quick approve"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button> : null}
          <RowActions
            isEditing={isEditing}
            onEdit={() => setIsEditing(true)}
            onSave={handleSave}
            onCancel={() => {
              setIsEditing(false);
              // Reset to original values on cancel
              setCategoryId(item.categoryId || "");
              setBusinessId(item.businessId || null);
              setApplyToFuture(true);
            }}
            isPending={isPending}
            canSave={Boolean(categoryId)}
            size="sm"
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
