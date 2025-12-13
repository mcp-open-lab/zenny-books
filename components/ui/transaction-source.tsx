"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountInfo = {
  institutionName: string | null;
  accountName: string | null;
  accountMask: string | null;
  accountType: string | null;
};

export type TransactionSourceProps = {
  isPlaidImported: boolean;
  // For Plaid transactions
  accountInfo?: AccountInfo | null;
  // For manual transactions
  paymentMethod?: string | null;
  onPaymentMethodChange?: (value: string) => void;
  disabled?: boolean;
};

function formatAccountLabel(accountInfo?: AccountInfo | null): string {
  if (!accountInfo) return "Bank Import";

  const institution = accountInfo.institutionName?.trim();
  const name = accountInfo.accountName?.trim();
  const mask = accountInfo.accountMask?.trim();

  const parts = [institution, name].filter(Boolean) as string[];
  const base = parts.length > 0 ? parts.join(" ") : "Bank Import";
  return mask ? `${base} • ${mask}` : base;
}

export function TransactionSource({
  isPlaidImported,
  accountInfo,
  paymentMethod,
  onPaymentMethodChange,
  disabled = false,
}: TransactionSourceProps) {
  if (isPlaidImported) {
    return (
      <Badge variant="outline" className="max-w-full truncate">
        {formatAccountLabel(accountInfo)}
      </Badge>
    );
  }

  return (
    <Select
      onValueChange={(v) => onPaymentMethodChange?.(v)}
      value={paymentMethod ?? ""}
      disabled={disabled || !onPaymentMethodChange}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select payment method" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="card">Card</SelectItem>
        <SelectItem value="cash">Cash</SelectItem>
        <SelectItem value="check">Check</SelectItem>
        <SelectItem value="other">Other</SelectItem>
      </SelectContent>
    </Select>
  );
}


