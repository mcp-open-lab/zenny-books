"use client";

import { useState, useTransition, useMemo } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateReceipt } from "@/app/actions/update-receipt";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEditReceiptSchema,
  type EditReceiptFormValues,
} from "@/lib/schemas";
import {
  DEFAULT_REQUIRED_FIELDS,
  RECEIPT_CATEGORIES,
  RECEIPT_STATUSES,
} from "@/lib/consts";
import type { receipts } from "@/lib/db/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const categories = RECEIPT_CATEGORIES;
const statuses = RECEIPT_STATUSES;

// Helper to get default values from receipt, using user defaults when fields are empty
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

  // Use receipt value if present, otherwise fall back to user default
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

// Form component - extracted to allow key-based remounting (eliminates useEffect)
type ReceiptFormProps = {
  receipt: Receipt;
  defaultValues: EditReceiptFormValues;
  schema: ReturnType<typeof createEditReceiptSchema>;
  requiredFields: Record<string, boolean>;
  visibleFields: Record<string, boolean>;
  onOpenChange: (open: boolean) => void;
};

function ReceiptForm({
  receipt,
  defaultValues,
  schema,
  requiredFields,
  visibleFields,
  onOpenChange,
}: ReceiptFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditReceiptFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = (data: EditReceiptFormValues) => {
    startTransition(async () => {
      try {
        await updateReceipt(data);
        toast.success("Item updated");
        onOpenChange(false);
      } catch (error) {
        console.error("Update failed", error);
        toast.error("Failed to update item");
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3 md:space-y-4"
      >
        <FormField
          control={form.control}
          name="merchantName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Merchant
                {requiredFields.merchantName && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Date
                {requiredFields.date && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Total Amount
                {requiredFields.totalAmount && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="taxAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Tax Amount
                {requiredFields.taxAmount && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {visibleFields.description !== false && (
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Description
                  {requiredFields.description && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Optional"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {visibleFields.paymentMethod !== false && (
          <FormField
            control={form.control}
            name="paymentMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Payment Method
                  {requiredFields.paymentMethod && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {visibleFields.tipAmount !== false && (
          <FormField
            control={form.control}
            name="tipAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Tip Amount
                  {requiredFields.tipAmount && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Optional"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {visibleFields.discountAmount !== false && (
          <FormField
            control={form.control}
            name="discountAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Discount Amount
                  {requiredFields.discountAmount && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Optional"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Category
                {requiredFields.category && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function EditReceiptDialog({
  open,
  onOpenChange,
  receipt,
  userSettings,
}: EditReceiptDialogProps) {
  const [imageExpanded, setImageExpanded] = useState(false);

  const requiredFields =
    userSettings?.requiredFields || DEFAULT_REQUIRED_FIELDS;

  // Recreate schema when requiredFields change
  const schema = useMemo(
    () => createEditReceiptSchema(requiredFields),
    [requiredFields]
  );

  // Memoize default values to avoid recreating on every render
  const defaultValues = useMemo(
    () => getDefaultValues(receipt, userSettings?.defaultValues),
    [receipt, userSettings?.defaultValues]
  );

  // Key to force form remount when receipt changes - eliminates useEffect
  const formKey = receipt?.id || "new";

  const visibleFields = userSettings?.visibleFields || {};

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          onOpenChange(value);
          if (!value) setImageExpanded(false);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] w-[calc(100vw-2rem)] md:w-full overflow-hidden flex flex-col p-0">
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
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                {/* Image Section */}
                <div className="order-2 md:order-1">
                  <div
                    className="relative w-full h-48 md:h-80 rounded-lg overflow-hidden border bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setImageExpanded(true)}
                  >
                    <Image
                      src={receipt.imageUrl}
                      alt={receipt.merchantName ?? "Receipt image"}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain"
                      priority
                      unoptimized={receipt.imageUrl.includes(".ufs.sh")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 break-all">
                    {receipt.fileName || "Uploaded image"}
                  </p>
                </div>

                {/* Form Section */}
                <div className="order-1 md:order-2">
                  {receipt && (
                    <ReceiptForm
                      key={formKey}
                      receipt={receipt}
                      defaultValues={defaultValues}
                      schema={schema}
                      requiredFields={requiredFields}
                      visibleFields={visibleFields}
                      onOpenChange={onOpenChange}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expanded Image Overlay */}
      {imageExpanded && receipt && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImageExpanded(false);
          }}
        >
          <div
            className="relative w-full h-full max-w-7xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={receipt.imageUrl}
              alt={receipt.merchantName ?? "Receipt image"}
              fill
              sizes="100vw"
              className="object-contain"
              priority
              unoptimized={receipt.imageUrl.includes(".ufs.sh")}
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setImageExpanded(false);
            }}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2"
            aria-label="Close expanded image"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
}
