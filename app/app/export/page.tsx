import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layouts/page-container";

export default async function ExportPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <PageContainer size="standard">
      <p className="text-muted-foreground">
        Export functionality coming soon...
      </p>
    </PageContainer>
  );
}
