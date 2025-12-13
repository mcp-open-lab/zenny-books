import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layouts/page-container";
import { hasModuleAccess } from "@/lib/modules/feature-gate";

export default async function ImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const canUseImport = await hasModuleAccess(userId, "ai_import");
  if (!canUseImport) {
    return (
      <PageContainer size="standard">
        <div className="rounded-md border bg-muted/30 p-4">
          <h2 className="text-base font-semibold">Import is a paid module</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade to enable batch imports and AI-powered processing.
          </p>
        </div>
      </PageContainer>
    );
  }

  return children;
}


