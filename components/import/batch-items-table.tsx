import type { BatchItemStatus } from "@/lib/import/batch-types";
import {
  Card,
  CardContent,
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
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
} from "lucide-react";

interface BatchItemsTableProps {
  items: BatchItemStatus[];
}

function getStatusBadge(status: string) {
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
}

export function BatchItemsTable({ items }: BatchItemsTableProps) {
  return (
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
  );
}

