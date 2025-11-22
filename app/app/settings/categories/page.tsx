import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserCategories, getUserRules } from "@/app/actions/categories";
import { PageHeader } from "@/components/page-header";
import { CategoriesManager } from "@/components/categories-manager";

export default async function CategoriesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const [categories, rules] = await Promise.all([
    getUserCategories(),
    getUserRules(),
  ]);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8">
      <PageHeader title="Categories & Rules" backHref="/app/settings" />
      <CategoriesManager categories={categories} rules={rules} />
    </div>
  );
}

