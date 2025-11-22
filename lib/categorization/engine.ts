import { db } from "@/lib/db";
import {
  categories,
  categoryRules,
  receipts,
  bankStatementTransactions,
  userSettings,
} from "@/lib/db/schema";
import { eq, and, or, desc, isNotNull } from "drizzle-orm";
import { devLogger } from "@/lib/dev-logger";
import { aiCategorizeTransaction } from "./ai-categorizer";
import type {
  TransactionToCategorize,
  CategorizationResult,
  CategorizationOptions,
} from "./types";

/**
 * Multi-layered categorization engine
 * Layer 1: Explicit Rules (Fast)
 * Layer 2: History Matching (Fast)
 * Layer 3: AI Fallback (Smart) - implemented separately
 */
export class CategoryEngine {
  /**
   * Categorize a single transaction
   */
  static async categorizeTransaction(
    transaction: TransactionToCategorize,
    options: CategorizationOptions
  ): Promise<CategorizationResult> {
    const { userId } = options;

    // Layer 1: Try rule-based matching
    const ruleResult = await this.matchByRules(transaction, userId);
    if (ruleResult.categoryId) {
      devLogger.debug("Categorized by rule", {
        merchantName: transaction.merchantName,
        categoryId: ruleResult.categoryId,
      });
      return ruleResult;
    }

    // Layer 2: Try history matching
    const historyResult = await this.matchByHistory(transaction, userId);
    if (historyResult.categoryId) {
      devLogger.debug("Categorized by history", {
        merchantName: transaction.merchantName,
        categoryId: historyResult.categoryId,
      });
      return historyResult;
    }

    // Layer 3 would be AI, but that's handled by the caller
    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      method: "none",
    };
  }

  /**
   * Layer 1: Match by explicit rules
   */
  private static async matchByRules(
    transaction: TransactionToCategorize,
    userId: string
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
        .where(eq(categoryRules.userId, userId));

      for (const { rule, category } of rules) {
        const fieldValue =
          rule.field === "merchantName"
            ? transaction.merchantName
            : transaction.description;

        if (!fieldValue) continue;

        const matches = this.testPattern(
          fieldValue,
          rule.value,
          rule.matchType
        );

        if (matches) {
          return {
            categoryId: category.id,
            categoryName: category.name,
            confidence: 1.0,
            method: "rule",
          };
        }
      }
    } catch (error) {
      devLogger.error("Error matching by rules", { error });
    }

    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      method: "none",
    };
  }

  /**
   * Layer 2: Match by transaction history
   */
  private static async matchByHistory(
    transaction: TransactionToCategorize,
    userId: string
  ): Promise<CategorizationResult> {
    if (!transaction.merchantName) {
      return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        method: "none",
      };
    }

    try {
      // Check receipts first
      const pastReceipts = await db
        .select({
          categoryId: receipts.categoryId,
          category: receipts.category,
        })
        .from(receipts)
        .where(
          and(
            eq(receipts.userId, userId),
            eq(receipts.merchantName, transaction.merchantName),
            isNotNull(receipts.categoryId)
          )
        )
        .orderBy(desc(receipts.createdAt))
        .limit(1);

      if (pastReceipts.length > 0 && pastReceipts[0].categoryId) {
        // Get the category name
        const categoryData = await db
          .select()
          .from(categories)
          .where(eq(categories.id, pastReceipts[0].categoryId))
          .limit(1);

        if (categoryData.length > 0) {
          return {
            categoryId: pastReceipts[0].categoryId,
            categoryName: categoryData[0].name,
            confidence: 0.85,
            method: "history",
          };
        }
      }

      // Check bank transactions
      const pastTransactions = await db
        .select({
          categoryId: bankStatementTransactions.categoryId,
          category: bankStatementTransactions.category,
        })
        .from(bankStatementTransactions)
        .where(
          and(
            eq(
              bankStatementTransactions.merchantName,
              transaction.merchantName
            ),
            isNotNull(bankStatementTransactions.categoryId)
          )
        )
        .orderBy(desc(bankStatementTransactions.createdAt))
        .limit(1);

      if (pastTransactions.length > 0 && pastTransactions[0].categoryId) {
        // Get the category name
        const categoryData = await db
          .select()
          .from(categories)
          .where(eq(categories.id, pastTransactions[0].categoryId))
          .limit(1);

        if (categoryData.length > 0) {
          return {
            categoryId: pastTransactions[0].categoryId,
            categoryName: categoryData[0].name,
            confidence: 0.85,
            method: "history",
          };
        }
      }
    } catch (error) {
      devLogger.error("Error matching by history", { error });
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
  private static testPattern(
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
          devLogger.warn("Invalid regex pattern", { pattern, error });
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Get all available categories for a user (system + user-defined)
   */
  static async getAvailableCategories(
    userId: string
  ): Promise<{ id: string; name: string; type: string }[]> {
    const userCategories = await db
      .select()
      .from(categories)
      .where(or(eq(categories.type, "system"), eq(categories.userId, userId)));

    return userCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      type: cat.type,
    }));
  }

  /**
   * Categorize with all layers including AI fallback
   */
  static async categorizeWithAI(
    transaction: TransactionToCategorize,
    options: CategorizationOptions
  ): Promise<CategorizationResult> {
    const { userId, includeAI = true, minConfidence = 0.7 } = options;

    // Try layers 1 & 2 first (rules and history)
    const basicResult = await this.categorizeTransaction(transaction, options);

    if (basicResult.categoryId && basicResult.confidence >= minConfidence) {
      return basicResult;
    }

    // Layer 3: AI fallback
    if (!includeAI) {
      return basicResult;
    }

    try {
      const availableCategories = await this.getAvailableCategories(userId);

      // Get user preferences for better AI context
      const userPrefs = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      const userPreferences =
        userPrefs.length > 0
          ? {
              country: userPrefs[0].country,
              usageType: userPrefs[0].usageType,
            }
          : undefined;

      const aiResult = await aiCategorizeTransaction(transaction, {
        availableCategories,
        userPreferences,
      });

      return aiResult;
    } catch (error) {
      devLogger.error("AI categorization layer failed", { error });
      return basicResult; // Fall back to basic result
    }
  }
}
