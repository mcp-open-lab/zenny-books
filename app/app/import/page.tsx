import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ImportTabs } from "@/components/import/import-tabs";
import { listBatches } from "@/lib/import/batch-tracker";

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

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-6">
      <PageHeader title="Import Documents" />
      <div className="text-sm text-muted-foreground">
        Upload multiple receipts, bank statements, invoices, or other financial
        documents for batch processing.
      </div>

      <ImportTabs
        initialBatches={initialBatchesResult.batches}
        initialCursor={initialBatchesResult.nextCursor}
        initialHasMore={initialBatchesResult.hasMore}
        initialTab={initialTab}
      />
    </div>
  );
}
