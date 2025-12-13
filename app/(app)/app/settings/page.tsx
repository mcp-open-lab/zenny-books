import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserSettings } from "@/lib/modules/user-settings/actions";
import { SettingsFormV2 } from "@/components/settings-form-v2";
import { PageContainer } from "@/components/layouts/page-container";
import { LinkedAccounts } from "@/components/settings/linked-accounts";
import { hasModuleAccess } from "@/lib/modules/feature-gate";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const settings = await getUserSettings();
  if (!settings) {
    redirect("/app/onboarding");
  }

  const canUsePlaid = await hasModuleAccess(userId, "plaid");

  return (
    <PageContainer size="standard">
      <div className="space-y-6">
        {canUsePlaid ? (
          <LinkedAccounts />
        ) : (
          <div className="rounded-md border bg-muted/30 p-4">
            <h2 className="text-base font-semibold">
              Plaid Connections is a paid module
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upgrade to connect bank accounts and auto-sync transactions.
            </p>
          </div>
        )}
        <SettingsFormV2 initialSettings={settings} />
      </div>
    </PageContainer>
  );
}
