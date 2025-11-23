"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { updateBankTransaction } from "@/app/actions/update-bank-transaction";
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

import type { categories } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;

const bankTransactionSchema = z.object({
  id: z.string(),
  merchantName: z.string().optional(),
  categoryId: z.string().optional(),
  paymentMethod: z.enum(["cash", "card", "check", "other"]).optional(),
  notes: z.string().optional(),
});

type BankTransactionFormValues = z.infer<typeof bankTransactionSchema>;

type BankTransaction = {
  id: string;
  merchantName: string | null;
  categoryId: string | null;
  paymentMethod: string | null;
};

type BankTransactionFormProps = {
  transaction: BankTransaction;
  categories: Category[];
  transactionType: "income" | "expense";
  userSettings?: {
    country?: string | null;
    usageType?: string | null;
  } | null;
};

export function BankTransactionForm({
  transaction,
  categories,
  transactionType,
  userSettings,
}: BankTransactionFormProps) {
  const [isPending, startTransition] = useTransition();

  // Filter categories by transaction type
  const availableCategories = categories.filter(
    (cat) =>
      cat.transactionType === transactionType ||
      cat.transactionType === "expense" // Default to expense if not specified
  );

  const form = useForm<BankTransactionFormValues>({
    resolver: zodResolver(bankTransactionSchema),
    defaultValues: {
      id: transaction.id,
      merchantName: transaction.merchantName ?? "",
      categoryId: transaction.categoryId ?? "",
      paymentMethod: (transaction.paymentMethod as "cash" | "card" | "check" | "other") || undefined,
      notes: "",
    },
  });

  const onSubmit = (data: BankTransactionFormValues) => {
    startTransition(async () => {
      try {
        await updateBankTransaction(data);
        toast.success("Transaction updated");
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
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} {cat.type === "user" ? "(Custom)" : ""}
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
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Method</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
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

