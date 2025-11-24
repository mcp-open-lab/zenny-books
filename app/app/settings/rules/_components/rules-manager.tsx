"use client";

import { useRules } from "@/lib/hooks/use-rules";
import { RulesSection } from "@/components/financial-categories/rules-section";
import { MerchantHistorySection } from "@/components/financial-categories/merchant-history-section";
import type { categories, categoryRules } from "@/lib/db/schema";
import type { MerchantStats } from "@/lib/categorization/repositories/transaction-repository";

type Category = typeof categories.$inferSelect;
type CategoryRule = typeof categoryRules.$inferSelect;

type RulesManagerProps = {
  categories: Category[];
  rules: Array<{ rule: CategoryRule; category: Category }>;
  merchantStats: MerchantStats[];
  merchantStatsTotalCount: number;
  merchantStatsTotalPages: number;
  merchantStatsCurrentPage: number;
  businesses?: { id: string; name: string }[];
};

export function RulesManager({
  categories,
  rules,
  merchantStats,
  merchantStatsTotalCount,
  merchantStatsTotalPages,
  merchantStatsCurrentPage,
  businesses = [],
}: RulesManagerProps) {
  const hook = useRules({ categories, rules, merchantStats });

  return (
    <div className="space-y-6">
      <MerchantHistorySection
        categories={categories}
        merchantStats={merchantStats}
        totalCount={merchantStatsTotalCount}
        totalPages={merchantStatsTotalPages}
        currentPage={merchantStatsCurrentPage}
        businesses={businesses}
        isPending={hook.isPending}
        newMerchantName={hook.newMerchantName}
        setNewMerchantName={hook.setNewMerchantName}
        newMerchantCategoryId={hook.newMerchantCategoryId}
        setNewMerchantCategoryId={hook.setNewMerchantCategoryId}
        newMerchantDisplayName={hook.newMerchantDisplayName}
        setNewMerchantDisplayName={hook.setNewMerchantDisplayName}
        newMerchantBusinessId={hook.newMerchantBusinessId}
        setNewMerchantBusinessId={hook.setNewMerchantBusinessId}
        merchantDialogOpen={hook.merchantDialogOpen}
        setMerchantDialogOpen={hook.setMerchantDialogOpen}
        editMerchantDialogOpen={hook.editMerchantDialogOpen}
        setEditMerchantDialogOpen={hook.setEditMerchantDialogOpen}
        editingMerchant={hook.editingMerchant}
        setEditingMerchant={hook.setEditingMerchant}
        handleCreateMerchantRule={hook.handleCreateMerchantRule}
        handleQuickCreateRule={hook.handleQuickCreateRule}
        handleEditMerchantRule={hook.handleEditMerchantRule}
        handleUpdateMerchantRule={hook.handleUpdateMerchantRule}
        handleDeleteMerchantRule={hook.handleDeleteMerchantRule}
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
        editRuleDialogOpen={hook.editRuleDialogOpen}
        setEditRuleDialogOpen={hook.setEditRuleDialogOpen}
        editingRule={hook.editingRule}
        setEditingRule={hook.setEditingRule}
        handleCreateRule={hook.handleCreateRule}
        handleUpdateRule={hook.handleUpdateRule}
        handleDeleteRule={hook.handleDeleteRule}
        handleEditRule={hook.handleEditRule}
        getRulePlaceholder={hook.getRulePlaceholder}
      />
    </div>
  );
}

