"use client";

import { Card } from "@/components/ui/card";
import { BankTransactionForm } from "./transaction-form";
import type { bankStatementTransactions, categories } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";

type Category = typeof categories.$inferSelect;

type BankTransaction = {
  id: string;
  bankStatementId: string;
  transactionDate: Date | null;
  postedDate: Date | null;
  description: string | null;
  merchantName: string | null;
  referenceNumber: string | null;
  amount: string;
  currency: string | null;
  category: string | null;
  categoryId: string | null;
  paymentMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserSettings = {
  country?: string | null;
  usageType?: string | null;
};

type BankTransactionDetailViewProps = {
  transaction: BankTransaction;
  categories: Category[];
  userSettings?: UserSettings | null;
};

export function BankTransactionDetailView({
  transaction,
  categories,
  userSettings,
}: BankTransactionDetailViewProps) {
  const amount = parseFloat(transaction.amount);
  const isIncome = amount >= 0;
  const transactionType = isIncome ? "income" : "expense";

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Transaction Summary Card */}
      <Card className="p-6 md:col-span-1">
        <h2 className="text-lg font-semibold mb-4">Transaction Summary</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Amount</p>
            <div className="flex items-center gap-2 mt-1">
              {isIncome ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              <p className={`text-2xl font-bold ${isIncome ? "text-green-600" : "text-red-600"}`}>
                {transaction.currency || "USD"} {Math.abs(amount).toFixed(2)}
              </p>
            </div>
            <Badge variant={isIncome ? "default" : "secondary"} className="mt-2">
              {isIncome ? "Income" : "Expense"}
            </Badge>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Transaction Date</p>
            <p className="text-base font-medium mt-1">
              {transaction.transactionDate
                ? format(new Date(transaction.transactionDate), "MMM d, yyyy")
                : "N/A"}
            </p>
          </div>

          {transaction.postedDate &&
            transaction.postedDate.getTime() !==
              transaction.transactionDate?.getTime() && (
              <div>
                <p className="text-sm text-muted-foreground">Posted Date</p>
                <p className="text-base font-medium mt-1">
                  {format(new Date(transaction.postedDate), "MMM d, yyyy")}
                </p>
              </div>
            )}

          {transaction.referenceNumber && (
            <div>
              <p className="text-sm text-muted-foreground">Reference Number</p>
              <p className="text-base font-medium mt-1">
                {transaction.referenceNumber}
              </p>
            </div>
          )}

          {transaction.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-base mt-1">{transaction.description}</p>
            </div>
          )}

          {transaction.paymentMethod && (
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <Badge variant="outline" className="mt-1 capitalize">
                {transaction.paymentMethod}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Edit Form Card */}
      <Card className="p-6 md:col-span-2">
        <h2 className="text-lg font-semibold mb-4">
          Categorization & Details
        </h2>
        <BankTransactionForm
          transaction={transaction}
          categories={categories}
          transactionType={transactionType}
          userSettings={userSettings}
        />
      </Card>
    </div>
  );
}

