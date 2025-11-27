"use server";

import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
  categories,
  businesses,
} from "@/lib/db/schema";
import { sql, and, eq, inArray } from "drizzle-orm";
import { createAuthenticatedAction } from "@/lib/safe-action";

export type ReviewQueueItem = {
  id: string;
  type: "receipt" | "bank_transaction";
  merchantName: string | null;
  description: string | null;
  amount: string;
  date: Date | null;
  currency: string | null;
  categoryId: string | null;
  categoryName: string | null;
  businessId: string | null;
  businessName: string | null;
  status: string | null;
  reason: string;
};

export const getReviewQueueItems = createAuthenticatedAction(
  "getReviewQueueItems",
  async (userId): Promise<{ items: ReviewQueueItem[]; totalCount: number }> => {

  // Check if user has businesses
  const userBusinesses = await db
    .select()
    .from(businesses)
    .where(eq(businesses.userId, userId));
  
  const hasBusinesses = userBusinesses.length > 0;

  // Query receipts that need review
  const receiptsQuery = sql`
    SELECT 
      ${receipts.id} as id,
      'receipt' as type,
      ${receipts.merchantName} as merchant_name,
      ${receipts.description} as description,
      ${receipts.totalAmount}::text as amount,
      ${receipts.date} as date,
      ${receipts.currency} as currency,
      ${receipts.categoryId} as category_id,
      ${receipts.category} as category_name,
      ${receipts.businessId} as business_id,
      ${receipts.status} as status,
      CASE 
        WHEN ${receipts.categoryId} IS NULL THEN 'uncategorized'
        WHEN ${receipts.category} IN ('Other Expense', 'Other Income') THEN 'other_category'
        WHEN ${receipts.status} = 'needs_review' THEN 'needs_review'
        WHEN ${receipts.businessId} IS NULL AND ${hasBusinesses} THEN 'no_business'
        ELSE 'uncategorized'
      END as reason
    FROM ${receipts}
    WHERE ${receipts.userId} = ${userId}
      AND (
        ${receipts.categoryId} IS NULL
        OR ${receipts.category} IN ('Other Expense', 'Other Income')
        OR ${receipts.status} = 'needs_review'
        ${hasBusinesses ? sql`OR ${receipts.businessId} IS NULL` : sql``}
      )
    ORDER BY ${receipts.date} DESC NULLS LAST
    LIMIT 100
  `;

  // Query bank transactions that need review
  const bankTxQuery = sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      'bank_transaction' as type,
      ${bankStatementTransactions.merchantName} as merchant_name,
      ${bankStatementTransactions.description} as description,
      ${bankStatementTransactions.amount}::text as amount,
      ${bankStatementTransactions.transactionDate} as date,
      ${bankStatementTransactions.currency} as currency,
      ${bankStatementTransactions.categoryId} as category_id,
      ${bankStatementTransactions.category} as category_name,
      ${bankStatementTransactions.businessId} as business_id,
      'completed' as status,
      CASE 
        WHEN ${bankStatementTransactions.categoryId} IS NULL THEN 'uncategorized'
        WHEN ${bankStatementTransactions.category} IN ('Other Expense', 'Other Income') THEN 'other_category'
        WHEN ${bankStatementTransactions.businessId} IS NULL AND ${hasBusinesses} THEN 'no_business'
        ELSE 'uncategorized'
      END as reason
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND (
        ${bankStatementTransactions.categoryId} IS NULL
        OR ${bankStatementTransactions.category} IN ('Other Expense', 'Other Income')
        ${hasBusinesses ? sql`OR ${bankStatementTransactions.businessId} IS NULL` : sql``}
      )
    ORDER BY ${bankStatementTransactions.transactionDate} DESC NULLS LAST
    LIMIT 100
  `;

  // Execute queries
  const [receiptsResult, bankTxResult] = await Promise.all([
    db.execute(receiptsQuery),
    db.execute(bankTxQuery),
  ]);

  // Combine and sort results
  const allItems = [
    ...(receiptsResult.rows as any[]),
    ...(bankTxResult.rows as any[]),
  ].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA; // Most recent first
  });

  // Get business names for items that have businessId
  const businessIds = [...new Set(allItems.map(item => item.business_id).filter(Boolean))] as string[];
  const businessData = businessIds.length > 0
    ? await db.select().from(businesses).where(inArray(businesses.id, businessIds))
    : [];
  
  const businessMap = new Map(businessData.map(b => [b.id, b.name]));

  // Format items
  const items: ReviewQueueItem[] = allItems.map((item) => ({
    id: item.id,
    type: item.type,
    merchantName: item.merchant_name,
    description: item.description,
    amount: item.amount,
    date: item.date ? new Date(item.date) : null,
    currency: item.currency,
    categoryId: item.category_id,
    categoryName: item.category_name,
    businessId: item.business_id,
    businessName: item.business_id ? businessMap.get(item.business_id) || null : null,
    status: item.status,
    reason: item.reason,
  }));

    return {
      items,
      totalCount: items.length,
    };
  }
);

type BulkUpdateInput = Array<{
  id: string;
  type: "receipt" | "bank_transaction";
  categoryId: string;
  businessId?: string | null;
}>;

export const bulkUpdateTransactions = createAuthenticatedAction(
  "bulkUpdateTransactions",
  async (
    userId,
    updates: BulkUpdateInput
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const receiptUpdates = updates.filter((u) => u.type === "receipt");
      const bankTxUpdates = updates.filter((u) => u.type === "bank_transaction");

      const categoryIds = [...new Set(updates.map((u) => u.categoryId))];
      const categoryData = await db
        .select()
        .from(categories)
        .where(inArray(categories.id, categoryIds));

      const categoryMap = new Map(categoryData.map((c) => [c.id, c.name]));

      for (const update of receiptUpdates) {
        const categoryName = categoryMap.get(update.categoryId) || null;
        await db
          .update(receipts)
          .set({
            categoryId: update.categoryId,
            category: categoryName,
            businessId:
              update.businessId !== undefined ? update.businessId : undefined,
            status: "approved",
            updatedAt: new Date(),
          })
          .where(and(eq(receipts.id, update.id), eq(receipts.userId, userId)));
      }

      for (const update of bankTxUpdates) {
        const categoryName = categoryMap.get(update.categoryId) || null;

        const txCheck = await db
          .select({ id: bankStatementTransactions.id })
          .from(bankStatementTransactions)
          .innerJoin(
            bankStatements,
            eq(bankStatementTransactions.bankStatementId, bankStatements.id)
          )
          .innerJoin(documents, eq(bankStatements.documentId, documents.id))
          .where(
            and(
              eq(bankStatementTransactions.id, update.id),
              eq(documents.userId, userId)
            )
          )
          .limit(1);

        if (txCheck.length > 0) {
          await db
            .update(bankStatementTransactions)
            .set({
              categoryId: update.categoryId,
              category: categoryName,
              businessId:
                update.businessId !== undefined ? update.businessId : undefined,
              updatedAt: new Date(),
            })
            .where(eq(bankStatementTransactions.id, update.id));
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Bulk update error:", error);
      return { success: false, error: "Failed to update transactions" };
    }
  }
);

