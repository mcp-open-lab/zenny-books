import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/layouts/page-container";

export default async function BudgetsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <PageContainer size="standard">
      <PageHeader title="Budgets" />
      <p className="text-muted-foreground">
        Budget planning tools are coming soon.
      </p>
    </PageContainer>
  );
}
