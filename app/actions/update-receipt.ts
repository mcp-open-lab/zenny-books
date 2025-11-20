"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type UpdateReceiptInput = {
  id: string;
  merchantName?: string | null;
  date?: string | null;
  totalAmount?: string | null;
  taxAmount?: string | null;
  category?: string | null;
  status?: string;
};

export async function updateReceipt(data: UpdateReceiptInput) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const updateData: Partial<typeof receipts.$inferInsert> = {
    merchantName: data.merchantName ?? null,
    category: data.category ?? null,
    status: data.status ?? "needs_review",
  };

  if (data.date) {
    updateData.date = new Date(data.date);
  } else {
    updateData.date = null;
  }

  if (data.totalAmount) {
    updateData.totalAmount = data.totalAmount;
  } else {
    updateData.totalAmount = null;
  }

  if (data.taxAmount !== undefined) {
    updateData.taxAmount = data.taxAmount || null;
  }

  await db
    .update(receipts)
    .set(updateData)
    .where(and(eq(receipts.id, data.id), eq(receipts.userId, userId)));

  revalidatePath("/app");
}
