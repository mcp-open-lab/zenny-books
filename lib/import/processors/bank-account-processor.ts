/**
 * Bank Account Statement Processor
 *
 * Handles checking/savings account statements with clear rules:
 * - Debits (withdrawals) = Expenses = Negative amounts
 * - Credits (deposits) = Income = Positive amounts
 *
 * Common formats:
 * 1. Separate Debit/Credit columns (most common)
 * 2. Single Amount column with negative for withdrawals
 * 3. Single Amount column with positive for all (requires reverseSign)
 */

import {
  BaseStatementProcessor,
  type ProcessedTransaction,
} from "./base-statement-processor";
import type { NormalizedTransaction } from "../spreadsheet-parser";
import { devLogger } from "@/lib/dev-logger";

export class BankAccountProcessor extends BaseStatementProcessor {
  getStatementType(): "bank_account" {
    return "bank_account";
  }

  getDescription(): string {
    return "Bank Account (Checking/Savings) - Debits are expenses, Credits are income";
  }

  async processTransactions(
    transactions: NormalizedTransaction[],
    currency: string
  ): Promise<ProcessedTransaction[]> {
    devLogger.info("Processing bank account transactions", {
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
      const amount = await this.calculateAmount(tx);

      // Detect payment method
      const paymentMethod = await this.detectPaymentMethod(fullDescription);

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
   * Calculate amount for bank account transactions
   *
   * Rules:
   * 1. If separate Debit/Credit columns exist:
   *    - Debit (withdrawal) → Negative (expense)
   *    - Credit (deposit) → Positive (income)
   *
   * 2. If single Amount column:
   *    - Use the value as-is (AI mapper should have set reverseSign if needed)
   *    - Standard: Negative = expense, Positive = income
   */
  private async calculateAmount(
    tx: NormalizedTransaction
  ): Promise<number> {
    // Priority 1: Separate Debit/Credit columns (most reliable)
    if (tx.debit !== null && tx.debit !== undefined) {
      const debitValue = Math.abs(this.parseAmount(tx.debit));
      // Debits are always withdrawals = expenses = negative
      return -debitValue;
    }

    if (tx.credit !== null && tx.credit !== undefined) {
      const creditValue = Math.abs(this.parseAmount(tx.credit));
      // Credits are always deposits = income = positive
      return creditValue;
    }

    // Priority 2: Single amount column
    if (tx.amount !== null && tx.amount !== undefined) {
      const amount = this.parseAmount(tx.amount);

      // The AI column mapper should have already applied reverseSign if needed
      // Standard accounting: negative = expense, positive = income
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
