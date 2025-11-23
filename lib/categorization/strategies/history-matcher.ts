import { devLogger } from "@/lib/dev-logger";
import { TransactionRepository } from "../repositories/transaction-repository";
import { CONFIDENCE_DEFAULTS } from "@/lib/ai/constants";
import type {
  CategorizationStrategy,
  CategorizationInput,
  CategorizationContext,
} from "./base-strategy";
import type { CategorizationResult } from "../types";

/**
 * History-based categorization strategy
 * Matches transactions based on past categorization of the same merchant
 * Priority: 2 (high - user's own history is reliable)
 */
export class HistoryMatcher implements CategorizationStrategy {
  readonly name = "history";
  readonly priority = 2;

  constructor(private transactionRepository: TransactionRepository) {}

  async categorize(
    input: CategorizationInput,
    context: CategorizationContext
  ): Promise<CategorizationResult> {
    if (!input.merchantName) {
      return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        method: "none",
      };
    }

    try {
      const history = await this.transactionRepository.findHistoryByMerchant(
        input.merchantName,
        context.userId
      );

      if (history) {
        devLogger.debug("HistoryMatcher: Match found", {
          merchantName: input.merchantName,
          category: history.categoryName,
          entityType: history.entityType,
        });

        return {
          categoryId: history.categoryId,
          categoryName: history.categoryName,
          confidence: CONFIDENCE_DEFAULTS.CATEGORIZATION_RULE,
          method: "history",
        };
      }
    } catch (error) {
      devLogger.error("HistoryMatcher: Error", { error });
    }

    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      method: "none",
    };
  }
}

