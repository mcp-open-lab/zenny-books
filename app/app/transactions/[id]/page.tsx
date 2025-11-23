import { db } from "@/lib/db";
import {
  bankStatementTransactions,
  bankStatements,
  documents,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { BankTransactionDetailView } from "@/components/bank-transactions/transaction-detail-view";
import { getUserSettings } from "@/app/actions/user-settings";
import { getUserCategories } from "@/app/actions/financial-categories";

export default async function BankTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch the bank transaction with user verification
  const transaction = await db
    .select({
      id: bankStatementTransactions.id,
      bankStatementId: bankStatementTransactions.bankStatementId,
      transactionDate: bankStatementTransactions.transactionDate,
      postedDate: bankStatementTransactions.postedDate,
      description: bankStatementTransactions.description,
      merchantName: bankStatementTransactions.merchantName,
      referenceNumber: bankStatementTransactions.referenceNumber,
      amount: bankStatementTransactions.amount,
      currency: bankStatementTransactions.currency,
      category: bankStatementTransactions.category,
      categoryId: bankStatementTransactions.categoryId,
      paymentMethod: bankStatementTransactions.paymentMethod,
      createdAt: bankStatementTransactions.createdAt,
      updatedAt: bankStatementTransactions.updatedAt,
    })
    .from(bankStatementTransactions)
    .innerJoin(
      bankStatements,
      eq(bankStatementTransactions.bankStatementId, bankStatements.id)
    )
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .where(
      and(eq(bankStatementTransactions.id, id), eq(documents.userId, userId))
    )
    .limit(1);

  if (!transaction || transaction.length === 0) {
    notFound();
  }

  const [userSettings, categories] = await Promise.all([
    getUserSettings(),
    getUserCategories(),
  ]);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8">
      <PageHeader title="Transaction Details" backHref="/app" />
      <BankTransactionDetailView
        transaction={transaction[0]}
        categories={categories}
        userSettings={userSettings}
      />
    </div>
  );
}
