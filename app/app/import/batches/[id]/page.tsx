import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { BatchDetailView } from "@/components/import/batch-detail-view";
import {
  getBatchStatusSummary,
  getBatchItemsStatus,
} from "@/lib/import/batch-tracker";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function BatchDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const params = await props.params;
  const batchId = params.id;

  try {
    const [batch, items] = await Promise.all([
      getBatchStatusSummary(batchId, userId),
      getBatchItemsStatus(batchId, userId),
    ]);

    return (
      <div className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/app/import?tab=jobs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader title="Batch Details" />
        </div>

        <BatchDetailView batch={batch} items={items} />
      </div>
    );
  } catch (error) {
    return (
      <div className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/app/import?tab=jobs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader title="Batch Details" />
        </div>
        <div className="p-8 text-center text-muted-foreground border rounded-lg">
          Batch not found or you don't have permission to view it.
        </div>
      </div>
    );
  }
}
