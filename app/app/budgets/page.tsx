import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";

export default async function BudgetsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-4">
      <PageHeader title="Budgets" />
      <p className="text-muted-foreground">
        Budget planning tools are coming soon.
      </p>
    </div>
  );
}
