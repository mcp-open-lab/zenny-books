"use client";

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
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useBatchPolling } from "@/hooks/use-batch-polling";

interface BatchDetailViewProps {
  batch: BatchStatusSummary;
  items: BatchItemStatus[];
}

export function BatchDetailView({
  batch: initialBatch,
  items: initialItems,
}: BatchDetailViewProps) {
  const { batch, items } = useBatchPolling({
    initialBatch,
    initialItems,
  });

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
    const className =
      status === "duplicate"
        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 border-yellow-200"
        : "gap-1";

    return (
      <Badge variant={variants[status] || "outline"} className={className}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

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
                Created{" "}
                {formatDistanceToNow(batch.createdAt, { addSuffix: true })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {/* Actions removed for simplicity */}
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
                    {item.errorMessage ||
                      (item.status === "duplicate"
                        ? "Duplicate detected"
                        : "-")}
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
