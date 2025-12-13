"use server";

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
import { eq, sql, inArray, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { devLogger } from "@/lib/dev-logger";
import { z } from "zod";
import { SIMILARITY_THRESHOLD } from "@/lib/constants";
import { createAuthenticatedAction } from "@/lib/safe-action";

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
        new RegExp(rule.value, "i");
        conditions.push(sql`NOT (${merchantNameColumn} ~* ${rule.value})`);
      } catch {
        // Invalid regex, skip
      }
    }
  }

  return conditions;
}

type SimilarTransactionsInput = {
  merchantName: string;
  dateRange?: { startDate: Date; endDate: Date };
  excludeTransactionId?: string;
  excludeEntityType?: "receipt" | "bank_transaction";
};

export const getSimilarTransactions = createAuthenticatedAction(
  "getSimilarTransactions",
  async (
    userId,
    input: SimilarTransactionsInput
  ): Promise<SimilarTransaction[]> => {
    const { merchantName, dateRange, excludeTransactionId, excludeEntityType } =
      input;

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

    const existingRules = await db
      .select({
        matchType: categoryRules.matchType,
        field: categoryRules.field,
        value: categoryRules.value,
      })
      .from(categoryRules)
      .where(and(eq(categoryRules.userId, userId), eq(categoryRules.isEnabled, true)));

    const ruleExclusionConditions = buildRuleExclusionConditions(
      receipts.merchantName,
      existingRules
    );
    const bankTxRuleExclusionConditions = buildRuleExclusionConditions(
      bankStatementTransactions.merchantName,
      existingRules
    );

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

    const allResults = [
      ...(receiptResults.rows as any[]),
      ...(bankTxResults.rows as any[]),
    ]
      .sort((a, b) => {
        if (Math.abs(b.sim_score - a.sim_score) > 0.1) {
          return b.sim_score - a.sim_score;
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 20);

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

    const filteredTransactions =
      excludeTransactionId && excludeEntityType
        ? similarTransactions.filter(
            (tx) =>
              !(tx.id === excludeTransactionId && tx.type === excludeEntityType)
          )
        : similarTransactions;

    return filteredTransactions;
  }
);

const CreateRuleFromTransactionSchema = z.object({
  merchantName: z.string().min(1, "Merchant name is required"),
  categoryId: z.string().min(1, "Category is required"),
  businessId: z.string().optional().nullable(),
  displayName: z.string().optional(),
  matchType: z.enum(["exact", "contains"] as const).default("contains"),
  source: z.string().optional(),
  createdFrom: z.string().optional().nullable(),
});

export const createRuleFromTransaction = createAuthenticatedAction(
  "createRuleFromTransaction",
  async (
    userId,
    input: z.infer<typeof CreateRuleFromTransactionSchema>
  ): Promise<{
    success: boolean;
    ruleId?: string;
    updated?: boolean;
    error?: string;
  }> => {
    try {
      const validatedInput = CreateRuleFromTransactionSchema.parse(input);

      const categoryRow = await db
        .select({
          id: categories.id,
          type: categories.type,
          userId: categories.userId,
          deletedAt: categories.deletedAt,
        })
        .from(categories)
        .where(eq(categories.id, validatedInput.categoryId))
        .limit(1);

      const category = categoryRow[0];
      if (!category || category.deletedAt) {
        return { success: false, error: "Category not found" };
      }

      if (category.type === "user" && category.userId !== userId) {
        return { success: false, error: "Unauthorized category" };
      }

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
        const existing = existingRules[0];

        await db
          .update(categoryRules)
          .set({
            categoryId: validatedInput.categoryId,
            businessId: validatedInput.businessId || null,
            matchType: validatedInput.matchType,
            displayName:
              validatedInput.displayName?.trim() ||
              validatedInput.merchantName.trim(),
            isEnabled: true,
            source: validatedInput.source?.trim() || "assignment",
            createdFrom: validatedInput.createdFrom?.trim() || null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(categoryRules.id, existing.id),
              eq(categoryRules.userId, userId)
            )
          );

        return { success: true, ruleId: existing.id, updated: true };
      }

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
        isEnabled: true,
        source: validatedInput.source?.trim() || "assignment",
        createdFrom: validatedInput.createdFrom?.trim() || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true, ruleId, updated: false };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error: error.errors[0].message };
      }
      return { success: false, error: "Failed to create rule" };
    }
  }
);

type SimilarStatsInput = {
  merchantName: string;
  excludeTransactionId?: string;
  excludeEntityType?: "receipt" | "bank_transaction";
};

type SimilarStatsResult = {
  totalCount: number;
  categorizedCount: number;
  mostCommonCategory: { id: string; name: string; count: number } | null;
  mostCommonBusiness: { id: string; name: string; count: number } | null;
};

export const getSimilarTransactionStats = createAuthenticatedAction(
  "getSimilarTransactionStats",
  async (userId, input: SimilarStatsInput): Promise<SimilarStatsResult> => {
    const { merchantName, excludeTransactionId, excludeEntityType } = input;

    if (!merchantName || merchantName.trim().length === 0) {
      return {
        totalCount: 0,
        categorizedCount: 0,
        mostCommonCategory: null,
        mostCommonBusiness: null,
      };
    }

    const existingRules = await db
      .select({
        matchType: categoryRules.matchType,
        field: categoryRules.field,
        value: categoryRules.value,
      })
      .from(categoryRules)
      .where(and(eq(categoryRules.userId, userId), eq(categoryRules.isEnabled, true)));

    const ruleExclusionConditions = buildRuleExclusionConditions(
      receipts.merchantName,
      existingRules
    );
    const bankTxRuleExclusionConditions = buildRuleExclusionConditions(
      bankStatementTransactions.merchantName,
      existingRules
    );

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
  }
);
