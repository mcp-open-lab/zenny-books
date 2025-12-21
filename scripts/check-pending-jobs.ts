#!/usr/bin/env tsx
/**
 * Check pending batch items and manually trigger Inngest events if needed
 */

import { db } from "@/lib/db";
import { importBatchItems, importBatches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";
import type { ImportJobPayload } from "@/lib/import/queue-types";

function getFileFormatFromName(
  fileName: string
): ImportJobPayload["fileFormat"] {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const formatMap: Record<string, ImportJobPayload["fileFormat"]> = {
    pdf: "pdf",
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    gif: "gif",
    heic: "heic",
    heif: "heif",
    csv: "csv",
    xlsx: "xlsx",
    xls: "xls",
  };
  return formatMap[ext] || "jpg";
}

async function main() {
  console.log("Checking for pending batch items...\n");

  // Get all pending batch items
  const pendingItems = await db
    .select({
      id: importBatchItems.id,
      batchId: importBatchItems.batchId,
      fileName: importBatchItems.fileName,
      fileUrl: importBatchItems.fileUrl,
      status: importBatchItems.status,
      createdAt: importBatchItems.createdAt,
      batch: {
        userId: importBatches.userId,
        importType: importBatches.importType,
        sourceFormat: importBatches.sourceFormat,
      },
    })
    .from(importBatchItems)
    .innerJoin(importBatches, eq(importBatchItems.batchId, importBatches.id))
    .where(eq(importBatchItems.status, "pending"))
    .orderBy(importBatchItems.createdAt);

  if (pendingItems.length === 0) {
    console.log("✓ No pending batch items found.");
    return;
  }

  console.log(`Found ${pendingItems.length} pending batch item(s):\n`);

  for (const item of pendingItems) {
    console.log(`- ${item.fileName} (${item.id})`);
    console.log(`  Batch: ${item.batchId}`);
    console.log(`  Created: ${item.createdAt}`);
    console.log(`  Status: ${item.status}`);
    console.log("");

    // Check if we should manually trigger
    const ageMinutes = (Date.now() - new Date(item.createdAt).getTime()) / 1000 / 60;
    if (ageMinutes > 1) {
      console.log(`  ⚠ Item is ${ageMinutes.toFixed(1)} minutes old - manually triggering...`);

      if (!item.fileUrl) {
        console.log(`  ✗ Cannot trigger: missing fileUrl`);
        continue;
      }

      const payload: ImportJobPayload = {
        batchId: item.batchId,
        batchItemId: item.id,
        fileUrl: item.fileUrl,
        fileName: item.fileName,
        fileFormat: getFileFormatFromName(item.fileName),
        userId: item.batch.userId,
        importType: item.batch.importType as ImportJobPayload["importType"],
        sourceFormat: item.batch.sourceFormat as ImportJobPayload["sourceFormat"],
        order: 0,
      };

      try {
        const result = await inngest.send({
          name: "import/process.item",
          data: payload,
        });

        const eventId = Array.isArray(result)
          ? result[0]?.ids?.[0]
          : result.ids?.[0];

        console.log(`  ✓ Event sent successfully (eventId: ${eventId || "unknown"})`);
      } catch (error) {
        console.error(`  ✗ Failed to send event:`, error);
      }
    }
  }
}

main().catch(console.error);

