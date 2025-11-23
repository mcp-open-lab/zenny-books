import type { WorkflowAdapter } from "./base-adapter";
import type { CategorizationInput } from "../strategies/base-strategy";

/**
 * Receipt data structure (subset of fields needed for categorization)
 */
export interface ReceiptData {
  id?: string;
  merchantName?: string | null;
  description?: string | null;
  totalAmount?: number | null;
}

/**
 * Adapter for receipt workflow
 * Converts receipt data to categorization input
 */
export class ReceiptWorkflowAdapter implements WorkflowAdapter<ReceiptData> {
  readonly entityType: "receipt" = "receipt" as const;

  toCategorizationInput(receipt: ReceiptData): CategorizationInput {
    return {
      merchantName: receipt.merchantName ?? null,
      description: receipt.description ?? null,
      amount: receipt.totalAmount?.toString() ?? null,
      entityId: receipt.id,
      entityType: this.entityType,
    };
  }
}

