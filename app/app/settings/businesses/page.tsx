import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserBusinesses } from "@/app/actions/businesses";
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
      <p className="text-sm text-muted-foreground">
        Manage your businesses and contracts to organize transactions and expenses.
      </p>
      <BusinessesManager businesses={businesses} />
    </PageContainer>
  );
}

