import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getUserCategories,
  getUserRules,
  getMerchantStatistics,
} from "@/app/actions/financial-categories";
import { PageHeader } from "@/components/page-header";
import { FinancialCategoriesManager } from "@/components/financial-categories-manager";

export default async function CategoriesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const [categories, rules, merchantStats] = await Promise.all([
    getUserCategories(),
    getUserRules(),
    getMerchantStatistics(),
  ]);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8">
      <PageHeader title="Financial Categories & Rules" backHref="/app/settings" />
      <FinancialCategoriesManager
        categories={categories}
        rules={rules}
        merchantStats={merchantStats}
      />
    </div>
  );
}

