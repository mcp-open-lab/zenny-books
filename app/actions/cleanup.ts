"use server";

import { db } from "@/lib/db";
import { importBatches, importBatchItems, receipts, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createAuthenticatedAction } from "@/lib/safe-action";
import { z } from "zod";

const cleanupDatabaseSchema = z.object({
  confirm: z.literal(true),
});

export const cleanupDatabase = createAuthenticatedAction(
  "cleanupDatabase",
  async (userId, input: unknown) => {
    cleanupDatabaseSchema.parse(input);

    await db.delete(receipts).where(eq(receipts.userId, userId));

    const userDocuments = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.userId, userId));

    if (userDocuments.length > 0) {
      await db.delete(documents).where(eq(documents.userId, userId));
    }

    const batches = await db
      .select({ id: importBatches.id })
      .from(importBatches)
      .where(eq(importBatches.userId, userId));

    if (batches.length > 0) {
      for (const batch of batches) {
        await db
          .delete(importBatchItems)
          .where(eq(importBatchItems.batchId, batch.id));
      }
    }

    await db.delete(importBatches).where(eq(importBatches.userId, userId));

    return { success: true, count: batches.length };
  }
);
