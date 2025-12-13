import { db } from "@/lib/db";
import { categories, categoryRules } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { devLogger } from "@/lib/dev-logger";
import type {
  CategorizationStrategy,
  CategorizationInput,
  CategorizationContext,
} from "./base-strategy";
import type { CategorizationResult } from "../types";

/**
 * Rule-based categorization strategy
 * Matches transactions against explicit user-defined rules
 * Priority: 1 (highest - explicit rules should always win)
 */
export class RuleMatcher implements CategorizationStrategy {
  readonly name = "rule";
  readonly priority = 1;

  async categorize(
    input: CategorizationInput,
    context: CategorizationContext
  ): Promise<CategorizationResult> {
    try {
      // Get all rules for this user
      const rules = await db
        .select({
          rule: categoryRules,
          category: categories,
        })
        .from(categoryRules)
        .innerJoin(categories, eq(categoryRules.categoryId, categories.id))
        .where(
          and(eq(categoryRules.userId, context.userId), eq(categoryRules.isEnabled, true))
        );

      for (const { rule, category } of rules) {
        const fieldValue =
          rule.field === "merchantName"
            ? input.merchantName
            : input.description;

        if (!fieldValue) continue;

        const matches = this.testPattern(
          fieldValue,
          rule.value,
          rule.matchType
        );

        if (matches) {
          devLogger.debug("RuleMatcher: Match found", {
            rule: rule.field,
            pattern: rule.value,
            category: category.name,
            businessId: rule.businessId,
          });

          return {
            categoryId: category.id,
            categoryName: category.name,
            businessId: rule.businessId ?? null,
            confidence: 1.0,
            method: "rule",
            matchedRuleId: rule.id,
          };
        }
      }
    } catch (error) {
      devLogger.error("RuleMatcher: Error", { error });
    }

    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      method: "none",
    };
  }

  /**
   * Test a pattern match based on match type
   */
  private testPattern(
    value: string,
    pattern: string,
    matchType: string
  ): boolean {
    const normalizedValue = value.toLowerCase().trim();
    const normalizedPattern = pattern.toLowerCase().trim();

    switch (matchType) {
      case "exact":
        return normalizedValue === normalizedPattern;
      case "contains":
        return normalizedValue.includes(normalizedPattern);
      case "regex":
        try {
          const regex = new RegExp(pattern, "i");
          return regex.test(value);
        } catch (error) {
          devLogger.warn("RuleMatcher: Invalid regex pattern", {
            pattern,
            error,
          });
          return false;
        }
      default:
        return false;
    }
  }
}

