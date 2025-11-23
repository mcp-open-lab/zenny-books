import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { QuickActions } from "@/components/quick-actions";
import { DesktopNav } from "@/components/desktop-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background">
      <DesktopNav />
      <div className="lg:pt-16">
        {children}
      </div>
      <QuickActions />
    </div>
  );
}
