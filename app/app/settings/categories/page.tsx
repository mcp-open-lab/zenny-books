import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserCategories } from "@/app/actions/financial-categories";
import { PageContainer } from "@/components/layouts/page-container";
import { CategoriesManager } from "./_components/categories-manager";

export default async function CategoriesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const categories = await getUserCategories();

  return (
    <PageContainer size="standard">
      <p className="text-sm text-muted-foreground">
        Manage your income and expense categories for transaction classification.
      </p>
      <CategoriesManager categories={categories} />
    </PageContainer>
  );
}

