"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  getCategoryTransactions,
  type CategoryTransaction,
} from "@/lib/modules/budgets/actions";
import type { BudgetStatus } from "@/lib/modules/budgets/actions";
import { BUDGET_STATUS_CONFIG } from "@/lib/budgets/constants";
import { formatBudgetCurrency } from "@/lib/budgets/utils";
import { TransactionList } from "./transaction-list";
import { getCategoryIcon } from "@/lib/categories/icon-map";
import type {
  categories as categoriesSchema,
  businesses as businessesSchema,
} from "@/lib/db/schema";

type Category = typeof categoriesSchema.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

interface CategoryBudgetRowProps {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  budgeted: number;
  spent: number;
  available: number;
  status: BudgetStatus;
  transactionCount: number;
  currency?: string;
  month: string;
  onBudgetChange: (categoryId: string, amount: number) => void;
  allCategories: Category[];
  businesses: Business[];
  compact?: boolean;
}

export function CategoryBudgetRow({
  categoryId,
  categoryName,
  categoryColor,
  budgeted,
  spent,
  available,
  status,
  transactionCount,
  currency = "USD",
  month,
  onBudgetChange,
  allCategories,
  businesses,
  compact = false,
}: CategoryBudgetRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(budgeted.toString());
  const [isExpanded, setIsExpanded] = useState(false);
  const [transactions, setTransactions] = useState<CategoryTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(budgeted.toString());
  }, [budgeted]);

  useEffect(() => {
    if (isExpanded && transactionCount > 0 && transactions.length === 0) {
      setIsLoadingTransactions(true);
      getCategoryTransactions(categoryId, month)
        .then((result) => {
          if (result.success && result.data) {
            setTransactions(result.data);
          }
          setIsLoadingTransactions(false);
        })
        .catch(() => {
          setIsLoadingTransactions(false);
        });
    }
  }, [isExpanded, categoryId, month, transactionCount, transactions.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(budgeted.toString());
    }
  };

  const handleSave = () => {
    const newAmount = parseFloat(editValue) || 0;
    if (newAmount !== budgeted) {
      onBudgetChange(categoryId, newAmount);
    }
    setIsEditing(false);
  };

  const toggleExpand = () => {
    if (transactionCount > 0) {
      setIsExpanded(!isExpanded);
    }
  };

  const config = BUDGET_STATUS_CONFIG[status];
  const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const format = (amount: number) => formatBudgetCurrency(amount, currency);

  // Compact mode for inactive categories
  if (compact) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full flex items-center justify-between p-3 rounded-lg border border-dashed hover:border-solid hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {(() => {
            const Icon = getCategoryIcon(categoryName);
            return <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />;
          })()}
          <span className="text-sm">{categoryName}</span>
        </div>
        {isEditing ? (
          <BudgetInput
            ref={inputRef}
            value={editValue}
            onChange={setEditValue}
            onSave={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 w-24"
          />
        ) : (
          <span className="text-xs text-muted-foreground">Set budget →</span>
        )}
      </button>
    );
  }

  return (
    <div className={cn("rounded-lg border p-3 transition-colors", config.border, config.bg)}>
      {/* Mobile Layout */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center justify-between">
          <CategoryLabel
            name={categoryName}
            color={categoryColor}
            count={transactionCount}
            isExpanded={isExpanded}
            onToggle={toggleExpand}
          />
          <div className={cn("text-sm font-medium flex-shrink-0 ml-2", config.text)}>
            {format(spent)}
          </div>
        </div>
        
        <ProgressBar show={budgeted > 0} percent={percentUsed} barClass={config.bar} />

        <div className="flex justify-between items-center text-xs">
          <button
            onClick={() => setIsEditing(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isEditing ? (
              <BudgetInput
                ref={inputRef}
                value={editValue}
                onChange={setEditValue}
                onSave={handleSave}
                onKeyDown={handleKeyDown}
                className="h-6 w-20 text-xs"
              />
            ) : budgeted > 0 ? (
              <span>Budget: {format(budgeted)}</span>
            ) : (
              <span className="underline decoration-dashed">+ Set budget</span>
            )}
          </button>
          {budgeted > 0 && <span className={config.text}>Left: {format(available)}</span>}
        </div>
      </div>

      {/* Mobile Transactions */}
      {isExpanded && transactionCount > 0 && (
        <div className="md:hidden mt-3 pt-3 border-t">
          <TransactionList
            transactions={transactions}
            isLoading={isLoadingTransactions}
            currency={currency}
            variant="mobile"
            editable
            categories={allCategories}
            businesses={businesses}
            onTransactionUpdated={() => router.refresh()}
          />
        </div>
      )}

      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-[1fr,100px,100px,100px] gap-2 items-center">
        <CategoryLabel
          name={categoryName}
          color={categoryColor}
          count={transactionCount}
          isExpanded={isExpanded}
          onToggle={toggleExpand}
        />

        <div className="text-right">
          {isEditing ? (
            <BudgetInput
              ref={inputRef}
              value={editValue}
              onChange={setEditValue}
              onSave={handleSave}
              onKeyDown={handleKeyDown}
              className="h-7 w-full"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className={cn(
                "text-sm rounded px-2 py-0.5 -mx-2 transition-colors",
                budgeted > 0 
                  ? "hover:bg-muted" 
                  : "text-muted-foreground hover:text-foreground underline decoration-dashed"
              )}
            >
              {budgeted > 0 ? format(budgeted) : "Set"}
            </button>
          )}
        </div>

        <div className="text-right text-sm text-muted-foreground">{format(spent)}</div>

        <div
          className={cn(
          "text-right text-sm",
          budgeted > 0 ? cn("font-medium", config.text) : "text-muted-foreground"
          )}
        >
          {budgeted > 0 ? format(available) : "—"}
        </div>
      </div>

      {/* Desktop Progress Bar */}
      {budgeted > 0 && (
        <ProgressBar
          show={true}
          percent={percentUsed}
          barClass={config.bar}
          className="hidden md:block mt-2"
        />
      )}

      {/* Desktop Transactions */}
      {isExpanded && transactionCount > 0 && (
        <div className="hidden md:block mt-3 pt-3 border-t">
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Transactions
          </div>
          <TransactionList
            transactions={transactions}
            isLoading={isLoadingTransactions}
            currency={currency}
            variant="desktop"
            editable
            categories={allCategories}
            businesses={businesses}
            onTransactionUpdated={() => router.refresh()}
          />
        </div>
      )}
    </div>
  );
}

// Sub-components for cleaner code

function CategoryDot({ color }: { color: string | null }) {
  return (
    <div
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: color || "#6b7280" }}
    />
  );
}

