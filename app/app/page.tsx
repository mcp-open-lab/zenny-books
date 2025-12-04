import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Timeline } from "@/components/timeline";
import { getUserSettings } from "@/app/actions/user-settings";
import { PageContainer } from "@/components/layouts/page-container";
import { getTimelineItems } from "@/lib/api/timeline";
import { getUserCategories } from "@/app/actions/financial-categories";
import { getTimelineMerchants, getTimelineBusinesses } from "@/app/actions/timeline";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Redirect to onboarding if settings don't exist
  const settings = await getUserSettings();
  if (!settings) {
    redirect("/app/onboarding");
  }

  // Fetch initial timeline items (limit 20)
  const initialItems = await getTimelineItems({
    userId,
    limit: 20,
    offset: 0
  });

  // Fetch filter metadata
  const [categories, merchants, businesses] = await Promise.all([
    getUserCategories(),
    getTimelineMerchants(),
    getTimelineBusinesses(),
  ]);

  return (
    <PageContainer size="standard">
      <Timeline
        initialItems={initialItems}
        userSettings={
          settings
            ? {
                visibleFields: settings.visibleFields || {},
                requiredFields: settings.requiredFields || {},
                country: settings.country || undefined,
                usageType: settings.usageType || undefined,
                defaultValues: settings.defaultValues || null,
              }
            : null
        }
        categories={categories}
        merchants={merchants}
        businesses={businesses}
      />
    </PageContainer>
  );
}
