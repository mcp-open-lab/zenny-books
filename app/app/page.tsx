import { db } from "@/lib/db";
import { receipts, bankStatementTransactions, bankStatements, documents } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Timeline } from "@/components/timeline";
import { AddToHomeScreenButton } from "@/components/add-to-home";
import { QuickActions } from "@/components/quick-actions";
import { getUserSettings } from "@/app/actions/user-settings";
import { groupItemsByMonth } from "@/lib/utils/timeline";
import { PageHeader } from "@/components/page-header";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Redirect to onboarding if settings don't exist
  const settings = await getUserSettings();
  if (!settings) {
    redirect("/app/onboarding");
  }

  // Fetch receipts
  const receiptData = await db
    .select()
    .from(receipts)
    .where(eq(receipts.userId, userId))
    .orderBy(desc(receipts.createdAt));

  // Fetch bank statement transactions
  const bankTransactionData = await db
    .select({
      id: bankStatementTransactions.id,
      transactionDate: bankStatementTransactions.transactionDate,
      description: bankStatementTransactions.description,
      amount: bankStatementTransactions.amount,
      merchantName: bankStatementTransactions.merchantName,
      category: bankStatementTransactions.category,
      currency: bankStatementTransactions.currency,
      createdAt: bankStatementTransactions.createdAt,
      bankStatementId: bankStatementTransactions.bankStatementId,
    })
    .from(bankStatementTransactions)
    .innerJoin(bankStatements, eq(bankStatementTransactions.bankStatementId, bankStatements.id))
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .where(eq(documents.userId, userId))
    .orderBy(desc(bankStatementTransactions.transactionDate));

  // Transform bank transactions to match receipt format for timeline
  const formattedBankTransactions = bankTransactionData.map((tx) => ({
    id: tx.id,
    userId,
    documentId: tx.bankStatementId, // Use bankStatementId as documentId
    imageUrl: "", // Bank transactions don't have images
    fileName: null,
    merchantName: tx.merchantName,
    merchantAddress: null,
    receiptNumber: null,
    taxId: null,
    subtotal: null,
    totalAmount: tx.amount,
    gstAmount: null,
    hstAmount: null,
    pstAmount: null,
    salesTaxAmount: null,
    taxAmount: null,
    tipAmount: null,
    discountAmount: null,
    country: null,
    province: null,
    currency: tx.currency,
    date: tx.transactionDate,
    category: tx.category,
    description: tx.description,
    businessPurpose: null,
    isBusinessExpense: "true",
    paymentMethod: null,
    status: "completed",
    type: "transaction" as const, // Mark as bank transaction
    direction: "out",
    createdAt: tx.createdAt,
    updatedAt: tx.createdAt,
  }));

  // Combine and sort all documents by date
  const allDocuments = [
    ...receiptData.map(r => ({ ...r, type: "receipt" as const })),
    ...formattedBankTransactions,
  ].sort((a, b) => {
    const dateA = a.date || a.createdAt;
    const dateB = b.date || b.createdAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const timelineGroups = groupItemsByMonth(allDocuments);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8">
      <PageHeader title="Timeline" />

      <div className="flex mb-4">
        <AddToHomeScreenButton />
      </div>

      <Timeline
        receipts={allDocuments}
        timelineGroups={timelineGroups}
        userSettings={
          settings
            ? {
                visibleFields: settings.visibleFields || {},
                requiredFields: settings.requiredFields || {},
                country: settings.country || undefined,
                usageType: settings.usageType || undefined,
                defaultValues: settings.defaultValues || null,
              }
            : null
        }
      />
    </div>
  );
}
