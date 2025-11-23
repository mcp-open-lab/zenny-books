import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ReceiptDetailView } from "@/components/receipts/receipt-detail-view";
import { getUserSettings } from "@/app/actions/user-settings";
import { getUserCategories } from "@/app/actions/financial-categories";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch the receipt
  const receipt = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.userId, userId)))
    .limit(1);

  if (!receipt || receipt.length === 0) {
    notFound();
  }

  const [userSettings, categories] = await Promise.all([
    getUserSettings(),
    getUserCategories(),
  ]);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8">
      <PageHeader title="Receipt Details" backHref="/app" />
      <ReceiptDetailView
        receipt={receipt[0]}
        categories={categories}
        userSettings={userSettings}
      />
    </div>
  );
}
