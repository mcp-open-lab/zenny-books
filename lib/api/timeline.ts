import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  receipts,
  bankStatementTransactions,
  bankStatements,
  documents,
  businesses,
} from "@/lib/db/schema";

export type TimelineItem = {
  id: string;
  type: "receipt" | "transaction";
  date: Date | null;
  amount: string;
  merchantName: string | null;
  category: string | null;
  categoryId: string | null;
  businessId: string | null;
  businessName: string | null;
  status: string | null;
  description: string | null;
  currency: string | null;
  documentId: string | null;
};

export type TimelineFilters = {
  search?: string;
  category?: string;
  categoryId?: string;
  status?: string;
  type?: string; // 'receipt' | 'transaction'
  businessFilter?: string; // 'all' | 'personal' | 'business' | businessId
  transactionType?: string; // 'all' | 'income' | 'expense'
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  merchant?: string;
};

type GetTimelineItemsParams = {
  userId: string;
  limit: number;
  offset: number;
  filters?: TimelineFilters;
};

export async function getTimelineItems({
  userId,
  limit,
  offset,
  filters,
}: GetTimelineItemsParams) {
  const search = filters?.search?.toLowerCase();
  const category = filters?.category !== "all" ? filters?.category : undefined;
  const categoryId = filters?.categoryId;
  const status = filters?.status !== "all" ? filters?.status : undefined;
  const type = filters?.type !== "all" ? filters?.type : undefined;
  const businessFilter =
    filters?.businessFilter !== "all" ? filters?.businessFilter : undefined;
  const transactionType =
    filters?.transactionType !== "all" ? filters?.transactionType : undefined;
  const merchant = filters?.merchant !== "all" ? filters?.merchant : undefined;

  // Build Receipt Conditions
  const receiptConditions = [sql`${receipts.userId} = ${userId}`];

  if (search) {
    receiptConditions.push(sql`(
      LOWER(${receipts.merchantName}) LIKE ${`%${search}%`} OR 
      LOWER(${receipts.description}) LIKE ${`%${search}%`}
    )`);
  }
  if (category) {
    receiptConditions.push(sql`${receipts.category} = ${category}`);
  }
  if (categoryId) {
    receiptConditions.push(sql`${receipts.categoryId} = ${categoryId}`);
  }
  if (status) {
    receiptConditions.push(sql`${receipts.status} = ${status}`);
  }
  if (businessFilter === "personal") {
    receiptConditions.push(sql`${receipts.businessId} IS NULL`);
  } else if (businessFilter === "business") {
    receiptConditions.push(sql`${receipts.businessId} IS NOT NULL`);
  } else if (businessFilter && businessFilter !== "all") {
    receiptConditions.push(sql`${receipts.businessId} = ${businessFilter}`);
  }
  if (transactionType === "expense") {
    receiptConditions.push(sql`${receipts.totalAmount} < 0`);
  } else if (transactionType === "income") {
    receiptConditions.push(sql`${receipts.totalAmount} > 0`);
  }
  if (filters?.dateFrom) {
    receiptConditions.push(
      sql`${receipts.date} >= ${filters.dateFrom.toISOString()}`
    );
  }
  if (filters?.dateTo) {
    receiptConditions.push(
      sql`${receipts.date} <= ${filters.dateTo.toISOString()}`
    );
  }
  if (filters?.amountMin !== undefined) {
    receiptConditions.push(
      sql`ABS(${receipts.totalAmount}) >= ${filters.amountMin}`
    );
  }
  if (filters?.amountMax !== undefined) {
    receiptConditions.push(
      sql`ABS(${receipts.totalAmount}) <= ${filters.amountMax}`
    );
  }
  if (merchant) {
    receiptConditions.push(
      sql`LOWER(${receipts.merchantName}) = ${merchant.toLowerCase()}`
    );
  }

  const receiptWhere = sql.join(receiptConditions, sql` AND `);

  // Build Transaction Conditions
  const txConditions = [sql`${documents.userId} = ${userId}`];

  if (search) {
    txConditions.push(sql`(
      LOWER(${bankStatementTransactions.merchantName}) LIKE ${`%${search}%`} OR 
      LOWER(${bankStatementTransactions.description}) LIKE ${`%${search}%`}
    )`);
  }
  if (category) {
    txConditions.push(sql`${bankStatementTransactions.category} = ${category}`);
  }
  if (categoryId) {
    txConditions.push(
      sql`${bankStatementTransactions.categoryId} = ${categoryId}`
    );
  }
  // Status for transactions is always 'completed' for now, so we simulate filtering
  if (status && status !== "completed") {
    txConditions.push(sql`1=0`); // Force empty if searching for non-completed status
  }
  if (businessFilter === "personal") {
    txConditions.push(sql`${bankStatementTransactions.businessId} IS NULL`);
  } else if (businessFilter === "business") {
    txConditions.push(sql`${bankStatementTransactions.businessId} IS NOT NULL`);
  } else if (businessFilter && businessFilter !== "all") {
    txConditions.push(
      sql`${bankStatementTransactions.businessId} = ${businessFilter}`
    );
  }
  if (transactionType === "expense") {
    txConditions.push(sql`${bankStatementTransactions.amount} < 0`);
  } else if (transactionType === "income") {
    txConditions.push(sql`${bankStatementTransactions.amount} > 0`);
  }
  if (filters?.dateFrom) {
    txConditions.push(
      sql`${
        bankStatementTransactions.transactionDate
      } >= ${filters.dateFrom.toISOString()}`
    );
  }
  if (filters?.dateTo) {
    txConditions.push(
      sql`${
        bankStatementTransactions.transactionDate
      } <= ${filters.dateTo.toISOString()}`
    );
  }
  if (filters?.amountMin !== undefined) {
    txConditions.push(
      sql`ABS(${bankStatementTransactions.amount}) >= ${filters.amountMin}`
    );
  }
  if (filters?.amountMax !== undefined) {
    txConditions.push(
      sql`ABS(${bankStatementTransactions.amount}) <= ${filters.amountMax}`
    );
  }
  if (merchant) {
    txConditions.push(
      sql`LOWER(${
        bankStatementTransactions.merchantName
      }) = ${merchant.toLowerCase()}`
    );
  }

  const txWhere = sql.join(txConditions, sql` AND `);

  // Construct the UNION query parts conditionally based on 'type' filter
  let query;

  const receiptSelect = sql`
    SELECT 
      ${receipts.id} as id,
      'receipt' as type,
      ${receipts.date} as date,
      ${receipts.totalAmount}::text as amount,
      ${receipts.merchantName} as merchant_name,
      ${receipts.category} as category,
      ${receipts.categoryId} as category_id,
      ${receipts.businessId} as business_id,
      ${businesses.name} as business_name,
      ${receipts.status} as status,
      ${receipts.description} as description,
      ${receipts.currency} as currency,
      ${receipts.documentId} as document_id
    FROM ${receipts}
    LEFT JOIN ${businesses} ON ${receipts.businessId} = ${businesses.id}
    WHERE ${receiptWhere}
  `;

  const txSelect = sql`
    SELECT 
      ${bankStatementTransactions.id} as id,
      'transaction' as type,
      ${bankStatementTransactions.transactionDate} as date,
      ${bankStatementTransactions.amount}::text as amount,
      ${bankStatementTransactions.merchantName} as merchant_name,
      ${bankStatementTransactions.category} as category,
      ${bankStatementTransactions.categoryId} as category_id,
      ${bankStatementTransactions.businessId} as business_id,
      ${businesses.name} as business_name,
      'completed' as status,
      ${bankStatementTransactions.description} as description,
      ${bankStatementTransactions.currency} as currency,
      ${bankStatementTransactions.bankStatementId} as document_id
    FROM ${bankStatementTransactions}
    JOIN ${bankStatements} ON ${bankStatementTransactions.bankStatementId} = ${bankStatements.id}
    JOIN ${documents} ON ${bankStatements.documentId} = ${documents.id}
    LEFT JOIN ${businesses} ON ${bankStatementTransactions.businessId} = ${businesses.id}
    WHERE ${txWhere}
  `;

  if (type === "receipt") {
    query = sql`${receiptSelect} ORDER BY date DESC NULLS LAST, id ASC LIMIT ${limit} OFFSET ${offset}`;
  } else if (type === "transaction") {
    query = sql`${txSelect} ORDER BY date DESC NULLS LAST, id ASC LIMIT ${limit} OFFSET ${offset}`;
  } else {
    query = sql`
      (${receiptSelect})
      UNION ALL
      (${txSelect})
      ORDER BY date DESC NULLS LAST, id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  const result = await db.execute(query);

  type RawTimelineRow = {
    id: string;
    type: string;
    date: string | null;
    amount: string;
    merchant_name: string | null;
    category: string | null;
    category_id: string | null;
    business_id: string | null;
    business_name: string | null;
    status: string | null;
    description: string | null;
    currency: string | null;
    document_id: string | null;
  };

  return result.rows.map((row) => {
    const typedRow = row as RawTimelineRow;
    return {
      id: typedRow.id,
      type: typedRow.type as "receipt" | "transaction",
      date: typedRow.date ? new Date(typedRow.date) : null,
      amount: typedRow.amount,
      merchantName: typedRow.merchant_name,
      category: typedRow.category,
      categoryId: typedRow.category_id,
      businessId: typedRow.business_id,
      businessName: typedRow.business_name,
      status: typedRow.status,
      description: typedRow.description,
      currency: typedRow.currency,
      documentId: typedRow.document_id,
    } as TimelineItem;
  });
}
