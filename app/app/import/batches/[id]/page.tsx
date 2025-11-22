import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BatchDetailContainer } from "@/components/import/batch-detail-container";
import {
  getBatchStatusSummary,
  getBatchItemsStatus,
} from "@/lib/import/batch-tracker";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

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
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/app/import?tab=jobs">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Batch Details</h1>
          </div>
          <UserButton />
        </div>

        <BatchDetailContainer initialBatch={batch} initialItems={items} />
      </div>
    );
  } catch (error) {
    return (
      <div className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/app/import?tab=jobs">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Batch Details</h1>
          </div>
          <UserButton />
        </div>
        <div className="p-8 text-center text-muted-foreground border rounded-lg">
          Batch not found or you don't have permission to view it.
        </div>
      </div>
    );
  }
}
