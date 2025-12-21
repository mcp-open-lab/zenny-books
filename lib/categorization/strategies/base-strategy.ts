import type { CategorizationResult, TransactionToCategorize } from "../types";

/**
 * Context passed to strategies for categorization
 */
export interface CategorizationContext {
  userId: string;
  minConfidence?: number;
  availableCategories?: Array<{ id: string; name: string }>;
  userPreferences?: {
    country?: string | null;
    usageType?: string | null;
  };
  userBusinesses?: Array<{ id: string; name: string }>; // User's businesses for context
  transactionType?: "income" | "expense"; // Transaction type for filtering/context
}

/**
 * Input for categorization (normalized from different workflows)
 */
export interface CategorizationInput extends TransactionToCategorize {
  entityId?: string; // For logging and history
  entityType?: "receipt" | "bank_transaction" | "credit_card";
}

/**
 * Base interface for all categorization strategies
 * Each strategy implements a different approach to categorization
 */
export interface CategorizationStrategy {
  /**
   * Name of the strategy (for logging/debugging)
   */
  readonly name: string;

  /**
   * Priority of the strategy (lower = runs first)
   * 1 = Highest priority (e.g., explicit rules)
   * 100 = Lowest priority (e.g., AI fallback)
   */
  readonly priority: number;

  /**
   * Attempt to categorize a transaction
   * Returns result with categoryId if successful, null if no match
   */
  categorize(
    input: CategorizationInput,
    context: CategorizationContext
  ): Promise<CategorizationResult>;
}
