"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReceiptImageViewer } from "./receipt-image-viewer";
import { ReceiptForm } from "./receipt-form";
import {
  createEditReceiptSchema,
  type EditReceiptFormValues,
} from "@/lib/schemas";
import { DEFAULT_REQUIRED_FIELDS } from "@/lib/consts";
import type { receipts } from "@/lib/db/schema";

type Receipt = typeof receipts.$inferSelect;

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

type EditReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: Receipt | null;
  userSettings?: UserSettings | null;
};

function getDefaultValues(
  receipt: Receipt | null,
  userDefaults?: UserSettings["defaultValues"]
): EditReceiptFormValues {
  if (!receipt) {
    return {
      id: "",
      merchantName: "",
      date: "",
      totalAmount: "",
      taxAmount: "",
      description: "",
      paymentMethod: userDefaults?.paymentMethod ?? "",
      tipAmount: "",
      discountAmount: "",
      category: "",
      status: "needs_review",
    };
  }

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
    category: receipt.category ?? "",
    status: (receipt.status as "needs_review" | "approved") ?? "needs_review",
  };
}

export function EditReceiptDialog({
  open,
  onOpenChange,
  receipt,
  userSettings,
}: EditReceiptDialogProps) {
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

  const formKey = receipt?.id || "new";
  const visibleFields = userSettings?.visibleFields || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] w-[calc(100vw-2rem)] md:w-full overflow-hidden flex flex-col p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 flex-shrink-0">
          <DialogTitle>
            {(() => {
              if (!receipt) return "Edit Item";
              if (receipt.type === "invoice") {
                return `Edit Invoice (${
                  receipt.direction === "in" ? "Received" : "Sent"
                })`;
              }
              return "Edit Receipt";
            })()}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edit details for the selected financial item.
          </DialogDescription>
        </DialogHeader>
        {receipt && (
          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 md:pb-6">
            <div
              className={`grid ${
                receipt.imageUrl ? "md:grid-cols-2" : "grid-cols-1"
              } gap-4 md:gap-6`}
            >
              {receipt.imageUrl && (
                <ReceiptImageViewer
                  imageUrl={receipt.imageUrl}
                  merchantName={receipt.merchantName}
                  fileName={receipt.fileName}
                />
              )}
              <div className={receipt.imageUrl ? "order-1 md:order-2" : ""}>
                <ReceiptForm
                  key={formKey}
                  defaultValues={defaultValues}
                  schema={schema}
                  requiredFields={requiredFields}
                  visibleFields={visibleFields}
                  onOpenChange={onOpenChange}
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
