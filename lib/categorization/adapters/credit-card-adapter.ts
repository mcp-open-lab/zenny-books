import type { WorkflowAdapter } from "./base-adapter";
import type { CategorizationInput } from "../strategies/base-strategy";

/**
 * Credit card transaction data structure (subset of fields needed for categorization)
 */
export interface CreditCardTransactionData {
  id?: string;
  merchantName?: string | null;
  description?: string | null;
  amount?: number | string | null;
}

/**
 * Adapter for credit card workflow
 * Converts credit card transaction data to categorization input
 */
export class CreditCardWorkflowAdapter
  implements WorkflowAdapter<CreditCardTransactionData>
{
  readonly entityType: "credit_card" = "credit_card" as const;

  toCategorizationInput(
    transaction: CreditCardTransactionData
  ): CategorizationInput {
    return {
      merchantName: transaction.merchantName ?? null,
      description: transaction.description ?? null,
      amount:
        typeof transaction.amount === "number"
          ? transaction.amount.toString()
          : transaction.amount ?? null,
      entityId: transaction.id,
      entityType: this.entityType,
    };
  }
}

