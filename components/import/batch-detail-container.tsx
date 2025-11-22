"use client";

import { useBatchPolling } from "@/hooks/use-batch-polling";
import { BatchSummaryCard } from "./batch-summary-card";
import { BatchItemsTable } from "./batch-items-table";
import type {
  BatchStatusSummary,
  BatchItemStatus,
} from "@/lib/import/batch-types";

interface BatchDetailContainerProps {
  initialBatch: BatchStatusSummary;
  initialItems: BatchItemStatus[];
}

export function BatchDetailContainer({
  initialBatch,
  initialItems,
}: BatchDetailContainerProps) {
  const { batch, items } = useBatchPolling({
    initialBatch,
    initialItems,
  });

  return (
    <div className="space-y-6">
      <BatchSummaryCard batch={batch} />
      <BatchItemsTable items={items} />
    </div>
  );
}

