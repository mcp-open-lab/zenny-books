"use client";

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
  ArrowRight,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import type { ImportBatch } from "@/lib/import/batch-types";

interface RecentBatchesProps {
  batches: ImportBatch[];
  onViewAll: () => void;
}

export function RecentBatches({ batches, onViewAll }: RecentBatchesProps) {
  const router = useRouter();

  if (batches.length === 0) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      completed: "default",
      processing: "secondary",
      pending: "outline",
      failed: "destructive",
      duplicate: "secondary",
    };

    const icons: Record<string, React.ReactNode> = {
      completed: <CheckCircle2 className="h-3 w-3 mr-1" />,
      processing: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      pending: <Clock className="h-3 w-3 mr-1" />,
      failed: <XCircle className="h-3 w-3 mr-1" />,
      duplicate: <AlertCircle className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge variant={variants[status] || "outline"} className="gap-1 text-xs">
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle>Recent Imports</CardTitle>
          <CardDescription>Your latest batch processing tasks</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View All <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Files</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.slice(0, 5).map((batch) => (
              <TableRow
                key={batch.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/app/import/batches/${batch.id}`)}
              >
                <TableCell>{getStatusBadge(batch.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {Math.min(batch.processedFiles, batch.totalFiles)}/
                      {batch.totalFiles}
                    </span>
                    <span className="text-muted-foreground">files</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDistanceToNow(batch.createdAt, { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
