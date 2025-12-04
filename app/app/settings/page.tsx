import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserSettings } from "@/app/actions/user-settings";
import { SettingsFormV2 } from "@/components/settings-form-v2";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/layouts/page-container";
import { LinkedAccounts } from "@/components/settings/linked-accounts";

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
    <PageContainer size="standard">
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <LinkedAccounts />
      <SettingsFormV2 initialSettings={settings} />
      </div>
    </PageContainer>
  );
}
