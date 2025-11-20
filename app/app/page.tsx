import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Timeline } from "@/components/timeline";
import { AddToHomeScreenButton } from "@/components/add-to-home";
import { QuickActions } from "@/components/quick-actions";
import { getUserSettings } from "@/app/actions/user-settings";
import { groupItemsByMonth } from "@/lib/utils/timeline";

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

  const data = await db
    .select()
    .from(receipts)
    .where(eq(receipts.userId, userId))
    .orderBy(desc(receipts.createdAt));

  const timelineGroups = groupItemsByMonth(data);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Timeline</h1>
        <UserButton />
      </div>

      <div className="flex mb-4">
        <AddToHomeScreenButton />
      </div>

      <Timeline
        receipts={data}
        timelineGroups={timelineGroups}
        userSettings={
          settings
            ? {
                visibleFields: settings.visibleFields || {},
                requiredFields: settings.requiredFields || {},
                country: settings.country || undefined,
                usageType: settings.usageType || undefined,
              }
            : null
        }
      />
      <QuickActions />
    </div>
  );
}
