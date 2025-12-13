import { PageContainer } from "@/components/layouts/page-container";
import {
  getBudgetOverview,
  getLatestTransactionMonth,
} from "@/lib/modules/budgets/actions";
import { getUserSettings } from "@/lib/modules/user-settings/actions";
import { getUserCategories } from "@/lib/modules/categories/actions";
import { getUserBusinesses } from "@/lib/modules/businesses/actions";
import { BudgetPageClient } from "@/components/budgets/budget-page-client";

interface BudgetsPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function BudgetsPage({ searchParams }: BudgetsPageProps) {
  const params = await searchParams;

  // Default to latest month with transactions, or current month if none
  let month = params.month;
  if (!month) {
    const latestMonth = await getLatestTransactionMonth();
    month = latestMonth || new Date().toISOString().slice(0, 7);
  }

  const [budgetResult, settings, categoriesResult, businessesResult] =
    await Promise.all([
      getBudgetOverview(month),
      getUserSettings(),
      getUserCategories(),
      getUserBusinesses(),
    ]);

  if (!budgetResult.success || !budgetResult.data) {
    return (
      <PageContainer size="standard">
        <p className="text-destructive">
          Failed to load budget data: {budgetResult.error}
        </p>
      </PageContainer>
    );
  }

  const currency = settings?.currency || "USD";
  const categories = categoriesResult ?? [];
  const businesses = businessesResult ?? [];

  return (
    <PageContainer size="standard">
      <BudgetPageClient
        initialData={budgetResult.data}
        currency={currency}
        categories={categories}
        businesses={businesses}
      />
    </PageContainer>
  );
}
