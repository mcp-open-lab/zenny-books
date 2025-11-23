"use client";

import { Card } from "@/components/ui/card";
import { ReceiptImageViewer } from "./receipt-image-viewer";
import { ReceiptForm } from "./receipt-form";
import { createEditReceiptSchema, type EditReceiptFormValues } from "@/lib/schemas";
import { DEFAULT_REQUIRED_FIELDS } from "@/lib/consts";
import { useMemo } from "react";
import type { receipts, categories } from "@/lib/db/schema";

type Receipt = typeof receipts.$inferSelect;
type Category = typeof categories.$inferSelect;

type UserSettings = {
  visibleFields?: Record<string, boolean> | null;
  requiredFields?: Record<string, boolean> | null;
  country?: string | null;
  usageType?: string | null;
  defaultValues?: {
    isBusinessExpense?: boolean | null;
    businessPurpose?: string | null;
    paymentMethod?: "cash" | "card" | "check" | "other" | null;
  } | null;
};

type ReceiptDetailViewProps = {
  receipt: Receipt;
  categories: Category[];
  userSettings?: UserSettings | null;
};

function getDefaultValues(
  receipt: Receipt,
  userDefaults?: UserSettings["defaultValues"]
): EditReceiptFormValues {
  const paymentMethod =
    receipt.paymentMethod || userDefaults?.paymentMethod || "";

  return {
    id: receipt.id,
    merchantName: receipt.merchantName ?? "",
    date: receipt.date
      ? new Date(receipt.date).toISOString().split("T")[0]
      : "",
    totalAmount: receipt.totalAmount ?? "",
    taxAmount: receipt.taxAmount ?? "",
    description: receipt.description ?? "",
    paymentMethod,
    tipAmount: receipt.tipAmount ?? "",
    discountAmount: receipt.discountAmount ?? "",
    categoryId: receipt.categoryId ?? "",
    status: (receipt.status as "needs_review" | "approved") ?? "needs_review",
  };
}

export function ReceiptDetailView({
  receipt,
  categories,
  userSettings,
}: ReceiptDetailViewProps) {
  const requiredFields =
    userSettings?.requiredFields || DEFAULT_REQUIRED_FIELDS;

  const schema = useMemo(
    () => createEditReceiptSchema(requiredFields),
    [requiredFields]
  );

  const defaultValues = useMemo(
    () => getDefaultValues(receipt, userSettings?.defaultValues),
    [receipt, userSettings?.defaultValues]
  );

  const visibleFields = userSettings?.visibleFields || {};

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {receipt.imageUrl && (
        <Card className="p-6">
          <ReceiptImageViewer
            imageUrl={receipt.imageUrl}
            merchantName={receipt.merchantName}
            fileName={receipt.fileName}
          />
        </Card>
      )}
      <Card className={`p-6 ${!receipt.imageUrl ? "md:col-span-2 max-w-2xl mx-auto w-full" : ""}`}>
        <h2 className="text-lg font-semibold mb-4">Receipt Information</h2>
        <ReceiptForm
          key={receipt.id}
          defaultValues={defaultValues}
          schema={schema}
          requiredFields={requiredFields}
          visibleFields={visibleFields}
          categories={categories}
          isPage={true}
        />
      </Card>
    </div>
  );
}

