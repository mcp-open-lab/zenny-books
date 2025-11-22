import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  createUserCategory,
  deleteUserCategory,
  createCategoryRule,
  deleteCategoryRule,
} from "@/app/actions/categories";
import type { categories, categoryRules } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;
type CategoryRule = typeof categoryRules.$inferSelect;

type UseCategoriesManagerProps = {
  categories: Category[];
  rules: Array<{ rule: CategoryRule; category: Category }>;
};

export function useCategoriesManager({
  categories,
  rules,
}: UseCategoriesManagerProps) {
  const [isPending, startTransition] = useTransition();

  // Category state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Rule state
  const [newRuleCategoryId, setNewRuleCategoryId] = useState("");
  const [newRuleField, setNewRuleField] = useState<
    "merchantName" | "description"
  >("merchantName");
  const [newRuleMatchType, setNewRuleMatchType] = useState<
    "exact" | "contains" | "regex"
  >("contains");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);

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
        await createUserCategory({ name: newCategoryName.trim() });
        toast.success("Category created!");
        setNewCategoryName("");
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
    if (!confirm(`Delete "${categoryName}"? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteUserCategory({ categoryId });
        toast.success("Category deleted");
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete category"
        );
      }
    });
  };

  // Rule handlers
  const handleCreateRule = () => {
    if (!newRuleCategoryId || !newRuleValue.trim()) {
      toast.error("Please fill all fields");
      return;
    }

    startTransition(async () => {
      try {
        await createCategoryRule({
          categoryId: newRuleCategoryId,
          matchType: newRuleMatchType,
          field: newRuleField,
          value: newRuleValue.trim(),
        });
        toast.success("Rule created!");
        setNewRuleValue("");
        setRuleDialogOpen(false);
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create rule"
        );
      }
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!confirm("Delete this rule? This cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteCategoryRule({ ruleId });
        toast.success("Rule deleted");
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete rule"
        );
      }
    });
  };

  // Helper for rule placeholder text
  const getRulePlaceholder = () => {
    switch (newRuleMatchType) {
      case "contains":
        return "e.g., Starbucks";
      case "exact":
        return "e.g., STARBUCKS COFFEE";
      case "regex":
        return "e.g., ^STARBUCKS.*";
      default:
        return "";
    }
  };

  return {
    // State
    isPending,
    systemCategories,
    userCategories,
    rules,
    categories,

    // Category state
    newCategoryName,
    setNewCategoryName,
    categoryDialogOpen,
    setCategoryDialogOpen,

    // Rule state
    newRuleCategoryId,
    setNewRuleCategoryId,
    newRuleField,
    setNewRuleField,
    newRuleMatchType,
    setNewRuleMatchType,
    newRuleValue,
    setNewRuleValue,
    ruleDialogOpen,
    setRuleDialogOpen,

    // Handlers
    handleCreateCategory,
    handleDeleteCategory,
    handleCreateRule,
    handleDeleteRule,

    // Helpers
    getRulePlaceholder,
  };
}

