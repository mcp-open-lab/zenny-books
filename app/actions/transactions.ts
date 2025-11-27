"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
  categories,
  businesses,
  categoryRules,
} from "@/lib/db/schema";
import { eq, and, sql, desc, gte, lte, isNotNull, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { devLogger } from "@/lib/dev-logger";
import { z } from "zod";
import { SIMILARITY_THRESHOLD } from "@/lib/constants";

/**
 * Similar transaction from history
 */
export interface SimilarTransaction {
  id: string;
  merchantName: string;
  amount: string;
  date: Date;
  categoryId: string | null;
  categoryName: string | null;
  businessId: string | null;
  businessName: string | null;
  type: "receipt" | "bank_transaction";
}

/**
 * Build SQL conditions to exclude merchants that match existing rules
 */
function buildRuleExclusionConditions(
  merchantNameColumn: any,
  rules: Array<{ matchType: string; field: string; value: string }>
): any[] {
  const conditions: any[] = [];

  for (const rule of rules) {
    if (rule.field !== "merchantName") continue;

    if (rule.matchType === "exact") {
      conditions.push(
        sql`LOWER(${merchantNameColumn}) != LOWER(${rule.value})`
      );
    } else if (rule.matchType === "contains") {
      conditions.push(
        sql`LOWER(${merchantNameColumn}) NOT LIKE LOWER(${`%${rule.value}%`})`
      );
    } else if (rule.matchType === "regex") {
      try {
        // Validate regex before using
        new RegExp(rule.value, "i");
        conditions.push(sql`NOT (${merchantNameColumn} ~* ${rule.value})`);
      } catch {
        // Invalid regex, skip
      }
    }
  }

  return conditions;
}

/**
 * Get similar transactions based on merchant name
 * Uses PostgreSQL's pg_trgm similarity and excludes transactions that match existing rules
 */
export async function getSimilarTransactions(
  merchantName: string,
  dateRange?: { startDate: Date; endDate: Date },
  excludeTransactionId?: string,
  excludeEntityType?: "receipt" | "bank_transaction"
): Promise<SimilarTransaction[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!merchantName || merchantName.trim().length === 0) {
    return [];
  }

  const now = new Date();
  const defaultStartDate = new Date(now);
  defaultStartDate.setDate(now.getDate() - 90);
  const defaultEndDate = new Date(now);
  defaultEndDate.setDate(now.getDate() + 90);

  const startDate = dateRange?.startDate || defaultStartDate;
  const endDate = dateRange?.endDate || defaultEndDate;

  try {
    // Fetch existing rules to filter out transactions that already have rules
    const existingRules = await db
      .select({
        matchType: categoryRules.matchType,
        field: categoryRules.field,
        value: categoryRules.value,
      })
      .from(categoryRules)
      .where(eq(categoryRules.userId, userId));

    const ruleExclusionConditions = buildRuleExclusionConditions(
      receipts.merchantName,
      existingRules
    );
    const bankTxRuleExclusionConditions = buildRuleExclusionConditions(
      bankStatementTransactions.merchantName,
      existingRules
    );

    // Search receipts using PostgreSQL similarity
    const receiptResults = await db.execute(sql`
      SELECT 
        ${receipts.id} as id,
        ${receipts.merchantName} as "merchantName",
        ${receipts.totalAmount} as amount,
        ${receipts.date} as date,
        ${receipts.categoryId} as "categoryId",
        ${receipts.businessId} as "businessId",
        similarity(${receipts.merchantName}, ${merchantName}) as sim_score,
        'receipt' as type
      FROM ${receipts}
      WHERE ${receipts.userId} = ${userId}
        AND ${receipts.merchantName} IS NOT NULL
        AND ${receipts.date} >= ${startDate}
        AND ${receipts.date} <= ${endDate}
        AND similarity(${
          receipts.merchantName
        }, ${merchantName}) > ${SIMILARITY_THRESHOLD}
        ${
          ruleExclusionConditions.length > 0
            ? sql`AND ${sql.join(ruleExclusionConditions, sql` AND `)}`
            : sql``
        }
      ORDER BY sim_score DESC, ${receipts.date} DESC
      LIMIT 20
    `);

    // Search bank transactions using PostgreSQL similarity
    const bankTxResults = await db.execute(sql`
      SELECT 
        ${bankStatementTransactions.id} as id,
        ${bankStatementTransactions.merchantName} as "merchantName",
        ${bankStatementTransactions.amount} as amount,
        ${bankStatementTransactions.transactionDate} as date,
        ${bankStatementTransactions.categoryId} as "categoryId",
        ${bankStatementTransactions.businessId} as "businessId",
        similarity(${
          bankStatementTransactions.merchantName
        }, ${merchantName}) as sim_score,
        'bank_transaction' as type
      FROM ${bankStatementTransactions}
      INNER JOIN ${bankStatements} ON ${
      bankStatementTransactions.bankStatementId
    } = ${bankStatements.id}
      INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
      WHERE ${documents.userId} = ${userId}
        AND ${bankStatementTransactions.merchantName} IS NOT NULL
        AND ${bankStatementTransactions.transactionDate} >= ${startDate}
        AND ${bankStatementTransactions.transactionDate} <= ${endDate}
        AND similarity(${
          bankStatementTransactions.merchantName
        }, ${merchantName}) > ${SIMILARITY_THRESHOLD}
        ${
          bankTxRuleExclusionConditions.length > 0
            ? sql`AND ${sql.join(bankTxRuleExclusionConditions, sql` AND `)}`
            : sql``
        }
      ORDER BY sim_score DESC, ${bankStatementTransactions.transactionDate} DESC
      LIMIT 20
    `);

    // Combine results
    const allResults = [
      ...(receiptResults.rows as any[]),
      ...(bankTxResults.rows as any[]),
    ]
      .sort((a, b) => {
        // Sort by similarity first, then by date
        if (Math.abs(b.sim_score - a.sim_score) > 0.1) {
          return b.sim_score - a.sim_score;
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 20);

    // Get category and business names
    const allCategoryIds = allResults
      .map((t) => t.categoryId)
      .filter(Boolean) as string[];

    const allBusinessIds = allResults
      .map((t) => t.businessId)
      .filter(Boolean) as string[];

    const [categoryData, businessData] = await Promise.all([
      allCategoryIds.length > 0
        ? db
            .select()
            .from(categories)
            .where(inArray(categories.id, allCategoryIds))
        : Promise.resolve([]),
      allBusinessIds.length > 0
        ? db
            .select()
            .from(businesses)
            .where(inArray(businesses.id, allBusinessIds))
        : Promise.resolve([]),
    ]);

    const categoryMap = new Map(categoryData.map((c) => [c.id, c.name]));
    const businessMap = new Map(businessData.map((b) => [b.id, b.name]));

    // Format final results
    const similarTransactions: SimilarTransaction[] = allResults.map((tx) => ({
      id: tx.id,
      merchantName: tx.merchantName || "Unknown",
      amount: tx.amount || "0",
      date: new Date(tx.date),
      categoryId: tx.categoryId,
      categoryName: tx.categoryId
        ? categoryMap.get(tx.categoryId) || null
        : null,
      businessId: tx.businessId,
      businessName: tx.businessId
        ? businessMap.get(tx.businessId) || null
        : null,
      type: tx.type,
    }));

    // Filter out the current transaction if specified
    const filteredTransactions =
      excludeTransactionId && excludeEntityType
        ? similarTransactions.filter(
            (tx) =>
              !(tx.id === excludeTransactionId && tx.type === excludeEntityType)
          )
        : similarTransactions;

    devLogger.debug("Found similar transactions (pg_trgm)", {
      merchantName,
      count: filteredTransactions.length,
      threshold: SIMILARITY_THRESHOLD,
      userId,
    });

    return filteredTransactions;
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : String(error);

    devLogger.error("Error fetching similar transactions", {
      error: errorDetails,
      merchantName,
      userId,
    });

    // Re-throw with more context
    throw error;
  }
}

/**
 * Create a rule from a transaction's data
 */
const CreateRuleFromTransactionSchema = z.object({
  merchantName: z.string().min(1, "Merchant name is required"),
  categoryId: z.string().min(1, "Category is required"),
  businessId: z.string().optional().nullable(),
  displayName: z.string().optional(),
  matchType: z.enum(["exact", "contains"] as const).default("contains"),
});

export async function createRuleFromTransaction(
  input: z.infer<typeof CreateRuleFromTransactionSchema>
): Promise<{ success: boolean; ruleId?: string; error?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const validatedInput = CreateRuleFromTransactionSchema.parse(input);

    // Check if rule already exists for this merchant/category combo
    const existingRules = await db
      .select()
      .from(categoryRules)
      .where(
        and(
          eq(categoryRules.userId, userId),
          eq(categoryRules.field, "merchantName"),
          sql`LOWER(${categoryRules.value}) = LOWER(${validatedInput.merchantName})`
        )
      )
      .limit(1);

    if (existingRules.length > 0) {
      return {
        success: false,
        error: "A rule for this merchant already exists",
      };
    }

    // Create the rule
    const ruleId = createId();
    await db.insert(categoryRules).values({
      id: ruleId,
      userId,
      categoryId: validatedInput.categoryId,
      businessId: validatedInput.businessId || null,
      matchType: validatedInput.matchType,
      field: "merchantName",
      value: validatedInput.merchantName.trim(),
      displayName:
        validatedInput.displayName?.trim() ||
        validatedInput.merchantName.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    devLogger.info("Created rule from transaction", {
      ruleId,
      merchantName: validatedInput.merchantName,
      categoryId: validatedInput.categoryId,
      businessId: validatedInput.businessId,
      userId,
    });

    return { success: true, ruleId };
  } catch (error) {
    devLogger.error("Error creating rule from transaction", {
      error,
      input,
      userId,
    });

    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }

    return { success: false, error: "Failed to create rule" };
  }
}

/**
 * Get statistics about similar transactions to help with rule creation
 * Uses PostgreSQL's pg_trgm similarity and excludes transactions that match existing rules
 */
export async function getSimilarTransactionStats(
  merchantName: string,
  excludeTransactionId?: string,
  excludeEntityType?: "receipt" | "bank_transaction"
): Promise<{
  totalCount: number;
  categorizedCount: number;
  mostCommonCategory: { id: string; name: string; count: number } | null;
  mostCommonBusiness: { id: string; name: string; count: number } | null;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!merchantName || merchantName.trim().length === 0) {
    return {
      totalCount: 0,
      categorizedCount: 0,
      mostCommonCategory: null,
      mostCommonBusiness: null,
    };
  }

  try {
    // Fetch existing rules
    const existingRules = await db
      .select({
        matchType: categoryRules.matchType,
        field: categoryRules.field,
        value: categoryRules.value,
      })
      .from(categoryRules)
      .where(eq(categoryRules.userId, userId));

    const ruleExclusionConditions = buildRuleExclusionConditions(
      receipts.merchantName,
      existingRules
    );
    const bankTxRuleExclusionConditions = buildRuleExclusionConditions(
      bankStatementTransactions.merchantName,
      existingRules
    );

    // Get counts and most common category/business using PostgreSQL similarity
    const statsQuery = await db.execute(sql`
      WITH similar_transactions AS (
        SELECT 
          ${receipts.categoryId} as category_id,
          ${receipts.businessId} as business_id
        FROM ${receipts}
        WHERE ${receipts.userId} = ${userId}
          AND ${receipts.merchantName} IS NOT NULL
          AND similarity(${
            receipts.merchantName
          }, ${merchantName}) > ${SIMILARITY_THRESHOLD}
          ${
            excludeTransactionId && excludeEntityType === "receipt"
              ? sql`AND ${receipts.id} != ${excludeTransactionId}`
              : sql``
          }
          ${
            ruleExclusionConditions.length > 0
              ? sql`AND ${sql.join(ruleExclusionConditions, sql` AND `)}`
              : sql``
          }
        
        UNION ALL
        
        SELECT 
          ${bankStatementTransactions.categoryId} as category_id,
          ${bankStatementTransactions.businessId} as business_id
        FROM ${bankStatementTransactions}
        INNER JOIN ${bankStatements} ON ${
      bankStatementTransactions.bankStatementId
    } = ${bankStatements.id}
        INNER JOIN ${documents} ON ${bankStatements.documentId} = ${
      documents.id
    }
        WHERE ${documents.userId} = ${userId}
          AND ${bankStatementTransactions.merchantName} IS NOT NULL
          AND similarity(${
            bankStatementTransactions.merchantName
          }, ${merchantName}) > ${SIMILARITY_THRESHOLD}
          ${
            excludeTransactionId && excludeEntityType === "bank_transaction"
              ? sql`AND ${bankStatementTransactions.id} != ${excludeTransactionId}`
              : sql``
          }
          ${
            bankTxRuleExclusionConditions.length > 0
              ? sql`AND ${sql.join(bankTxRuleExclusionConditions, sql` AND `)}`
              : sql``
          }
      )
      SELECT 
        COUNT(*) as total_count,
        COUNT(category_id) as categorized_count,
        (
          SELECT category_id
          FROM similar_transactions
          WHERE category_id IS NOT NULL
          GROUP BY category_id
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as most_common_category_id,
        (
          SELECT COUNT(*)
          FROM similar_transactions
          WHERE category_id = (
            SELECT category_id
            FROM similar_transactions
            WHERE category_id IS NOT NULL
            GROUP BY category_id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        ) as most_common_category_count,
        (
          SELECT business_id
          FROM similar_transactions
          WHERE business_id IS NOT NULL
          GROUP BY business_id
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as most_common_business_id,
        (
          SELECT COUNT(*)
          FROM similar_transactions
          WHERE business_id = (
            SELECT business_id
            FROM similar_transactions
            WHERE business_id IS NOT NULL
            GROUP BY business_id
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        ) as most_common_business_count
      FROM similar_transactions
    `);

    const stats = statsQuery.rows[0] as any;
    const totalCount = Number(stats?.total_count || 0);
    const categorizedCount = Number(stats?.categorized_count || 0);

    let mostCommonCategory: { id: string; name: string; count: number } | null =
      null;

    if (stats?.most_common_category_id) {
      const categoryInfo = await db
        .select()
        .from(categories)
        .where(eq(categories.id, stats.most_common_category_id))
        .limit(1);

      if (categoryInfo.length > 0) {
        mostCommonCategory = {
          id: categoryInfo[0].id,
          name: categoryInfo[0].name,
          count: Number(stats.most_common_category_count || 0),
        };
      }
    }

    let mostCommonBusiness: { id: string; name: string; count: number } | null =
      null;

    if (stats?.most_common_business_id) {
      const businessInfo = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, stats.most_common_business_id))
        .limit(1);

      if (businessInfo.length > 0) {
        mostCommonBusiness = {
          id: businessInfo[0].id,
          name: businessInfo[0].name,
          count: Number(stats.most_common_business_count || 0),
        };
      }
    }

    return {
      totalCount,
      categorizedCount,
      mostCommonCategory,
      mostCommonBusiness,
    };
  } catch (error) {
    devLogger.error("Error fetching similar transaction stats", {
      error,
      merchantName,
      userId,
    });
    throw new Error("Failed to fetch transaction statistics");
  }
}
