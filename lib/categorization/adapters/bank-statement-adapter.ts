import type { WorkflowAdapter } from "./base-adapter";
import type { CategorizationInput } from "../strategies/base-strategy";

/**
 * Bank transaction data structure (subset of fields needed for categorization)
 */
export interface BankTransactionData {
  id?: string;
  merchantName?: string | null;
  description?: string | null;
  amount?: number | string | null;
}

/**
 * Adapter for bank statement workflow
 * Converts bank transaction data to categorization input
 */
export class BankStatementWorkflowAdapter
  implements WorkflowAdapter<BankTransactionData>
{
  readonly entityType: "bank_transaction" = "bank_transaction" as const;

  toCategorizationInput(transaction: BankTransactionData): CategorizationInput {
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

