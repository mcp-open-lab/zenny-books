import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getMerchantTransactions } from "@/app/actions/financial-categories";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/layouts/page-container";
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
    <PageContainer size="wide">
      <PageHeader
        title={`Merchant: ${decodedMerchantName}`}
        useHistoryBack
      />
      <MerchantDetailView
        merchantName={decodedMerchantName}
        transactions={transactions}
      />
    </PageContainer>
  );
}

