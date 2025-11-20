import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <div className="flex-1 max-w-4xl mx-auto w-full p-6">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <p className="text-muted-foreground">
          Settings functionality coming soon...
        </p>
      </div>
    </div>
  );
}
