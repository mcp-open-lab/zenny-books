"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  bankStatementTransactions,
  bankStatements,
  documents,
  categories,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";
import { createAuthenticatedAction } from "@/lib/safe-action";

const updateBankTransactionSchema = z.object({
  id: z.string(),
  merchantName: z.string().optional(),
  categoryId: z.string().optional(),
  businessId: z.string().optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notes: z.string().optional(),
});

export const updateBankTransaction = createAuthenticatedAction(
  "updateBankTransaction",
  async (userId, data: unknown) => {
    const validated = updateBankTransactionSchema.parse(data);

    const transaction = await db
      .select({ id: bankStatementTransactions.id })
      .from(bankStatementTransactions)
      .innerJoin(
        bankStatements,
        eq(bankStatementTransactions.bankStatementId, bankStatements.id)
      )
      .innerJoin(documents, eq(bankStatements.documentId, documents.id))
      .where(
        and(
          eq(bankStatementTransactions.id, validated.id),
          eq(documents.userId, userId)
        )
      )
      .limit(1);

    if (!transaction || transaction.length === 0) {
      throw new Error("Transaction not found or unauthorized");
    }

    let categoryName: string | null = null;
    if (validated.categoryId) {
      const categoryResult = await db
        .select()
        .from(categories)
        .where(eq(categories.id, validated.categoryId))
        .limit(1);
      categoryName = categoryResult[0]?.name ?? null;
    }

    await db
      .update(bankStatementTransactions)
      .set({
        merchantName: validated.merchantName || null,
        categoryId: validated.categoryId || null,
        category: categoryName,
        businessId:
          validated.businessId !== undefined ? validated.businessId : undefined,
        paymentMethod: validated.paymentMethod || null,
        updatedAt: new Date(),
      })
      .where(eq(bankStatementTransactions.id, validated.id));

    revalidatePath("/app");
    revalidatePath(`/app/transactions/${validated.id}`);
  }
);

