/**
 * Credit Card Statement Processor
 *
 * Handles credit card statements with specific rules:
 * - Purchases/Charges = Expenses = Negative amounts
 * - Payments/Credits = Payments to CC (also expenses from cash flow perspective) = Negative amounts
 * - Refunds = Income = Positive amounts
 *
 * Common formats:
 * 1. Single Amount column with positive for purchases (most common - requires reverseSign)
 * 2. Single Amount column with negative for purchases (less common)
 * 3. Separate Debit/Credit columns (rare for CC statements)
 */

import {
  BaseStatementProcessor,
  type ProcessedTransaction,
} from "./base-statement-processor";
import type { NormalizedTransaction } from "../spreadsheet-parser";
import { devLogger } from "@/lib/dev-logger";

export class CreditCardProcessor extends BaseStatementProcessor {
  getStatementType(): "credit_card" {
    return "credit_card";
  }

  getDescription(): string {
    return "Credit Card - Purchases and payments are expenses, Refunds are income";
  }

  async processTransactions(
    transactions: NormalizedTransaction[],
    currency: string
  ): Promise<ProcessedTransaction[]> {
    devLogger.info("Processing credit card transactions", {
      count: transactions.length,
      currency,
    });

    const processed: ProcessedTransaction[] = [];

    for (let index = 0; index < transactions.length; index++) {
      const tx = transactions[index];
      const fullDescription = this.buildDescription(
        tx.description,
        tx.merchantName
      );

      // Calculate amount based on statement format
      const amount = await this.calculateAmount(tx, fullDescription);

      // Detect payment method (usually 'card' for credit card transactions)
      const paymentMethod =
        (await this.detectPaymentMethod(fullDescription)) || "card";

      // Categorize
      const { categoryId, categoryName, businessId } = await this.categorizeTransaction(
        tx.merchantName || null,
        tx.description || "",
        amount.toString()
      );

      processed.push({
        transactionDate: this.ensureDate(tx.transactionDate),
        postedDate: this.ensureDate(tx.postedDate),
        description: tx.description || "",
        merchantName: tx.merchantName || null,
        referenceNumber: tx.referenceNumber || null,
        amount: amount.toString(),
        currency,
        category: categoryName,
        categoryId,
        businessId,
        paymentMethod,
        order: index,
      });
    }

    return processed;
  }

  /**
   * Calculate amount for credit card transactions
   *
   * Rules:
   * 1. If separate Debit/Credit columns exist (rare):
   *    - Debit (purchase/charge) → Negative (expense)
   *    - Credit (payment/refund) → Check description for context
   *
   * 2. If single Amount column (most common):
   *    - AI mapper should have set reverseSign: true for typical CC format
   *    - After reversal: Negative = expense (purchase), Positive = income (refund)
   *    - Check for payment keywords to identify CC payments (also expenses)
   */
  private async calculateAmount(
    tx: NormalizedTransaction,
    description: string
  ): Promise<number> {
    const _upperDesc = description.toUpperCase();

    // Import keyword detection
    const { detectPaymentKeywords, detectRefundKeywords } = await import(
      "../transaction-detection"
    );

    // Priority 1: Separate Debit/Credit columns (rare for credit cards)
    if (tx.debit !== null && tx.debit !== undefined) {
      const debitValue = Math.abs(this.parseAmount(tx.debit));
      // Debits on CC = purchases = expenses = negative
      return -debitValue;
    }

    if (tx.credit !== null && tx.credit !== undefined) {
      const creditValue = Math.abs(this.parseAmount(tx.credit));

      // Credits on CC can be:
      // 1. Payments (to CC company) = expense from cash flow perspective = negative
      // 2. Refunds = income = positive
      if (detectRefundKeywords(description)) {
        return creditValue; // Positive (income)
      }

      // Default: treat credits as payments = negative (expense)
      return -creditValue;
    }

    // Priority 2: Single amount column (most common)
    if (tx.amount !== null && tx.amount !== undefined) {
      const amount = this.parseAmount(tx.amount);

      // The AI column mapper should have already applied reverseSign if needed
      // After processing: Negative = expense, Positive = income
      //
      // Special case: If positive amount with payment keywords, it's likely a
      // CC payment (expense), not income
      if (amount > 0 && detectPaymentKeywords(description)) {
        return -amount; // Convert to negative (expense)
      }

      return amount;
    }

    // No amount found
    devLogger.warn("Transaction has no amount", {
      description: tx.description,
      merchantName: tx.merchantName,
    });
    return 0;
  }
}
