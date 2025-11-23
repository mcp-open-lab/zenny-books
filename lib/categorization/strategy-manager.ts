import { devLogger } from "@/lib/dev-logger";
import type {
  CategorizationStrategy,
  CategorizationInput,
  CategorizationContext,
} from "./strategies/base-strategy";
import type { CategorizationResult } from "./types";

/**
 * Orchestrates multiple categorization strategies
 * Runs strategies in priority order, stopping on first success
 */
export class CategoryStrategyManager {
  private strategies: CategorizationStrategy[];

  constructor(strategies: CategorizationStrategy[]) {
    // Sort strategies by priority (lower = higher priority)
    this.strategies = [...strategies].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Categorize a transaction using registered strategies
   * Tries each strategy in priority order until one succeeds
   */
  async categorize(
    input: CategorizationInput,
    context: CategorizationContext
  ): Promise<CategorizationResult> {
    const minConfidence = context.minConfidence || 0.7;

    devLogger.debug("CategoryStrategyManager: Starting categorization", {
      strategies: this.strategies.map((s) => s.name),
      merchantName: input.merchantName,
      minConfidence,
    });

    for (const strategy of this.strategies) {
      try {
        const result = await strategy.categorize(input, context);

        if (result.categoryId && result.confidence >= minConfidence) {
          devLogger.info("CategoryStrategyManager: Category found", {
            strategy: strategy.name,
            category: result.categoryName,
            confidence: result.confidence,
            merchantName: input.merchantName,
          });
          return result;
        }

        // Log partial matches for debugging
        if (result.categoryId) {
          devLogger.debug(
            "CategoryStrategyManager: Low confidence match, trying next strategy",
            {
              strategy: strategy.name,
              confidence: result.confidence,
              minConfidence,
            }
          );
        }
      } catch (error) {
        devLogger.error("CategoryStrategyManager: Strategy error", {
          strategy: strategy.name,
          error,
        });
        // Continue to next strategy on error
      }
    }

    devLogger.debug("CategoryStrategyManager: No category found", {
      merchantName: input.merchantName,
    });

    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      method: "none",
    };
  }

  /**
   * Get list of registered strategy names
   */
  getStrategyNames(): string[] {
    return this.strategies.map((s) => s.name);
  }

  /**
   * Add a strategy dynamically
   */
  addStrategy(strategy: CategorizationStrategy): void {
    this.strategies.push(strategy);
    // Re-sort by priority
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a strategy by name
   */
  removeStrategy(name: string): void {
    this.strategies = this.strategies.filter((s) => s.name !== name);
  }
}

