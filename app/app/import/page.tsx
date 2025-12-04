import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layouts/page-container";
import { ImportTabs } from "@/components/import/import-tabs";
import { listBatches } from "@/lib/import/batch-tracker";
import { getUserSettings } from "@/app/actions/user-settings";

export default async function ImportPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Consume searchParams to ensure dynamic rendering on param change
  const searchParams = await props.searchParams;
  const initialTab = searchParams.tab || "import";

  const initialBatchesResult = await listBatches(userId, { limit: 20 });
  const userSettings = await getUserSettings();
  const defaultCurrency = userSettings?.currency || "USD";

  return (
    <PageContainer size="tight">
      <div className="text-sm text-muted-foreground">
        Upload multiple receipts, bank statements, invoices, or other financial
        documents for batch processing.
      </div>

      <ImportTabs
        initialBatches={initialBatchesResult.batches}
        initialCursor={initialBatchesResult.nextCursor}
        initialHasMore={initialBatchesResult.hasMore}
        initialTab={initialTab}
        defaultCurrency={defaultCurrency}
      />
    </PageContainer>
  );
}