interface CategoryLabelProps {
  name: string;
  color: string | null;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function CategoryLabel({ name, color, count, isExpanded, onToggle }: CategoryLabelProps) {
  const hasTransactions = count > 0;
  const Icon = getCategoryIcon(name);

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 min-w-0 text-left",
        hasTransactions && "cursor-pointer hover:opacity-80"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm truncate">{name}</span>
      {hasTransactions && (
        <>
          <span className="text-xs text-muted-foreground flex-shrink-0">({count})</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
        </>
      )}
    </button>
  );
}

interface BudgetInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  className?: string;
}

const BudgetInput = ({
  ref,
  value,
  onChange,
  onSave,
  onKeyDown,
  className,
}: BudgetInputProps & { ref?: React.RefObject<HTMLInputElement | null> }) => (
  <Input
    ref={ref}
    type="number"
    step="1"
    min="0"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onSave}
    onKeyDown={onKeyDown}
    onClick={(e) => e.stopPropagation()}
    className={cn("text-right text-sm", className)}
  />
);

interface ProgressBarProps {
  show: boolean;
  percent: number;
  barClass: string;
  className?: string;
}

function ProgressBar({ show, percent, barClass, className }: ProgressBarProps) {
  if (!show) return null;

  const isOverBudget = percent > 100;
  const displayPercent = Math.min(percent, 100);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
        <div
          className={cn("h-full transition-all duration-300", barClass)}
          style={{ width: `${displayPercent}%` }}
        />
        {isOverBudget && (
          <div
            className={cn("h-full absolute top-0 right-0 bg-red-500/20 transition-all duration-300")}
            style={{ width: `${Math.min(percent - 100, 100)}%` }}
          />
        )}
      </div>
      {isOverBudget && (
        <div className="text-xs text-red-600 dark:text-red-400 font-medium">
          {percent.toFixed(0)}% of budget
        </div>
      )}
    </div>
  );
}
