"use client";

import { useState, useEffect } from "react";
import {
  listBatchesAction,
  getBatchProgressAction,
} from "@/lib/modules/import/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ImportBatch } from "@/lib/import/batch-types";
import type { BatchStatus } from "@/lib/constants";
import { useRouter } from "next/navigation";

interface BatchesListProps {
  initialBatches: ImportBatch[];
  initialCursor: string | null;
  initialHasMore: boolean;
}

export function BatchesList({
  initialBatches,
  initialCursor,
  initialHasMore,
}: BatchesListProps) {
  const [batches, setBatches] = useState<ImportBatch[]>(initialBatches);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [statusFilter, setStatusFilter] = useState<"all" | BatchStatus>("all");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [activeBatchIds, setActiveBatchIds] = useState<Set<string>>(
    new Set(
      initialBatches
        .filter((b) => b.status === "processing" || b.status === "pending")
        .map((b) => b.id)
    )
  );

  // Sync with server updates (e.g. after router.refresh())
  useEffect(() => {
    setBatches(initialBatches);
    setCursor(initialCursor);
    setHasMore(initialHasMore);

    setActiveBatchIds((prev) => {
      const next = new Set(prev);
      initialBatches.forEach((b) => {
        if (b.status === "processing" || b.status === "pending") {
          next.add(b.id);
        }
      });
      return next;
    });
  }, [initialBatches, initialCursor, initialHasMore]);

  const loadMore = async () => {
    if (!hasMore || loading || !cursor) return;

    setLoading(true);
    try {
      const result = await listBatchesAction({
        limit: 20,
        cursor,
        status: statusFilter === "all" ? undefined : statusFilter,
      });

      if (result.success) {
        setBatches((prev) => [...prev, ...result.batches]);
        setCursor(result.nextCursor);
        setHasMore(result.hasMore ?? false);
      }
    } catch (error) {
      console.error("Error loading more batches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilterChange = async (value: "all" | BatchStatus) => {
    setStatusFilter(value);
    setLoading(true);
    try {
      const result = await listBatchesAction({
        limit: 20,
        status: value === "all" ? undefined : value,
      });

      if (result.success) {
        setBatches(result.batches);
        setCursor(result.nextCursor);
        setHasMore(result.hasMore ?? false);
      }
    } catch (error) {
      console.error("Error filtering batches:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBatchIds.size === 0) return;

    const pollInterval = setInterval(async () => {
      const updates = await Promise.all(
        Array.from(activeBatchIds).map(async (batchId) => {
          try {
            const result = await getBatchProgressAction({ batchId });
            return result.success && result.progress
              ? { batchId, progress: result.progress }
              : null;
          } catch {
            return null;
          }
        })
      );

      setBatches((prev) =>
        prev.map((batch) => {
          const update = updates.find((u) => u?.batchId === batch.id);
          if (!update) return batch;

          const { progress } = update;
          const newStatus =
            progress.isComplete && progress.status === "completed"
              ? "completed"
              : progress.isComplete && progress.status === "failed"
              ? "failed"
              : progress.status === "pending"
              ? "pending"
              : "processing";

          return {
            ...batch,
            status: newStatus,
            processedFiles: progress.processed,
            successfulFiles: progress.successful,
            failedFiles: progress.failed,
            duplicateFiles: progress.duplicates,
            updatedAt: new Date(),
          };
        })
      );

      setActiveBatchIds((prev) => {
        const newSet = new Set(prev);
        updates.forEach((update) => {
          if (update && update.progress.isComplete) {
            newSet.delete(update.batchId);
          }
        });
        return newSet;
      });
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [activeBatchIds]);

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
      cancelled: "outline",
    };

    const icons: Record<string, React.ReactNode> = {
      completed: <CheckCircle2 className="h-3 w-3 mr-1" />,
      processing: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      pending: <Clock className="h-3 w-3 mr-1" />,
      failed: <XCircle className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge variant={variants[status] || "outline"} className="gap-1">
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCompletionPercentage = (batch: ImportBatch) => {
    if (batch.totalFiles === 0) return 0;
    // Cap processedFiles at totalFiles to prevent display issues from retries
    const processed = Math.min(batch.processedFiles, batch.totalFiles);
    return Math.round((processed / batch.totalFiles) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No batches found. Start by importing some files!
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow
                    key={batch.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(`/app/import/batches/${batch.id}`)
                    }
                  >
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {batch.importType.replace("_", " ")}
                        </div>
                        {batch.sourceFormat ? <div className="text-xs text-muted-foreground">
                            {batch.sourceFormat.toUpperCase()}
                          </div> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-[200px]">
                        <Progress
                          value={getCompletionPercentage(batch)}
                          className="h-2"
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {Math.min(batch.processedFiles, batch.totalFiles)}/
                            {batch.totalFiles}
                          </span>
                          {batch.successfulFiles > 0 && (
                            <span className="text-green-600">
                              {batch.successfulFiles} ✓
                            </span>
                          )}
                          {batch.failedFiles > 0 && (
                            <span className="text-destructive">
                              {batch.failedFiles} ✗
                            </span>
                          )}
                          {batch.duplicateFiles > 0 && (
                            <span className="text-yellow-600">
                              {batch.duplicateFiles} ⊘
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {batch.totalFiles} file
                        {batch.totalFiles !== 1 ? "s" : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(batch.createdAt, {
                          addSuffix: true,
                        })}
                      </div>
                      {batch.completedAt ? <div className="text-xs text-muted-foreground">
                          Completed{" "}
                          {formatDistanceToNow(batch.completedAt, {
                            addSuffix: true,
                          })}
                        </div> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore ? <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div> : null}
        </>
      )}
    </div>
  );
}
