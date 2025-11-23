import { db } from "@/lib/db";
import { receipts, bankStatementTransactions, categories } from "@/lib/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { devLogger } from "@/lib/dev-logger";

/**
 * Entity types that can have transaction history
 */
export type EntityType = "receipt" | "bank_transaction" | "credit_card";

/**
 * Normalized transaction history result
 */
export interface TransactionHistory {
  categoryId: string;
  categoryName: string;
  merchantName: string;
  createdAt: Date;
  entityType: EntityType;
}

/**
 * Repository for unified transaction history access
 * Eliminates duplicate query logic across different entity types
 */
export class TransactionRepository {
  /**
   * Find past transactions by merchant name across all entity types
   * Returns the most recent categorized transaction
   */
  async findHistoryByMerchant(
    merchantName: string,
    userId: string,
    entityTypes: EntityType[] = ["receipt", "bank_transaction"]
  ): Promise<TransactionHistory | null> {
    try {
      // Query receipts if included
      if (entityTypes.includes("receipt")) {
        const receiptHistory = await this.findReceiptHistory(
          merchantName,
          userId
        );
        if (receiptHistory) return receiptHistory;
      }

      // Query bank transactions if included
      if (entityTypes.includes("bank_transaction")) {
        const bankHistory = await this.findBankTransactionHistory(
          merchantName,
          userId
        );
        if (bankHistory) return bankHistory;
      }

      // TODO: Add credit card when implemented
      if (entityTypes.includes("credit_card")) {
        // Future: creditCardHistory
      }

      return null;
    } catch (error) {
      devLogger.error("TransactionRepository: Error finding history", {
        error,
        merchantName,
      });
      return null;
    }
  }

  /**
   * Find receipt history for a merchant
   */
  private async findReceiptHistory(
    merchantName: string,
    userId: string
  ): Promise<TransactionHistory | null> {
    const pastReceipts = await db
      .select({
        categoryId: receipts.categoryId,
        merchantName: receipts.merchantName,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .where(
        and(
          eq(receipts.userId, userId),
          eq(receipts.merchantName, merchantName),
          isNotNull(receipts.categoryId)
        )
      )
      .orderBy(desc(receipts.createdAt))
      .limit(1);

    if (pastReceipts.length > 0 && pastReceipts[0].categoryId) {
      const categoryData = await db
        .select()
        .from(categories)
        .where(eq(categories.id, pastReceipts[0].categoryId))
        .limit(1);

      if (categoryData.length > 0) {
        return {
          categoryId: pastReceipts[0].categoryId,
          categoryName: categoryData[0].name,
          merchantName: pastReceipts[0].merchantName!,
          createdAt: pastReceipts[0].createdAt!,
          entityType: "receipt",
        };
      }
    }

    return null;
  }

  /**
   * Find bank transaction history for a merchant
   */
  private async findBankTransactionHistory(
    merchantName: string,
    userId: string
  ): Promise<TransactionHistory | null> {
    const pastTransactions = await db
      .select({
        categoryId: bankStatementTransactions.categoryId,
        merchantName: bankStatementTransactions.merchantName,
        createdAt: bankStatementTransactions.createdAt,
      })
      .from(bankStatementTransactions)
      .where(
        and(
          eq(bankStatementTransactions.merchantName, merchantName),
          isNotNull(bankStatementTransactions.categoryId)
        )
      )
      .orderBy(desc(bankStatementTransactions.createdAt))
      .limit(1);

    if (pastTransactions.length > 0 && pastTransactions[0].categoryId) {
      const categoryData = await db
        .select()
        .from(categories)
        .where(eq(categories.id, pastTransactions[0].categoryId))
        .limit(1);

      if (categoryData.length > 0) {
        return {
          categoryId: pastTransactions[0].categoryId,
          categoryName: categoryData[0].name,
          merchantName: pastTransactions[0].merchantName!,
          createdAt: pastTransactions[0].createdAt!,
          entityType: "bank_transaction",
        };
      }
    }

    return null;
  }
}

