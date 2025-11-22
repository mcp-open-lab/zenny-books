import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserSettings } from "@/app/actions/user-settings";
import { SettingsFormV2 } from "@/components/settings-form-v2";
import { PageHeader } from "@/components/page-header";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const settings = await getUserSettings();
  if (!settings) {
    redirect("/app/onboarding");
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8">
      <PageHeader title="Settings" />
      <SettingsFormV2 initialSettings={settings} />
    </div>
  );
}
