"use client";

import { useState, useEffect } from "react";
import {
  getBatchItems,
  getBatchProgressAction,
  retryBatchItem,
  retryAllFailedItems,
} from "@/lib/modules/import/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { BatchItemStatus } from "@/lib/import/batch-types";

interface BatchSummaryProps {
  batchId: string;
  onClose?: () => void;
}

export function BatchSummary({ batchId, onClose }: BatchSummaryProps) {
  const [items, setItems] = useState<BatchItemStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingItemId, setRetryingItemId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    successful: number;
    failed: number;
    duplicates: number;
    percentage: number;
  } | null>(null);

  const loadBatchData = async () => {
    try {
      setLoading(true);
      const [itemsResult, progressResult] = await Promise.all([
        getBatchItems({ batchId }),
        getBatchProgressAction({ batchId }),
      ]);

      if (itemsResult.success) {
        setItems(itemsResult.items);
      }

      if (progressResult.success && progressResult.progress) {
        setProgress({
          total: progressResult.progress.total,
          successful: progressResult.progress.successful,
          failed: progressResult.progress.failed,
          duplicates: progressResult.progress.duplicates,
          percentage: progressResult.progress.percentage,
        });
      }
    } catch (error) {
      toast.error("Failed to load batch details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatchData();
    
    let interval: NodeJS.Timeout | null = null;
    
    interval = setInterval(async () => {
      const [itemsResult, progressResult] = await Promise.all([
        getBatchItems({ batchId }),
        getBatchProgressAction({ batchId }),
      ]);

      if (itemsResult.success) {
        setItems(itemsResult.items);
      }

      if (progressResult.success && progressResult.progress) {
        setProgress({
          total: progressResult.progress.total,
          successful: progressResult.progress.successful,
          failed: progressResult.progress.failed,
          duplicates: progressResult.progress.duplicates,
          percentage: progressResult.progress.percentage,
        });

        if (progressResult.progress.isComplete && interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    }, 3000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [batchId]);

  const failedItems = items.filter((item) => item.status === "failed");
  const successfulItems = items.filter((item) => item.status === "completed");
  const duplicateItems = items.filter((item) => item.status === "duplicate");

  const handleRetryItem = async (itemId: string) => {
    try {
      setRetryingItemId(itemId);
      const result = await retryBatchItem({ itemId });

      if (result.success) {
        toast.success("Item queued for retry");
        await loadBatchData();
      } else {
        toast.error("Failed to retry item");
      }
    } catch (error) {
      toast.error("Failed to retry item");
    } finally {
      setRetryingItemId(null);
    }
  };

  const handleRetryAll = async () => {
    if (failedItems.length === 0) return;

    try {
      setRetryingAll(true);
      const result = await retryAllFailedItems({ batchId });

      if (result.success) {
        toast.success(`Queued ${result.retriedCount} items for retry`);
        await loadBatchData();
      } else {
        const errorMsg = result.errors && result.errors.length > 0
          ? result.errors[0]
          : "Failed to retry items";
        toast.error(errorMsg);
      }
    } catch (error) {
      toast.error("Failed to retry items");
    } finally {
      setRetryingAll(false);
    }
  };

  if (loading && !progress) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle>Batch Summary</CardTitle>
            <CardDescription>
              {progress.total} file{progress.total !== 1 ? "s" : ""} processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Successful</div>
                <div className="flex items-center gap-2 text-2xl font-bold text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  {progress.successful}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Failed</div>
                <div className="flex items-center gap-2 text-2xl font-bold text-destructive">
                  <XCircle className="h-5 w-5" />
                  {progress.failed}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Duplicates</div>
                <div className="flex items-center gap-2 text-2xl font-bold text-yellow-600">
                  <AlertCircle className="h-5 w-5" />
                  {progress.duplicates}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Progress</div>
                <div className="text-2xl font-bold">{progress.percentage}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {failedItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Failed Items</CardTitle>
                <CardDescription>
                  {failedItems.length} file{failedItems.length !== 1 ? "s" : ""} failed to
                  process
                </CardDescription>
              </div>
              <Button
                onClick={handleRetryAll}
                disabled={retryingAll}
                size="sm"
                variant="outline"
              >
                {retryingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry All
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failedItems.map((item) => (
                <Alert key={item.id} variant="destructive">
                  <AlertDescription>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">{item.fileName}</span>
                          {item.retryCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Retried {item.retryCount} time{item.retryCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {item.errorMessage && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.errorMessage}
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => handleRetryItem(item.id)}
                        disabled={retryingItemId === item.id}
                        size="sm"
                        variant="outline"
                        className="ml-4"
                      >
                        {retryingItemId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Retry
                          </>
                        )}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {successfulItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Successful Items</CardTitle>
            <CardDescription>
              {successfulItems.length} file{successfulItems.length !== 1 ? "s" : ""} processed
              successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {successfulItems.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-sm py-1 text-muted-foreground"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>{item.fileName}</span>
                </div>
              ))}
              {successfulItems.length > 10 && (
                <div className="text-sm text-muted-foreground pt-2">
                  +{successfulItems.length - 10} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {duplicateItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Duplicate Items</CardTitle>
            <CardDescription>
              {duplicateItems.length} duplicate{duplicateItems.length !== 1 ? "s" : ""} detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {duplicateItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-sm py-1 text-muted-foreground"
                >
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span>{item.fileName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {onClose && (
        <div className="flex justify-end">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

