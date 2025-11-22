"use client";

import { useCategoriesManager } from "@/lib/hooks/use-categories-manager";
import { CategoriesSection } from "@/components/categories/categories-section";
import { RulesSection } from "@/components/categories/rules-section";
import type { categories, categoryRules } from "@/lib/db/schema";

type Category = typeof categories.$inferSelect;
type CategoryRule = typeof categoryRules.$inferSelect;

type CategoriesManagerProps = {
  categories: Category[];
  rules: Array<{ rule: CategoryRule; category: Category }>;
};

export function CategoriesManager({
  categories,
  rules,
}: CategoriesManagerProps) {
  const hook = useCategoriesManager({ categories, rules });

  return (
    <div className="space-y-6">
      <CategoriesSection
        systemCategories={hook.systemCategories}
        userCategories={hook.userCategories}
        isPending={hook.isPending}
        newCategoryName={hook.newCategoryName}
        setNewCategoryName={hook.setNewCategoryName}
        categoryDialogOpen={hook.categoryDialogOpen}
        setCategoryDialogOpen={hook.setCategoryDialogOpen}
        handleCreateCategory={hook.handleCreateCategory}
        handleDeleteCategory={hook.handleDeleteCategory}
      />

      <RulesSection
        categories={categories}
        rules={rules}
        isPending={hook.isPending}
        newRuleCategoryId={hook.newRuleCategoryId}
        setNewRuleCategoryId={hook.setNewRuleCategoryId}
        newRuleField={hook.newRuleField}
        setNewRuleField={hook.setNewRuleField}
        newRuleMatchType={hook.newRuleMatchType}
        setNewRuleMatchType={hook.setNewRuleMatchType}
        newRuleValue={hook.newRuleValue}
        setNewRuleValue={hook.setNewRuleValue}
        ruleDialogOpen={hook.ruleDialogOpen}
        setRuleDialogOpen={hook.setRuleDialogOpen}
        handleCreateRule={hook.handleCreateRule}
        handleDeleteRule={hook.handleDeleteRule}
        getRulePlaceholder={hook.getRulePlaceholder}
      />
    </div>
  );
}
