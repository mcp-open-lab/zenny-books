"use client";

import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  transactionType: string;
  type?: string;
};

export function CategoryAssigner({
  value,
  displayValue,
  onChange,
  categories,
  transactionType,
  size = "default",
  disabled = false,
  merchantName,
  applyToFuture,
  onApplyToFutureChange,
  showApplyToFuture = true,
  className,
}: {
  value: string;
  displayValue?: string;
  onChange: (value: string) => void;
  categories: Category[];
  transactionType?: "income" | "expense";
  size?: "sm" | "default";
  disabled?: boolean;
  merchantName?: string | null;
  applyToFuture?: boolean;
  onApplyToFutureChange?: (value: boolean) => void;
  showApplyToFuture?: boolean;
  className?: string;
}) {
  const canShowRuleToggle =
    showApplyToFuture &&
    Boolean(onApplyToFutureChange) &&
    merchantName !== null &&
    merchantName !== undefined &&
    merchantName.trim().length > 0;

  return (
    <div className={cn("space-y-2", className)}>
      <CategoryCombobox
        value={value}
        displayValue={displayValue}
        onChange={onChange}
        categories={categories}
        transactionType={transactionType}
        placeholder="Select category..."
        size={size}
        disabled={disabled}
      />

      {canShowRuleToggle ? <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">
            Apply to future transactions from “{merchantName}”
          </span>
          <Switch
            checked={Boolean(applyToFuture)}
            onCheckedChange={onApplyToFutureChange}
            disabled={disabled}
          />
        </label> : null}
    </div>
  );
}


