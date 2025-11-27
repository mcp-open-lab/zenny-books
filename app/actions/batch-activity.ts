"use server";

import { db } from "@/lib/db";
import { batchActivityLogs, importBatches } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createAuthenticatedAction } from "@/lib/safe-action";

export interface BatchActivityLog {
  id: string;
  batchId: string;
  batchItemId: string | null;
  activityType: string;
  message: string;
  details: Record<string, any> | null;
  fileName: string | null;
  duration: number | null;
  createdAt: Date;
}

export const getBatchActivityLogs = createAuthenticatedAction(
  "getBatchActivityLogs",
  async (userId, batchId: string): Promise<BatchActivityLog[]> => {
    try {
      const batch = await db
        .select()
        .from(importBatches)
        .where(
          and(eq(importBatches.id, batchId), eq(importBatches.userId, userId))
        )
        .limit(1);

      if (batch.length === 0) {
        return [];
      }

      const logs = await db
        .select()
        .from(batchActivityLogs)
        .where(eq(batchActivityLogs.batchId, batchId))
        .orderBy(desc(batchActivityLogs.createdAt))
        .limit(100);

      return logs.map((log) => ({
        id: log.id,
        batchId: log.batchId,
        batchItemId: log.batchItemId,
        activityType: log.activityType,
        message: log.message,
        details: log.details ? JSON.parse(log.details) : null,
        fileName: log.fileName,
        duration: log.duration,
        createdAt: log.createdAt,
      }));
    } catch (error) {
      console.error("[Activity Log] Error fetching logs:", error);
      return [];
    }
  }
);

