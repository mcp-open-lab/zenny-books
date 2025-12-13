import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  createUserCategory,
  deleteUserCategory,
} from "@/lib/modules/categories/actions";
import type { categories } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;

type UseCategoriesProps = {
  categories: Category[];
};

export function useCategories({ categories }: UseCategoriesProps) {
  const [isPending, startTransition] = useTransition();

  // Category state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryTransactionType, setNewCategoryTransactionType] =
    useState<"income" | "expense">("expense");
  const [newCategoryUsageScope, setNewCategoryUsageScope] = useState<
    "personal" | "business" | "both"
  >("both");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Computed values
  const systemCategories = useMemo(
    () => categories.filter((c) => c.type === "system"),
    [categories]
  );

  const userCategories = useMemo(
    () => categories.filter((c) => c.type === "user"),
    [categories]
  );

  // Category handlers
  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    startTransition(async () => {
      try {
        await createUserCategory({
          name: newCategoryName.trim(),
          transactionType: newCategoryTransactionType,
          usageScope: newCategoryUsageScope,
          description: newCategoryDescription.trim() || undefined,
        });
        toast.success("Category created!");
        setNewCategoryName("");
        setNewCategoryTransactionType("expense");
        setNewCategoryUsageScope("business");
        setNewCategoryDescription("");
        setCategoryDialogOpen(false);
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create category"
        );
      }
    });
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    if (
      !confirm(
        `Delete "${categoryName}"? Any transactions using it will be moved to Review for re-categorization.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        try {
          await deleteUserCategory({ categoryId });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("confirmDetach=true")) {
            const ok = confirm(
              `This category is used by existing transactions. Deleting will move those transactions to Review.\n\nDelete anyway?`
            );
            if (!ok) return;
            await deleteUserCategory({ categoryId, confirmDetach: true });
          } else {
            throw error;
          }
        }
        toast.success("Category deleted");
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete category"
        );
      }
    });
  };

  return {
    // State
    isPending,
    systemCategories,
    userCategories,

    // Category state
    newCategoryName,
    setNewCategoryName,
    newCategoryTransactionType,
    setNewCategoryTransactionType,
    newCategoryUsageScope,
    setNewCategoryUsageScope,
    newCategoryDescription,
    setNewCategoryDescription,
    categoryDialogOpen,
    setCategoryDialogOpen,

    // Handlers
    handleCreateCategory,
    handleDeleteCategory,
  };
}

