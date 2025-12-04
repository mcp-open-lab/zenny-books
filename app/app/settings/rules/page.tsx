import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getUserCategories,
  getUserRules,
  getMerchantStatistics,
} from "@/app/actions/financial-categories";
import { getUserBusinesses } from "@/app/actions/businesses";
import { PageContainer } from "@/components/layouts/page-container";
import { RulesManager } from "./_components/rules-manager";

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const page = parseInt(pageParam || "1", 10);
  const pageSize = parseInt(pageSizeParam || "25", 10);

  const [categories, rules, merchantStatsResult, businesses] = await Promise.all([
    getUserCategories(),
    getUserRules(),
    getMerchantStatistics({ page, pageSize }),
    getUserBusinesses(),
  ]);

  return (
    <PageContainer size="standard">
      <p className="text-sm text-muted-foreground">
        Create rules to automatically categorize transactions based on merchant
        names or descriptions.
      </p>
      <RulesManager
        categories={categories}
        rules={rules}
        merchantStats={merchantStatsResult.stats}
        merchantStatsTotalCount={merchantStatsResult.totalCount}
        merchantStatsTotalPages={merchantStatsResult.totalPages}
        merchantStatsCurrentPage={merchantStatsResult.currentPage}
        businesses={businesses}
      />
    </PageContainer>
  );
}

