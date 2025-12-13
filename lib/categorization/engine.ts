import { db } from "@/lib/db";
import { userSettings, businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CategoryStrategyManager } from "./strategy-manager";
import { RuleMatcher, HistoryMatcher, AiMatcher } from "./strategies";
import { TransactionRepository, CategoryRepository } from "./repositories";
import type {
  TransactionToCategorize,
  CategorizationResult,
  CategorizationOptions,
} from "./types";

/**
 * Multi-layered categorization engine (Refactored)
 * Uses strategy pattern for extensibility and testability
 * 
 * Strategies (in priority order):
 * 1. RuleMatcher - Explicit user-defined rules (Priority: 1)
 * 2. HistoryMatcher - Past categorization history (Priority: 2)
 * 3. AiMatcher - AI-powered categorization (Priority: 100)
 */
export class CategoryEngine {
  // Shared repository instances for performance
  private static transactionRepository = new TransactionRepository();
  private static categoryRepository = new CategoryRepository();
  /**
   * Categorize a single transaction (without AI)
   * Uses rule-based and history-based strategies only
   */
  static async categorizeTransaction(
    transaction: TransactionToCategorize,
    options: CategorizationOptions
  ): Promise<CategorizationResult> {
    const { userId, minConfidence = 0.7 } = options;

    // Create strategies (without AI)
    const strategies = [
      new RuleMatcher(),
      new HistoryMatcher(this.transactionRepository),
    ];

    const manager = new CategoryStrategyManager(strategies);

    const result = await manager.categorize(
      {
        merchantName: transaction.merchantName ?? null,
        description: transaction.description ?? null,
        amount: transaction.amount ?? null,
      },
      {
        userId,
        minConfidence,
      }
    );

    return result;
  }


  /**
   * Get all available categories for a user (respects user preferences: personal/business/both)
   * @deprecated Use CategoryRepository.getAvailableCategories() or CategoryFilterService for more control
   */
  static async getAvailableCategories(
    userId: string
  ): Promise<{ id: string; name: string; type: string }[]> {
    const availableCategories = await this.categoryRepository.getAvailableCategories(userId);

    return availableCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      type: cat.type,
    }));
  }

  /**
   * Categorize with all layers including AI fallback
   * Uses the new strategy-based architecture
   */
  static async categorizeWithAI(
    transaction: TransactionToCategorize,
    options: CategorizationOptions
  ): Promise<CategorizationResult> {
    const { userId, includeAI = true, minConfidence = 0.7 } = options;

    // Create strategies based on options
    const strategies: Array<RuleMatcher | HistoryMatcher | AiMatcher> = [
      new RuleMatcher(),
      new HistoryMatcher(this.transactionRepository),
    ];

    // Add AI strategy if enabled
    if (includeAI) {
      strategies.push(new AiMatcher());
    }

    const manager = new CategoryStrategyManager(strategies);

    // Get available categories and user preferences for AI context
    const availableCategories = await this.categoryRepository.getCategoriesForAI(userId);

    const [userPrefs, userBusinessesData] = await Promise.all([
      db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1),
      db
        .select({ id: businesses.id, name: businesses.name })
        .from(businesses)
        .where(eq(businesses.userId, userId)),
    ]);

    const userPreferences =
      userPrefs.length > 0
        ? {
            country: userPrefs[0].country,
            usageType: userPrefs[0].usageType,
          }
        : undefined;

    const userBusinesses = userBusinessesData.length > 0
      ? userBusinessesData.map((b) => ({ id: b.id, name: b.name }))
      : undefined;

    const result = await manager.categorize(
      {
        merchantName: transaction.merchantName ?? null,
        description: transaction.description ?? null,
        amount: transaction.amount ?? null,
        statementType: transaction.statementType ?? null,
      },
      {
        userId,
        minConfidence,
        availableCategories,
        userPreferences,
        userBusinesses,
      }
    );

    return result;
  }
}
