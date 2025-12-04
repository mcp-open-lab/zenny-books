import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layouts/page-container";
import { ReviewQueueList } from "@/components/review-queue/review-queue-list";
import { getReviewQueueItems } from "@/app/actions/review-queue";
import { getUserCategories } from "@/app/actions/financial-categories";
import { getUserBusinesses } from "@/app/actions/businesses";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const [{ items, totalCount }, categories, businesses] = await Promise.all([
    getReviewQueueItems(),
    getUserCategories(),
    getUserBusinesses(),
  ]);

  return (
    <PageContainer size="tight">
      <div className="mb-4 text-sm text-muted-foreground">
        Quickly categorize and organize transactions that need your attention
      </div>
      
      <ReviewQueueList
        initialItems={items}
        categories={categories}
        businesses={businesses}
      />
    </PageContainer>
  );
}

