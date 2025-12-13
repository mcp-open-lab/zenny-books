import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layouts/page-container";
import { hasModuleAccess } from "@/lib/modules/feature-gate";

export default async function BudgetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const canUseBudgets = await hasModuleAccess(userId, "budgets");
  if (!canUseBudgets) {
    return (
      <PageContainer size="standard">
        <div className="rounded-md border bg-muted/30 p-4">
          <h2 className="text-base font-semibold">Budgeting is a paid module</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade to enable budgets and spending insights.
          </p>
        </div>
      </PageContainer>
    );
  }

  return children;
}


