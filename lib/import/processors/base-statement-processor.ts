/**
 * Base Statement Processor
 * Abstract class defining the contract for processing financial statements
 */

import type { NormalizedTransaction } from "../spreadsheet-parser";

export interface ProcessedTransaction {
  transactionDate: Date | null;
  postedDate: Date | null;
  description: string;
  merchantName: string | null;
  referenceNumber: string | null;
  amount: string; // Negative for expenses, positive for income
  currency: string;
  category: string | null;
  categoryId: string | null;
  businessId: string | null;
  paymentMethod: string | null;
  order: number;
}

export interface StatementMetadata {
  statementType: "bank_account" | "credit_card";
  currency: string;
  transactionCount: number;
}

/**
 * Abstract base class for statement processors
 *
 * Responsibilities:
 * - Define the contract for processing statements
 * - Provide common utilities (date parsing, payment detection)
 * - Enforce separation of concerns between statement types
 */
export abstract class BaseStatementProcessor {
  protected userId: string;
  protected defaultCurrency: string;

  constructor(userId: string, defaultCurrency: string = "USD") {
    this.userId = userId;
    this.defaultCurrency = defaultCurrency;
  }

  /**
   * Process raw transactions from spreadsheet parser
   * Each subclass implements its own amount calculation logic
   */
  abstract processTransactions(
    transactions: NormalizedTransaction[],
    currency: string
  ): Promise<ProcessedTransaction[]>;

  /**
   * Get statement type identifier
   */
  abstract getStatementType(): "bank_account" | "credit_card";

  /**
   * Get human-readable description of this processor
   */
  abstract getDescription(): string;

  /**
   * Common utility: Ensure date is a Date object or null
   */
  protected ensureDate(value: Date | string | null | undefined): Date | null {
    if (value instanceof Date) return value;
    if (value) {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  /**
   * Common utility: Parse amount value to number
   */
  protected parseAmount(value: number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    return parseFloat(String(value)) || 0;
  }

  /**
   * Common utility: Build full description from parts
   */
  protected buildDescription(
    description?: string | null,
    merchantName?: string | null
  ): string {
    return ((description || "") + " " + (merchantName || "")).trim();
  }

  /**
   * Common utility: Detect payment method from description
   */
  protected async detectPaymentMethod(
    description: string
  ): Promise<string | null> {
    const { detectPaymentMethod } = await import("../transaction-detection");
    return detectPaymentMethod(description);
  }

  /**
   * Common utility: Auto-categorize transaction
   */
  protected async categorizeTransaction(
    merchantName: string | null,
    description: string,
    amount: string
  ): Promise<{ categoryId: string | null; categoryName: string | null; businessId: string | null }> {
    if (!merchantName && !description) {
      return { categoryId: null, categoryName: null, businessId: null };
    }

    const { CategoryEngine } = await import("@/lib/categorization/engine");
    const result = await CategoryEngine.categorizeWithAI(
      { merchantName, description, amount, statementType: this.getStatementType() },
      { userId: this.userId, includeAI: true, minConfidence: 0.7 }
    );

    return {
      categoryId: result.categoryId || null,
      categoryName: result.categoryName || result.suggestedCategory || null,
      businessId: result.businessId || null,
    };
  }
}
