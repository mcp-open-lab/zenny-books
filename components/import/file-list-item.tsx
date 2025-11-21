"use client";

import { File, Image, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FileWithPreview } from "@/components/import/file-upload-zone";

interface FileListItemProps {
  file: FileWithPreview;
  onRemove: () => void;
  status?: "pending" | "uploading" | "uploaded" | "error";
  uploadProgress?: number;
}

export function FileListItem({
  file,
  onRemove,
  status = "pending",
  uploadProgress,
}: FileListItemProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (file.type.startsWith("image/")) {
      return <Image className="h-4 w-4" />;
    }
    if (file.type === "application/pdf") {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    switch (status) {
      case "uploading":
        return "border-primary";
      case "uploaded":
        return "border-green-500";
      case "error":
        return "border-destructive";
      default:
        return "border-muted";
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card",
        getStatusColor()
      )}
    >
      {file.preview && file.type.startsWith("image/") ? (
        <img
          src={file.preview}
          alt={file.name}
          className="h-10 w-10 rounded object-cover"
        />
      ) : (
        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
          {getFileIcon()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(file.size)}</span>
          {status === "uploading" && uploadProgress !== undefined && (
            <>
              <span>•</span>
              <span>{uploadProgress}%</span>
            </>
          )}
          {status === "uploaded" && (
            <>
              <span>•</span>
              <span className="text-green-600">Uploaded</span>
            </>
          )}
          {status === "error" && (
            <>
              <span>•</span>
              <span className="text-destructive">Error</span>
            </>
          )}
        </div>
      </div>

      {status !== "uploading" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

