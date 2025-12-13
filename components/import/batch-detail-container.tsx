"use client";

import { useBatchPolling } from "@/lib/hooks/use-batch-polling";
import { BatchSummaryCard } from "./batch-summary-card";
import { BatchItemsTable } from "./batch-items-table";
import { BatchActivityLog } from "./batch-activity-log";
import type {
  BatchStatusSummary,
  BatchItemStatus,
} from "@/lib/import/batch-types";
import type { BatchActivityLog as BatchActivityLogType } from "@/lib/modules/import/batch-activity-actions";

interface BatchDetailContainerProps {
  initialBatch: BatchStatusSummary;
  initialItems: BatchItemStatus[];
  initialActivityLogs?: BatchActivityLogType[];
}

export function BatchDetailContainer({
  initialBatch,
  initialItems,
  initialActivityLogs = [],
}: BatchDetailContainerProps) {
  const { batch, items } = useBatchPolling({
    initialBatch,
    initialItems,
  });

  return (
    <div className="space-y-6">
      <BatchSummaryCard batch={batch} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BatchItemsTable items={items} />
        <BatchActivityLog
          batchId={batch.batchId}
          initialLogs={initialActivityLogs}
        />
      </div>
    </div>
  );
}
