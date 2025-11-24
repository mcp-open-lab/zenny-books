import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
  categories,
} from "@/lib/db/schema";
import { eq, and, isNotNull, desc, sql, or, inArray } from "drizzle-orm";
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
  businessId?: string | null;
  merchantName: string;
  createdAt: Date;
  entityType: EntityType;
}

/**
 * Merchant statistics aggregated from transaction history
 */
export interface MerchantStats {
  merchantName: string; // The most common or representative merchant name
  transactionCount: number;
  mostCommonCategoryId: string | null;
  mostCommonCategoryName: string | null;
  categoryUsageCount: number; // Number of times the most common category was used
  lastUsedDate: Date;
  hasRule: boolean; // Whether a rule exists for this merchant
  ruleId: string | null; // The rule ID if a rule exists
  ruleCategoryId: string | null; // The category ID from the rule
  ruleDisplayName: string | null; // The display name from the rule
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
        businessId: receipts.businessId,
        merchantName: receipts.merchantName,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .where(
        and(
          eq(receipts.userId, userId),
          sql`LOWER(${receipts.merchantName}) = LOWER(${merchantName})`,
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
          businessId: pastReceipts[0].businessId,
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
        businessId: bankStatementTransactions.businessId,
        merchantName: bankStatementTransactions.merchantName,
        createdAt: bankStatementTransactions.createdAt,
      })
      .from(bankStatementTransactions)
      .where(
        and(
          sql`LOWER(${bankStatementTransactions.merchantName}) = LOWER(${merchantName})`,
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
          businessId: pastTransactions[0].businessId,
          merchantName: pastTransactions[0].merchantName!,
          createdAt: pastTransactions[0].createdAt!,
          entityType: "bank_transaction",
        };
      }
    }

    return null;
  }

  /**
   * Get merchant statistics from transaction history
   * Returns aggregated data for each merchant with transaction counts,
   * most common category, and whether a rule exists
   */
  async getMerchantStatistics(
    userId: string,
    page: number = 1,
    pageSize: number = 25
  ): Promise<{
    stats: MerchantStats[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      // Query receipts for merchant stats
      const receiptStats = await db
        .select({
          merchantName: receipts.merchantName,
          categoryId: receipts.categoryId,
          date: receipts.date,
        })
        .from(receipts)
        .where(
          and(
            eq(receipts.userId, userId),
            isNotNull(receipts.merchantName),
            isNotNull(receipts.categoryId)
          )
        );

      // Query bank transactions for merchant stats (join through bankStatements -> documents to get userId)
      const bankStats = await db
        .select({
          merchantName: bankStatementTransactions.merchantName,
          categoryId: bankStatementTransactions.categoryId,
          date: bankStatementTransactions.transactionDate,
        })
        .from(bankStatementTransactions)
        .innerJoin(
          bankStatements,
          eq(bankStatementTransactions.bankStatementId, bankStatements.id)
        )
        .innerJoin(documents, eq(bankStatements.documentId, documents.id))
        .where(
          and(
            eq(documents.userId, userId),
            isNotNull(bankStatementTransactions.merchantName),
            isNotNull(bankStatementTransactions.categoryId)
          )
        );

      // Aggregate merchant data
      const merchantMap = new Map<
        string,
        {
          count: number;
          categoryFrequency: Map<string, number>;
          lastDate: Date;
        }
      >();

      // Process receipts
      for (const row of receiptStats) {
        if (!row.merchantName || !row.categoryId) continue;

        const key = row.merchantName.toLowerCase();
        const existing = merchantMap.get(key) || {
          count: 0,
          categoryFrequency: new Map(),
          lastDate: row.date || new Date(0),
        };

        existing.count++;
        existing.categoryFrequency.set(
          row.categoryId,
          (existing.categoryFrequency.get(row.categoryId) || 0) + 1
        );
        if (row.date && row.date > existing.lastDate) {
          existing.lastDate = row.date;
        }

        merchantMap.set(key, existing);
      }

      // Process bank transactions
      for (const row of bankStats) {
        if (!row.merchantName || !row.categoryId) continue;

        const key = row.merchantName.toLowerCase();
        const existing = merchantMap.get(key) || {
          count: 0,
          categoryFrequency: new Map(),
          lastDate: row.date || new Date(0),
        };

        existing.count++;
        existing.categoryFrequency.set(
          row.categoryId,
          (existing.categoryFrequency.get(row.categoryId) || 0) + 1
        );
        if (row.date && row.date > existing.lastDate) {
          existing.lastDate = row.date;
        }

        merchantMap.set(key, existing);
      }

      // Get all categories at once
      const allCategoryIds = Array.from(
        new Set(
          Array.from(merchantMap.values()).flatMap((m) =>
            Array.from(m.categoryFrequency.keys())
          )
        )
      );

      const categoryData =
        allCategoryIds.length > 0
          ? await db
              .select()
              .from(categories)
              .where(inArray(categories.id, allCategoryIds))
          : [];

      const categoryMap = new Map(categoryData.map((c) => [c.id, c.name]));

      // Convert to MerchantStats array
      const stats: MerchantStats[] = Array.from(merchantMap.entries()).map(
        ([merchantKey, data]) => {
          // Find most common category
          let mostCommonCategoryId: string | null = null;
          let maxCount = 0;

          for (const [catId, count] of data.categoryFrequency.entries()) {
            if (count > maxCount) {
              maxCount = count;
              mostCommonCategoryId = catId;
            }
          }

          return {
            merchantName: merchantKey,
            transactionCount: data.count,
            mostCommonCategoryId,
            mostCommonCategoryName: mostCommonCategoryId
              ? categoryMap.get(mostCommonCategoryId) || null
              : null,
            categoryUsageCount: maxCount,
            lastUsedDate: data.lastDate,
            hasRule: false, // Will be set in the calling function
            ruleId: null,
            ruleCategoryId: null,
            ruleDisplayName: null,
          };
        }
      );

      // Sort by transaction count descending
      stats.sort((a, b) => b.transactionCount - a.transactionCount);

      // Calculate pagination
      const totalCount = stats.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const offset = (page - 1) * pageSize;
      const paginatedStats = stats.slice(offset, offset + pageSize);

      return {
        stats: paginatedStats,
        totalCount,
        totalPages,
        currentPage: page,
      };
    } catch (error) {
      devLogger.error("TransactionRepository: Error getting merchant stats", {
        error,
      });
      return {
        stats: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      };
    }
  }

  /**
   * Get all transactions for a specific merchant
   * Returns combined results from receipts and bank transactions
   */
  async getMerchantTransactions(
    merchantName: string,
    userId: string,
    page: number = 1,
    pageSize: number = 25
  ): Promise<{
    transactions: Array<{
      id: string;
      merchantName: string;
      date: Date | null;
      amount: string;
      categoryId: string | null;
      categoryName: string | null;
      description: string | null;
      entityType: EntityType;
      source: "receipt" | "bank_transaction";
    }>;
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const transactions: Array<{
        id: string;
        merchantName: string;
        date: Date | null;
        amount: string;
        categoryId: string | null;
        categoryName: string | null;
        description: string | null;
        entityType: EntityType;
        source: "receipt" | "bank_transaction";
      }> = [];

      // Get receipts for this merchant (case-insensitive)
      const receiptData = await db
        .select({
          id: receipts.id,
          merchantName: receipts.merchantName,
          date: receipts.date,
          totalAmount: receipts.totalAmount,
          categoryId: receipts.categoryId,
          description: receipts.description,
        })
        .from(receipts)
        .where(
          and(
            eq(receipts.userId, userId),
            sql`LOWER(${receipts.merchantName}) = LOWER(${merchantName})`
          )
        )
        .orderBy(desc(receipts.date));

      // Get category names for receipts
      const receiptCategoryIds = receiptData
        .filter((r) => r.categoryId)
        .map((r) => r.categoryId!);

      const receiptCategories =
        receiptCategoryIds.length > 0
          ? await db
              .select()
              .from(categories)
              .where(inArray(categories.id, receiptCategoryIds))
          : [];

      const categoryMap = new Map(receiptCategories.map((c) => [c.id, c.name]));

      // Add receipts to transactions
      for (const receipt of receiptData) {
        transactions.push({
          id: receipt.id,
          merchantName: receipt.merchantName!,
          date: receipt.date,
          amount: receipt.totalAmount || "0",
          categoryId: receipt.categoryId,
          categoryName: receipt.categoryId
            ? categoryMap.get(receipt.categoryId) || null
            : null,
          description: receipt.description,
          entityType: "receipt",
          source: "receipt",
        });
      }

      // Get bank transactions for this merchant
      const bankData = await db
        .select({
          id: bankStatementTransactions.id,
          merchantName: bankStatementTransactions.merchantName,
          date: bankStatementTransactions.transactionDate,
          amount: bankStatementTransactions.amount,
          categoryId: bankStatementTransactions.categoryId,
          description: bankStatementTransactions.description,
        })
        .from(bankStatementTransactions)
        .innerJoin(
          bankStatements,
          eq(bankStatementTransactions.bankStatementId, bankStatements.id)
        )
        .innerJoin(documents, eq(bankStatements.documentId, documents.id))
        .where(
          and(
            eq(documents.userId, userId),
            sql`LOWER(${bankStatementTransactions.merchantName}) = LOWER(${merchantName})`
          )
        )
        .orderBy(desc(bankStatementTransactions.transactionDate));

      // Get category names for bank transactions
      const bankCategoryIds = bankData
        .filter((b) => b.categoryId)
        .map((b) => b.categoryId!);

      const bankCategories =
        bankCategoryIds.length > 0
          ? await db
              .select()
              .from(categories)
              .where(inArray(categories.id, bankCategoryIds))
          : [];

      const bankCategoryMap = new Map(
        bankCategories.map((c) => [c.id, c.name])
      );

      // Add bank transactions
      for (const bankTxn of bankData) {
        transactions.push({
          id: bankTxn.id,
          merchantName: bankTxn.merchantName!,
          date: bankTxn.date,
          amount: bankTxn.amount,
          categoryId: bankTxn.categoryId,
          categoryName: bankTxn.categoryId
            ? bankCategoryMap.get(bankTxn.categoryId) || null
            : null,
          description: bankTxn.description,
          entityType: "bank_transaction",
          source: "bank_transaction",
        });
      }

      // Sort all transactions by date (most recent first)
      transactions.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.getTime() - a.date.getTime();
      });

      // Calculate pagination
      const totalCount = transactions.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const offset = (page - 1) * pageSize;
      const paginatedTransactions = transactions.slice(offset, offset + pageSize);

      return {
        transactions: paginatedTransactions,
        totalCount,
        totalPages,
        currentPage: page,
      };
    } catch (error) {
      devLogger.error(
        "TransactionRepository: Error getting merchant transactions",
        { error, merchantName }
      );
      return {
        transactions: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      };
    }
  }
}
