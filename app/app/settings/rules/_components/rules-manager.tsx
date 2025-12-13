"use client";

import type { categories, categoryRules } from "@/lib/db/schema";
import type { MerchantStats } from "@/lib/categorization/repositories/transaction-repository";
import { RulesList } from "@/components/financial-categories/rules-list";
import { RuleTester } from "@/components/financial-categories/rule-tester";

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
  return (
    <div className="space-y-6">
      <RuleTester />
      <RulesList categories={categories} rules={rules} businesses={businesses} />
    </div>
  );
}

