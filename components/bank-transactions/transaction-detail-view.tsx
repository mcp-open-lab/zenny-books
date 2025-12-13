"use client";

import { Card } from "@/components/ui/card";
import { BankTransactionForm } from "./transaction-form";
import type { bankStatementTransactions, categories, businesses as businessesSchema } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { TransactionFlags } from "@/lib/constants/transaction-flags";
import { TransactionSource } from "@/components/ui/transaction-source";

type Category = typeof categories.$inferSelect;
type Business = typeof businessesSchema.$inferSelect;

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
  businessId: string | null;
  paymentMethod: string | null;
  transactionFlags?: TransactionFlags | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserSettings = {
  country?: string | null;
  usageType?: string | null;
};

type BankTransactionDetailViewProps = {
  transaction: BankTransaction;
  accountInfo?: {
    institutionName: string | null;
    accountName: string | null;
    accountMask: string | null;
    accountType: string | null;
  } | null;
  categories: Category[];
  businesses: Business[];
  userSettings?: UserSettings | null;
};

export function BankTransactionDetailView({
  transaction,
  accountInfo,
  categories,
  businesses,
  userSettings,
}: BankTransactionDetailViewProps) {
  const amount = parseFloat(transaction.amount);
  const isIncome = amount >= 0;
  const transactionType = isIncome ? "income" : "expense";
  const isPlaidImported =
    (transaction.transactionFlags?.isPlaidImported ?? false) === true;

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
              transaction.transactionDate?.getTime() ? <div>
                <p className="text-sm text-muted-foreground">Posted Date</p>
                <p className="text-base font-medium mt-1">
                  {format(new Date(transaction.postedDate), "MMM d, yyyy")}
                </p>
              </div> : null}

          {transaction.referenceNumber ? <div>
              <p className="text-sm text-muted-foreground">Reference Number</p>
              <p className="text-sm font-mono mt-1 break-all">
                {transaction.referenceNumber}
              </p>
            </div> : null}

          {transaction.description ? <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-base mt-1">{transaction.description}</p>
            </div> : null}

          {isPlaidImported ? (
            <div>
              <p className="text-sm text-muted-foreground">Source</p>
              <div className="mt-1">
                <TransactionSource
                  isPlaidImported={true}
                  accountInfo={accountInfo ?? null}
                  disabled={true}
                />
              </div>
            </div>
          ) : transaction.paymentMethod ? (
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <Badge variant="outline" className="mt-1 capitalize">
                {transaction.paymentMethod}
              </Badge>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Edit Form Card */}
      <Card className="p-6 md:col-span-2">
        <h2 className="text-lg font-semibold mb-4">
          Categorization & Details
        </h2>
        <BankTransactionForm
          transaction={transaction}
          isPlaidImported={isPlaidImported}
          accountInfo={accountInfo ?? null}
          categories={categories}
          businesses={businesses}
          currency={transaction.currency || "USD"}
          transactionType={transactionType}
          userSettings={userSettings}
        />
      </Card>
    </div>
  );
}

