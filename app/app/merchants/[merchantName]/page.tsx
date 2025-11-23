import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getMerchantTransactions } from "@/app/actions/financial-categories";
import { PageHeader } from "@/components/page-header";
import { MerchantDetailView } from "@/components/merchants/merchant-detail-view";

export default async function MerchantDetailPage({
  params,
}: {
  params: Promise<{ merchantName: string }>;
}) {
  const { merchantName } = await params;
  const decodedMerchantName = decodeURIComponent(merchantName);
  
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const transactions = await getMerchantTransactions(decodedMerchantName);

  if (transactions.length === 0) {
    notFound();
  }

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8">
      <PageHeader
        title={`Merchant: ${decodedMerchantName}`}
        backHref="/app/settings/financial-categories"
      />
      <MerchantDetailView
        merchantName={decodedMerchantName}
        transactions={transactions}
      />
    </div>
  );
}

