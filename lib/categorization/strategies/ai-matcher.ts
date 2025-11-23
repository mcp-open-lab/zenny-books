import { devLogger } from "@/lib/dev-logger";
import { aiCategorizeTransaction } from "../ai-categorizer";
import type {
  CategorizationStrategy,
  CategorizationInput,
  CategorizationContext,
} from "./base-strategy";
import type { CategorizationResult } from "../types";

/**
 * AI-based categorization strategy
 * Uses LLM to intelligently categorize transactions
 * Priority: 100 (lowest - expensive fallback when rules/history fail)
 */
export class AiMatcher implements CategorizationStrategy {
  readonly name = "ai";
  readonly priority = 100;

  async categorize(
    input: CategorizationInput,
    context: CategorizationContext
  ): Promise<CategorizationResult> {
    if (!context.availableCategories || context.availableCategories.length === 0) {
      devLogger.warn("AiMatcher: No available categories provided");
      return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        method: "none",
      };
    }

    try {
      const result = await aiCategorizeTransaction(
        {
          merchantName: input.merchantName,
          description: input.description,
          amount: input.amount,
        },
        {
          availableCategories: context.availableCategories,
          userPreferences: context.userPreferences,
          userId: context.userId,
          transactionId: input.entityId,
        }
      );

      if (result.categoryId || result.categoryName) {
        devLogger.debug("AiMatcher: Match found", {
          merchantName: input.merchantName,
          category: result.categoryName,
          confidence: result.confidence,
        });
      }

      return result;
    } catch (error) {
      devLogger.error("AiMatcher: Error", { error });
      return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        method: "none",
      };
    }
  }
}

