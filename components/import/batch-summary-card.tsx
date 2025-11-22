import type { BatchStatusSummary } from "@/lib/import/batch-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BatchSummaryCardProps {
  batch: BatchStatusSummary;
}

export function BatchSummaryCard({ batch }: BatchSummaryCardProps) {
  return (
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
  );
}

