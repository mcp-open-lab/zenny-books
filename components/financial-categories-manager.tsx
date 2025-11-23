"use client";

import { useFinancialCategories } from "@/lib/hooks/use-financial-categories";
import { CategoriesSection } from "@/components/financial-categories/categories-section";
import { RulesSection } from "@/components/financial-categories/rules-section";
import { MerchantHistorySection } from "@/components/financial-categories/merchant-history-section";
import type { categories, categoryRules } from "@/lib/db/schema";
import type { MerchantStats } from "@/lib/categorization/repositories/transaction-repository";

type Category = typeof categories.$inferSelect;
type CategoryRule = typeof categoryRules.$inferSelect;

type CategoriesManagerProps = {
  categories: Category[];
  rules: Array<{ rule: CategoryRule; category: Category }>;
  merchantStats: MerchantStats[];
};

export function FinancialCategoriesManager({
  categories,
  rules,
  merchantStats,
}: CategoriesManagerProps) {
  const hook = useFinancialCategories({ categories, rules, merchantStats });

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

      <MerchantHistorySection
        categories={categories}
        merchantStats={merchantStats}
        isPending={hook.isPending}
        newMerchantName={hook.newMerchantName}
        setNewMerchantName={hook.setNewMerchantName}
        newMerchantCategoryId={hook.newMerchantCategoryId}
        setNewMerchantCategoryId={hook.setNewMerchantCategoryId}
        newMerchantDisplayName={hook.newMerchantDisplayName}
        setNewMerchantDisplayName={hook.setNewMerchantDisplayName}
        merchantDialogOpen={hook.merchantDialogOpen}
        setMerchantDialogOpen={hook.setMerchantDialogOpen}
        handleCreateMerchantRule={hook.handleCreateMerchantRule}
        handleQuickCreateRule={hook.handleQuickCreateRule}
      />
    </div>
  );
}
