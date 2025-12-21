#!/usr/bin/env tsx
import { db } from "@/lib/db";
import { importBatchItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const pending = await db
    .select({ status: importBatchItems.status, fileName: importBatchItems.fileName })
    .from(importBatchItems)
    .where(eq(importBatchItems.status, "pending"))
    .limit(5);

  const processing = await db
    .select({ status: importBatchItems.status, fileName: importBatchItems.fileName })
    .from(importBatchItems)
    .where(eq(importBatchItems.status, "processing"))
    .limit(5);

  const completed = await db
    .select({ status: importBatchItems.status, fileName: importBatchItems.fileName })
    .from(importBatchItems)
    .where(eq(importBatchItems.status, "completed"))
    .limit(5);

  console.log(`Pending: ${pending.length}`);
  console.log(`Processing: ${processing.length}`);
  console.log(`Completed: ${completed.length}`);

  if (processing.length > 0) {
    console.log("\nCurrently processing:", processing[0].fileName);
  }
}

main().catch(console.error);

