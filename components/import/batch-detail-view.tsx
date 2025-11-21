"use client";

import { useState } from "react";
import type {
  BatchStatusSummary,
  BatchItemStatus,
} from "@/lib/import/batch-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
  RefreshCw,
  Download,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { retryBatchItem, retryAllFailedItems } from "@/app/actions/import-batch-items";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BatchDetailViewProps {
  batch: BatchStatusSummary;
  items: BatchItemStatus[];
}

export function BatchDetailView({ batch: initialBatch, items: initialItems }: BatchDetailViewProps) {
  const [batch, setBatch] = useState(initialBatch);
  const [items, setItems] = useState(initialItems);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const router = useRouter();

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
      duplicate: "secondary", // Yellowish
    };

    const icons: Record<string, React.ReactNode> = {
      completed: <CheckCircle2 className="h-3 w-3 mr-1" />,
      processing: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      pending: <Clock className="h-3 w-3 mr-1" />,
      failed: <XCircle className="h-3 w-3 mr-1" />,
      duplicate: <AlertCircle className="h-3 w-3 mr-1" />,
    };

    // Custom style for duplicate
    const className = status === "duplicate" 
      ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 border-yellow-200" 
      : "gap-1";

    return (
      <Badge variant={variants[status] || "outline"} className={className}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleRetryItem = async (itemId: string) => {
    try {
      setIsRetrying(itemId);
      const result = await retryBatchItem({ itemId });
      if (result.success) {
        toast.success("Item queued for retry");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to retry item");
      }
    } catch (error) {
      toast.error("Failed to retry item");
    } finally {
      setIsRetrying(null);
    }
  };

  const handleRetryAll = async () => {
    try {
      setIsRetryingAll(true);
      const result = await retryAllFailedItems({ batchId: batch.batchId });
      if (result.success) {
        toast.success(`Queued ${result.retriedCount} items for retry`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to retry items");
      }
    } catch (error) {
      toast.error("Failed to retry items");
    } finally {
      setIsRetryingAll(false);
    }
  };

  const failedCount = items.filter((i) => i.status === "failed").length;

  return (
    <div className="space-y-6">
      {/* Batch Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">
                Batch {batch.batchId.slice(-8)}
              </CardTitle>
              <CardDescription>
                Created {formatDistanceToNow(batch.createdAt, { addSuffix: true })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {failedCount > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRetryAll}
                  disabled={isRetryingAll}
                >
                  {isRetryingAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Retry Failed
                </Button>
              )}
              {/* Placeholder for Download Report */}
              {/* <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Report
              </Button> */}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Successful</div>
                <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  {batch.successfulFiles}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Failed</div>
                <div className="text-2xl font-bold text-destructive flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  {batch.failedFiles}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Duplicates</div>
                <div className="text-2xl font-bold text-yellow-600 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  {batch.duplicateFiles}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {batch.totalFiles}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{batch.completionPercentage}%</span>
              </div>
              <Progress value={batch.completionPercentage} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {item.fileName}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.errorMessage || (
                      item.status === "duplicate" ? "Duplicate detected" : "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetryItem(item.id)}
                        disabled={isRetrying === item.id}
                      >
                        {isRetrying === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="sr-only">Retry</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

