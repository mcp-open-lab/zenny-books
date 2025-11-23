import { describe, it, expect } from "vitest";
import {
  ReceiptWorkflowAdapter,
  BankStatementWorkflowAdapter,
  CreditCardWorkflowAdapter,
} from "@/lib/categorization/adapters";

describe("Workflow Adapters", () => {
  describe("ReceiptWorkflowAdapter", () => {
    const adapter = new ReceiptWorkflowAdapter();

    it("should have correct entity type", () => {
      expect(adapter.entityType).toBe("receipt");
    });

    it("should convert receipt data to categorization input", () => {
      const receiptData = {
        id: "receipt-1",
        merchantName: "Starbucks",
        description: "Coffee purchase",
        totalAmount: 5.99,
      };

      const result = adapter.toCategorizationInput(receiptData);

      expect(result).toEqual({
        merchantName: "Starbucks",
        description: "Coffee purchase",
        amount: "5.99",
        entityId: "receipt-1",
        entityType: "receipt",
      });
    });

    it("should handle null values", () => {
      const receiptData = {
        merchantName: null,
        description: null,
        totalAmount: null,
      };

      const result = adapter.toCategorizationInput(receiptData);

      expect(result).toEqual({
        merchantName: null,
        description: null,
        amount: null,
        entityId: undefined,
        entityType: "receipt",
      });
    });
  });

  describe("BankStatementWorkflowAdapter", () => {
    const adapter = new BankStatementWorkflowAdapter();

    it("should have correct entity type", () => {
      expect(adapter.entityType).toBe("bank_transaction");
    });

    it("should convert bank transaction data to categorization input", () => {
      const transactionData = {
        id: "txn-1",
        merchantName: "Amazon",
        description: "Online purchase",
        amount: 49.99,
      };

      const result = adapter.toCategorizationInput(transactionData);

      expect(result).toEqual({
        merchantName: "Amazon",
        description: "Online purchase",
        amount: "49.99",
        entityId: "txn-1",
        entityType: "bank_transaction",
      });
    });

    it("should handle string amounts", () => {
      const transactionData = {
        id: "txn-1",
        merchantName: "Target",
        description: "Groceries",
        amount: "75.50",
      };

      const result = adapter.toCategorizationInput(transactionData);

      expect(result.amount).toBe("75.50");
    });
  });

  describe("CreditCardWorkflowAdapter", () => {
    const adapter = new CreditCardWorkflowAdapter();

    it("should have correct entity type", () => {
      expect(adapter.entityType).toBe("credit_card");
    });

    it("should convert credit card transaction data to categorization input", () => {
      const transactionData = {
        id: "cc-txn-1",
        merchantName: "Gas Station",
        description: "Fuel purchase",
        amount: 60.0,
      };

      const result = adapter.toCategorizationInput(transactionData);

      expect(result).toEqual({
        merchantName: "Gas Station",
        description: "Fuel purchase",
        amount: "60",
        entityId: "cc-txn-1",
        entityType: "credit_card",
      });
    });
  });
});

