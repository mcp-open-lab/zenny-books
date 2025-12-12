"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getBatchItems,
  getBatchProgressAction,
} from "@/app/actions/import-batch";
import type {
  BatchStatusSummary,
  BatchItemStatus,
} from "@/lib/import/batch-types";

interface UseBatchPollingProps {
  initialBatch: BatchStatusSummary;
  initialItems: BatchItemStatus[];
  pollInterval?: number;
}

export function useBatchPolling({
  initialBatch,
  initialItems,
  pollInterval = 3000,
}: UseBatchPollingProps) {
  const [batch, setBatch] = useState<BatchStatusSummary>(initialBatch);
  const [items, setItems] = useState<BatchItemStatus[]>(initialItems);
  const [isPolling, setIsPolling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [itemsResult, progressResult] = await Promise.all([
        getBatchItems({ batchId: batch.batchId }),
        getBatchProgressAction({ batchId: batch.batchId }),
      ]);

      if (itemsResult.success) {
        setItems(itemsResult.items);
      }

      if (progressResult.success && progressResult.progress) {
        const progress = progressResult.progress;
        setBatch((prev) => ({
          ...prev,
          successfulFiles: progress.successful,
          failedFiles: progress.failed,
          duplicateFiles: progress.duplicates,
          processedFiles: progress.processed,
          completionPercentage: progress.percentage,
          status: progress.isComplete
            ? progress.status === "completed"
              ? "completed"
              : "failed"
            : progress.status === "pending"
            ? "pending"
            : "processing",
        }));
      }
    } catch (error) {
      console.error("Failed to refresh batch data:", error);
    }
  }, [batch.batchId]);

  useEffect(() => {
    const shouldPoll =
      batch.status === "processing" ||
      batch.status === "pending" ||
      items.some(
        (item) => item.status === "processing" || item.status === "pending"
      );

    setIsPolling(shouldPoll);

    if (!shouldPoll) {
      return;
    }

    const intervalId = setInterval(refresh, pollInterval);
    return () => clearInterval(intervalId);
  }, [batch.status, items, pollInterval, refresh]);

  return {
    batch,
    items,
    refresh,
    isPolling,
  };
}
