"use client";

import { useCallback, useState, useRef } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileListItem } from "@/components/import/file-list-item";

export interface FileWithPreview extends File {
  id: string;
  preview?: string;
}

interface FileUploadZoneProps {
  onFilesChange: (files: FileWithPreview[]) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizeBytes?: number;
}

export function FileUploadZone({
  onFilesChange,
  acceptedTypes = ["image/*", "application/pdf"],
  maxFiles = 50,
  maxSizeBytes = 16 * 1024 * 1024,
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `File ${file.name} exceeds maximum size of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`;
    }
    return null;
  };

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: FileWithPreview[] = [];
      const errors: string[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
          return;
        }

        if (files.length + validFiles.length >= maxFiles) {
          errors.push(`Maximum ${maxFiles} files allowed`);
          return;
        }

        const fileWithId = Object.assign(file, {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
        }) as FileWithPreview;

        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              fileWithId.preview = e.target.result as string;
              setFiles((prev) =>
                prev.map((f) => (f.id === fileWithId.id ? fileWithId : f))
              );
            }
          };
          reader.readAsDataURL(file);
        }

        validFiles.push(fileWithId);
      });

      if (errors.length > 0) {
        console.warn("File validation errors:", errors);
      }

      if (validFiles.length > 0) {
        const updatedFiles = [...files, ...validFiles];
        setFiles(updatedFiles);
        onFilesChange(updatedFiles);
      }
    },
    [files, maxFiles, maxSizeBytes, onFilesChange]
  );

  const removeFile = useCallback(
    (fileId: string) => {
      const updatedFiles = files.filter((f) => f.id !== fileId);
      setFiles(updatedFiles);
      onFilesChange(updatedFiles);
    },
    [files, onFilesChange]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            addFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={(e) => {
            if (e.target.files) {
              addFiles(e.target.files);
              e.target.value = "";
            }
          }}
          className="hidden"
        />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium mb-1">
          Drag and drop files here, or click to select
        </p>
        <p className="text-xs text-muted-foreground">
          Supports images (JPG, PNG, HEIC, WebP), PDFs, and data files (CSV, Excel) - max {Math.round(maxSizeBytes / 1024 / 1024)}
          MB per file, up to {maxFiles} files
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiles([]);
                onFilesChange([]);
              }}
            >
              Clear all
            </Button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file) => (
              <FileListItem
                key={file.id}
                file={file}
                onRemove={() => removeFile(file.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
