import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getMerchantTransactions } from "@/app/actions/financial-categories";
import { getUserCategories } from "@/app/actions/financial-categories";
import { getUserBusinesses } from "@/app/actions/businesses";
import { PageContainer } from "@/components/layouts/page-container";
import { MerchantDetailView } from "@/components/merchants/merchant-detail-view";

export default async function MerchantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantName: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { merchantName } = await params;
  const { page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const decodedMerchantName = decodeURIComponent(merchantName);
  
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const page = parseInt(pageParam || "1", 10);
  const pageSize = parseInt(pageSizeParam || "25", 10);

  const [result, categories, businesses] = await Promise.all([
    getMerchantTransactions({ merchantName: decodedMerchantName, page, pageSize }),
    getUserCategories(),
    getUserBusinesses(),
  ]);

  if (result.totalCount === 0) {
    notFound();
  }

  return (
    <PageContainer size="wide">
      <MerchantDetailView
        merchantName={decodedMerchantName}
        transactions={result.transactions}
        totalCount={result.totalCount}
        totalPages={result.totalPages}
        currentPage={result.currentPage}
        categories={categories}
        businesses={businesses}
      />
    </PageContainer>
  );
}

