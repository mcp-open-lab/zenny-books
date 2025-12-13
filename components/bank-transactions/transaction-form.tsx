"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { SimilarTransactionsPanel } from "@/components/transactions/similar-transactions-panel";
import { CategoryAssigner } from "@/components/categorization/category-assigner";
import { useCategoryAssignment } from "@/lib/hooks/use-category-assignment";
import { TransactionSource } from "@/components/ui/transaction-source";

import type { categories, businesses as businessesSchema } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

const bankTransactionSchema = z.object({
  id: z.string(),
  merchantName: z.string().optional(),
  categoryId: z.string().optional(),
  businessId: z.string().optional().nullable(),
  paymentMethod: z.enum(["cash", "card", "check", "other"]).optional(),
  notes: z.string().optional(),
});

type BankTransactionFormValues = z.infer<typeof bankTransactionSchema>;

type BankTransaction = {
  id: string;
  merchantName: string | null;
  categoryId: string | null;
  businessId: string | null;
  paymentMethod: string | null;
};

type BankTransactionFormProps = {
  transaction: BankTransaction;
  isPlaidImported: boolean;
  accountInfo?: {
    institutionName: string | null;
    accountName: string | null;
    accountMask: string | null;
    accountType: string | null;
  } | null;
  categories: Category[];
  businesses: Business[];
  currency?: string;
  transactionType: "income" | "expense";
  userSettings?: {
    country?: string | null;
    usageType?: string | null;
  } | null;
};

export function BankTransactionForm({
  transaction,
  isPlaidImported,
  accountInfo,
  categories,
  businesses,
  currency = "USD",
  transactionType,
  userSettings,
}: BankTransactionFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<BankTransactionFormValues>({
    resolver: zodResolver(bankTransactionSchema),
    defaultValues: {
      id: transaction.id,
      merchantName: transaction.merchantName ?? "",
      categoryId: transaction.categoryId ?? "",
      businessId: transaction.businessId ?? null,
      paymentMethod: (transaction.paymentMethod as "cash" | "card" | "check" | "other") || undefined,
      notes: "",
    },
  });

  const categoryAssignment = useCategoryAssignment({
    initialCategoryId: form.getValues("categoryId"),
    initialBusinessId: form.getValues("businessId"),
  });

  const onSubmit = (data: BankTransactionFormValues) => {
    startTransition(async () => {
      try {
        const merchantName = data.merchantName || undefined;
        const result = await categoryAssignment.assignCategory({
          id: transaction.id,
          type: "bank_transaction",
          merchantName,
          categoryId: data.categoryId || "",
          businessId: data.businessId || null,
          applyToFuture: categoryAssignment.applyToFuture,
        });
        if (result.success) {
          toast.success("Transaction updated");
        }
      } catch (error) {
        console.error("Update failed", error);
        toast.error("Failed to update transaction");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="merchantName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Merchant / Payee</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter merchant name"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <CategoryAssigner
                  value={field.value || ""}
                  displayValue={
                    categories.find((c) => c.id === field.value)?.name
                  }
                  onChange={(value) => {
                    field.onChange(value);
                    categoryAssignment.setCategoryId(value);
                  }}
                  categories={categories}
                  transactionType={transactionType}
                  merchantName={form.watch("merchantName")}
                  applyToFuture={categoryAssignment.applyToFuture}
                  onApplyToFutureChange={categoryAssignment.setApplyToFuture}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {businesses.length > 0 && (
          <FormField
            control={form.control}
            name="businessId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business (Optional)</FormLabel>
                <Select
                  onValueChange={(v) =>
                    field.onChange(v === "personal" ? null : v)
                  }
                  value={field.value || "personal"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    {businesses.map((business) => (
                      <SelectItem key={business.id} value={business.id}>
                        {business.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Similar Transactions Panel */}
        <SimilarTransactionsPanel
          merchantName={form.watch("merchantName") || ""}
          transactionId={transaction.id}
          entityType="bank_transaction"
          currency={currency}
          categories={categories}
          transactionType={transactionType}
        />

        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Source</FormLabel>
              <FormControl>
                <TransactionSource
                  isPlaidImported={isPlaidImported}
                  accountInfo={accountInfo ?? null}
                  paymentMethod={field.value ?? null}
                  onPaymentMethodChange={
                    isPlaidImported ? undefined : (v) => field.onChange(v)
                  }
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add any additional notes"
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

