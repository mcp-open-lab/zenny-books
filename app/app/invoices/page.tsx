import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layouts/page-container";

export default async function InvoicesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <PageContainer size="standard">
      <p className="text-muted-foreground">
        Invoice management is coming soon.
      </p>
    </PageContainer>
  );
}
