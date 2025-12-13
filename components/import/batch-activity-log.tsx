"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getBatchActivityLogs,
  type BatchActivityLog,
} from "@/lib/modules/import/batch-activity-actions";
import { getBatchProgressAction } from "@/lib/modules/import/actions";
import { formatDistanceToNow } from "date-fns";
import { Activity, Loader2, Brain } from "lucide-react";

interface BatchActivityLogProps {
  batchId: string;
  initialLogs?: BatchActivityLog[];
}

export function BatchActivityLog({
  batchId,
  initialLogs = [],
}: BatchActivityLogProps) {
  const [logs, setLogs] = useState<BatchActivityLog[]>(initialLogs);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for new activity logs every 2 seconds
  useEffect(() => {
    let isMounted = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchLogs = async () => {
      try {
        setIsLoading(true);
        const [newLogs, progressResult] = await Promise.all([
          getBatchActivityLogs(batchId),
          getBatchProgressAction({ batchId }),
        ]);
        
        if (isMounted && newLogs.length > 0) {
          // Only update if we got logs back (don't replace with empty array)
          setLogs(newLogs);
        }

        if (progressResult.success && progressResult.progress?.isComplete && interval) {
          clearInterval(interval);
          interval = null;
        }
      } catch (error) {
        console.error("Failed to fetch activity logs:", error);
        // Keep existing logs on error - don't clear them
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch if no initial logs provided
    if (initialLogs.length === 0) {
      fetchLogs();
    }

    // Poll every 2 seconds for updates
    interval = setInterval(fetchLogs, 2000);

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [batchId, initialLogs.length]);

  const getActivityIcon = (activityType: string) => {
    const icons: Record<string, string> = {
      batch_created: "📦",
      file_uploaded: "📁",
      ai_extraction_start: "🤖",
      ai_extraction_complete: "✅",
      categorization_start: "🧠",
      categorization_complete: "🏷️",
      duplicate_detected: "⚠️",
      item_completed: "✅",
      item_failed: "❌",
      batch_completed: "🎉",
    };
    return icons[activityType] || "•";
  };

  const isAiActivity = (activityType: string) => {
    return [
      "ai_extraction_start",
      "ai_extraction_complete",
      "categorization_start",
      "categorization_complete",
    ].includes(activityType);
  };

  const cleanMessage = (message: string) => {
    // Remove ALL emojis from message (they're shown as icons on the left)
    // This regex matches emoji ranges including:
    // - Emoticons (😀-🙏)
    // - Symbols & Pictographs (🌀-🗿)
    // - Transport & Map (🚀-🛿)
    // - Flags (🏁-🏿)
    // - And other emoji ranges
    let cleaned = message.replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      ""
    );
    // Remove "(ai)" text - will be shown as brain icon instead
    cleaned = cleaned.replace(/\s*\(ai\)/gi, "");
    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, " ");
    return cleaned.trim();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>Activity Log</CardTitle>
          </div>
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">Real-time AI processing</p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => (
                <div
                  key={log.id}
                  className={`flex gap-3 p-3 rounded-lg border transition-all ${
                    index === 0 && logs.length > 1
                      ? "bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex-shrink-0 text-2xl leading-none">
                    {getActivityIcon(log.activityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed break-words">
                      {cleanMessage(log.message)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        {formatDistanceToNow(new Date(log.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {log.duration && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(log.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isAiActivity(log.activityType) && (
                    <div className="flex-shrink-0">
                      <Brain className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
