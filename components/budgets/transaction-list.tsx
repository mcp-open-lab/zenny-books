"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatBudgetCurrency } from "@/lib/budgets/utils";
import {
  EditableCategoryCell,
  EditableBusinessCell,
  TransactionAmount,
  RowActions,
} from "@/components/ui/data-table";
import { updateTransaction } from "@/lib/modules/transactions/actions";
import type { CategoryTransaction } from "@/lib/modules/budgets/actions";
import type {
  categories as categoriesSchema,
  businesses as businessesSchema,
} from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

interface TransactionListProps {
  transactions: CategoryTransaction[];
  isLoading: boolean;
  currency: string;
  variant?: "mobile" | "desktop";
  editable?: boolean;
  categories?: Category[];
  businesses?: Business[];
  onTransactionUpdated?: () => void;
}

export function TransactionList({
  transactions,
  isLoading,
  currency,
  variant = "desktop",
  editable = false,
  categories = [],
  businesses = [],
  onTransactionUpdated,
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

  if (!editable) {
    return (
      <div
        className={
          isMobile ? "space-y-2" : "space-y-1 max-h-64 overflow-y-auto"
        }
      >
        {transactions.map((tx) => (
          <ViewOnlyTransactionRow
            key={tx.id}
            transaction={tx}
            currency={currency}
            isMobile={isMobile}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={isMobile ? "space-y-2" : "space-y-1 max-h-64 overflow-y-auto"}
    >
      {transactions.map((tx) => (
        <EditableTransactionRow
          key={tx.id}
          transaction={tx}
          currency={currency}
          isMobile={isMobile}
          categories={categories}
          businesses={businesses}
          onUpdated={onTransactionUpdated}
        />
      ))}
    </div>
  );
}

function ViewOnlyTransactionRow({
  transaction,
  currency,
  isMobile,
}: {
  transaction: CategoryTransaction;
  currency: string;
  isMobile: boolean;
}) {
  const href =
    transaction.entityType === "bank_transaction"
      ? `/app/transactions/${transaction.id}`
      : `/app/receipts/${transaction.id}`;

  return (
    <Link
      href={href}
      className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate group-hover:text-primary">
          {transaction.merchantName || transaction.description || "Unknown"}
        </div>
        {transaction.date ? <div className="text-muted-foreground text-[10px] mt-0.5">
            {format(
              new Date(transaction.date),
              isMobile ? "MMM d" : "MMM d, yyyy"
            )}
          </div> : null}
      </div>
      <div className={`text-right flex-shrink-0 ${isMobile ? "ml-2" : "ml-4"}`}>
        <div className="font-medium text-red-600">
          -{formatBudgetCurrency(transaction.amount, currency)}
        </div>
      </div>
    </Link>
  );
}

function EditableTransactionRow({
  transaction,
  currency,
  isMobile,
  categories,
  businesses,
  onUpdated,
}: {
  transaction: CategoryTransaction;
  currency: string;
  isMobile: boolean;
  categories: Category[];
  businesses: Business[];
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(transaction.categoryId || "");
  const [businessId, setBusinessId] = useState<string | null>(
    transaction.businessId || null
  );

  const href =
    transaction.entityType === "bank_transaction"
      ? `/app/transactions/${transaction.id}`
      : `/app/receipts/${transaction.id}`;

  const handleSave = () => {
    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    startTransition(async () => {
      const result = await updateTransaction({
        id: transaction.id,
        type:
          transaction.entityType === "bank_transaction"
            ? "bank_transaction"
            : "receipt",
        categoryId,
        businessId,
        merchantName: transaction.merchantName || undefined,
      });

      if (result.success) {
        toast.success("Updated");
        setIsEditing(false);
        router.refresh();
        onUpdated?.();
      } else {
        toast.error(result.error || "Failed to update");
      }
    });
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 text-xs py-2 px-2 rounded bg-muted/30 border">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {transaction.merchantName || transaction.description || "Unknown"}
            </div>
            {transaction.date ? <div className="text-muted-foreground text-[10px] mt-0.5">
                {format(
                  new Date(transaction.date),
                  isMobile ? "MMM d" : "MMM d, yyyy"
                )}
              </div> : null}
          </div>
          <TransactionAmount
            amount={-transaction.amount}
            currency={currency}
            size="sm"
          />
        </div>

        <div className={`flex gap-2 ${isMobile ? "flex-col" : "items-center"}`}>
          <div className={isMobile ? "flex-1" : "w-40"}>
            <EditableCategoryCell
              isEditing={true}
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              transactionType="expense"
              size="sm"
            />
          </div>
          {businesses.length > 0 && (
            <div className={isMobile ? "flex-1" : "w-32"}>
              <EditableBusinessCell
                isEditing={true}
                value={businessId}
                onChange={setBusinessId}
                businesses={businesses}
                size="sm"
              />
            </div>
          )}
          <RowActions
            isEditing={true}
            onEdit={() => {}}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
            isPending={isPending}
            canSave={Boolean(categoryId)}
            size="sm"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50 transition-colors group">
      <Link href={href} className="flex-1 min-w-0">
        <div className="font-medium truncate group-hover:text-primary">
          {transaction.merchantName || transaction.description || "Unknown"}
        </div>
        {transaction.date ? <div className="text-muted-foreground text-[10px] mt-0.5">
            {format(
              new Date(transaction.date),
              isMobile ? "MMM d" : "MMM d, yyyy"
            )}
          </div> : null}
      </Link>
      <div className={`flex items-center gap-2 ${isMobile ? "ml-2" : "ml-4"}`}>
        <div className="font-medium text-red-600">
          -{formatBudgetCurrency(transaction.amount, currency)}
        </div>
        <RowActions
          isEditing={false}
          onEdit={() => setIsEditing(true)}
          onSave={() => {}}
          onCancel={() => {}}
          size="sm"
        />
      </div>
    </div>
  );
}
