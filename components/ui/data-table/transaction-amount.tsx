"use client";

import { cn } from "@/lib/utils";

interface TransactionAmountProps {
  amount: number;
  currency?: string;
  className?: string;
  showSign?: boolean;
  size?: "sm" | "default" | "lg";
}

export function TransactionAmount({
  amount,
  currency = "USD",
  className,
  showSign = true,
  size = "default",
}: TransactionAmountProps) {
  const isIncome = amount >= 0;
  const absAmount = Math.abs(amount);

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  const sizeClasses = {
    sm: "text-xs",
    default: "text-sm",
    lg: "text-base",
  };

  return (
    <span
      className={cn(
        "font-mono",
        sizeClasses[size],
        isIncome ? "text-green-600" : "text-red-600",
        className
      )}
    >
      {showSign ? isIncome ? "+" : "-" : null}
      {formatted.replace(/^-/, "")}
    </span>
  );
}

