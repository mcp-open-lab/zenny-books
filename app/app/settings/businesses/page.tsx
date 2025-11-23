import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserBusinesses } from "@/app/actions/businesses";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/layouts/page-container";
import { BusinessesManager } from "./_components/businesses-manager";

export default async function BusinessesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const businesses = await getUserBusinesses();

  return (
    <PageContainer size="standard">
      <PageHeader title="Businesses & Contracts" backHref="/app/settings" />
      <p className="text-sm text-muted-foreground">
        Manage your businesses and contracts to organize transactions and expenses.
      </p>
      <BusinessesManager businesses={businesses} />
    </PageContainer>
  );
}

