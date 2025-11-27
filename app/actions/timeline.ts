"use server";

import {
  getTimelineItems,
  type TimelineItem,
  type TimelineFilters,
} from "@/lib/api/timeline";
import { db } from "@/lib/db";
import {
  receipts,
  bankStatementTransactions,
  businesses,
  bankStatements,
  documents,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createAuthenticatedAction } from "@/lib/safe-action";

type FetchTimelineInput = {
  page: number;
  limit?: number;
  filters?: TimelineFilters;
};

export const fetchTimelineItems = createAuthenticatedAction(
  "fetchTimelineItems",
  async (
    userId,
    input: FetchTimelineInput
  ): Promise<{ items: TimelineItem[]; hasMore: boolean }> => {
    const { page, limit = 20, filters } = input;
    const offset = (page - 1) * limit;
    const items = await getTimelineItems({
      userId,
      limit: limit + 1,
      offset,
      filters,
    });

    let hasMore = false;
    if (items.length > limit) {
      hasMore = true;
      items.pop();
    }

    return { items, hasMore };
  }
);

export const getTimelineMerchants = createAuthenticatedAction(
  "getTimelineMerchants",
  async (userId): Promise<string[]> => {
    const receiptMerchants = await db
      .selectDistinct({ merchantName: receipts.merchantName })
      .from(receipts)
      .where(eq(receipts.userId, userId));

    const txMerchants = await db
      .selectDistinct({ merchantName: bankStatementTransactions.merchantName })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .where(eq(documents.userId, userId));

    const allMerchants = [
      ...receiptMerchants.map((r) => r.merchantName).filter(Boolean),
      ...txMerchants.map((t) => t.merchantName).filter(Boolean),
    ];

    const uniqueMerchants = [...new Set(allMerchants)] as string[];

    return uniqueMerchants.sort((a, b) => a.localeCompare(b));
  }
);

export const getTimelineBusinesses = createAuthenticatedAction(
  "getTimelineBusinesses",
  async (userId) => {
    return db
      .select()
      .from(businesses)
      .where(eq(businesses.userId, userId))
      .orderBy(businesses.name);
  }
);
