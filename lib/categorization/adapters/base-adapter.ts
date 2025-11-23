import type { CategorizationInput } from "../strategies/base-strategy";
import type { EntityType } from "../repositories/transaction-repository";

/**
 * Base interface for workflow adapters
 * Each adapter converts workflow-specific data into CategorizationInput
 */
export interface WorkflowAdapter<TSource = any> {
  /**
   * Entity type this adapter handles
   */
  readonly entityType: EntityType;

  /**
   * Convert workflow-specific data to categorization input
   */
  toCategorizationInput(source: TSource): CategorizationInput;
}

