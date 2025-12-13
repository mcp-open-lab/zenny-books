"use server";

import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
  businesses,
} from "@/lib/db/schema";
import { sql, inArray } from "drizzle-orm";
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
  // Query receipts that need review (only truly uncategorized or needs_review status)
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
        WHEN ${receipts.status} = 'needs_review' THEN 'needs_review'
        ELSE 'uncategorized'
      END as reason
    FROM ${receipts}
    WHERE ${receipts.userId} = ${userId}
      AND (
        ${receipts.categoryId} IS NULL
        OR ${receipts.status} = 'needs_review'
      )
    ORDER BY ${receipts.date} DESC NULLS LAST
    LIMIT 100
  `;

  // Query bank transactions that need review (uncategorized or default placeholder)
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
      'uncategorized' as reason
    FROM ${bankStatementTransactions}
    INNER JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    INNER JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    WHERE ${documents.userId} = ${userId}
      AND (
        ${bankStatementTransactions.categoryId} IS NULL
        OR ${bankStatementTransactions.category} = 'Uncategorized'
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

