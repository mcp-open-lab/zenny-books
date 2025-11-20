"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { EditReceiptSchema } from "@/lib/schemas";

export async function updateReceipt(data: unknown) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Validate input with Zod schema
  const validated = EditReceiptSchema.parse(data);

  const updateData: Partial<typeof receipts.$inferInsert> = {
    merchantName: validated.merchantName ?? null,
    category: validated.category ?? null,
    description: validated.description ?? null,
    paymentMethod: validated.paymentMethod ?? null,
    status: validated.status ?? "needs_review",
  };

  if (validated.date) {
    updateData.date = new Date(validated.date);
  } else {
    updateData.date = null;
  }

  if (validated.totalAmount !== undefined) {
    updateData.totalAmount = validated.totalAmount || null;
  }

  if (validated.taxAmount !== undefined) {
    updateData.taxAmount = validated.taxAmount || null;
  }

  if (validated.tipAmount !== undefined) {
    updateData.tipAmount = validated.tipAmount || null;
  }

  if (validated.discountAmount !== undefined) {
    updateData.discountAmount = validated.discountAmount || null;
  }

  await db
    .update(receipts)
    .set(updateData)
    .where(and(eq(receipts.id, validated.id), eq(receipts.userId, userId)));

  revalidatePath("/app");
}
