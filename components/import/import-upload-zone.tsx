"use client";

import { useState } from "react";
import { FileUploadZone, type FileWithPreview } from "@/components/import/file-upload-zone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { future_genUploader } from "uploadthing/client-future";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { batchImport } from "@/app/actions/batch-import";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

type ImportType = "receipts" | "bank_statements" | "invoices" | "mixed";
type SourceFormat = "pdf" | "csv" | "xlsx" | "images";

export function ImportUploadZone() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [importType, setImportType] = useState<ImportType>("receipts");
  const [sourceFormat, setSourceFormat] = useState<SourceFormat | undefined>(
    undefined
  );
  const [isUploading, setIsUploading] = useState(false);
  const [batchCreated, setBatchCreated] = useState(false);
  const [itemsCount, setItemsCount] = useState(0);

  const handleFilesChange = (newFiles: FileWithPreview[]) => {
    setFiles(newFiles);
    setBatchCreated(false);
  };

  const handleStartImport = async () => {
    if (files.length === 0) {
      toast.error("Please select files to import");
      return;
    }

    setIsUploading(true);
    setBatchCreated(false);

    try {
      toast.info(`Uploading ${files.length} files...`);

      // Step 1: Upload files to UploadThing
      const uploader = future_genUploader<OurFileRouter>({
        url: "/api/uploadthing",
      });

      const uploadedFiles = await uploader.uploadFiles("batchUploader", {
        files: files.map((f) => f as File),
        onEvent: () => {
          // Progress tracking handled by UploadThing internally
        },
      });

      const successfulUploads = uploadedFiles.filter(
        (f) => f.status === "uploaded"
      );

      if (successfulUploads.length === 0) {
        throw new Error("No files uploaded successfully");
      }

      // Step 2: Create batch and enqueue jobs
      const result = await batchImport({
        importType,
        sourceFormat,
        files: successfulUploads.map((file) => ({
          fileName: file.name,
          fileUrl: file.url,
          fileSizeBytes: file.size,
        })),
      });

      if (!result.success || !result.batchId) {
        throw new Error("Failed to create batch");
      }

      setBatchCreated(true);
      setItemsCount(result.itemsCreated || successfulUploads.length);
      setFiles([]);

      toast.success(
        `Batch created! ${result.itemsCreated} files will be processed in the background.`
      );

      router.refresh();
    } catch (error) {
      console.error("Batch import error:", error);
      toast.error(
        `Import failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewJobs = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "jobs");
    router.push(`/app/import?${params.toString()}`);
  };

  const getAcceptedTypes = (): string[] => {
    if (sourceFormat === "pdf") return ["application/pdf"];
    if (sourceFormat === "csv") return ["text/csv", "application/vnd.ms-excel"];
    if (sourceFormat === "xlsx")
      return [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
    return ["image/*", "application/pdf"]; // Default: images and PDFs
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Settings</CardTitle>
          <CardDescription>
            Configure your import type and file format before selecting files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-type">Import Type</Label>
            <Select
              value={importType}
              onValueChange={(value) => setImportType(value as ImportType)}
            >
              <SelectTrigger id="import-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receipts">Receipts</SelectItem>
                <SelectItem value="bank_statements">Bank Statements</SelectItem>
                <SelectItem value="invoices">Invoices</SelectItem>
                <SelectItem value="mixed">Mixed Documents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-format">Source Format (Optional)</Label>
            <Select
              value={sourceFormat || "auto"}
              onValueChange={(value) =>
                setSourceFormat(
                  value === "auto" ? undefined : (value as SourceFormat)
                )
              }
            >
              <SelectTrigger id="source-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="images">Images (JPG, PNG, etc.)</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Files</CardTitle>
          <CardDescription>
            Drag and drop files or click to browse. Up to 50 files, 16MB each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            onFilesChange={handleFilesChange}
            maxFiles={50}
            maxSizeBytes={16 * 1024 * 1024}
            acceptedTypes={getAcceptedTypes()}
          />
        </CardContent>
      </Card>

      {batchCreated && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Batch created successfully!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {itemsCount} file{itemsCount !== 1 ? "s" : ""} have been
                  queued for processing. You can track the progress in the View
                  Jobs tab.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewJobs}
                  className="mt-2"
                >
                  View Jobs
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {files.length > 0 && !batchCreated && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to Import</CardTitle>
            <CardDescription>
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleStartImport}
                disabled={isUploading || files.length === 0}
              >
                {isUploading
                  ? "Uploading..."
                  : `Start Import (${files.length} file${
                      files.length !== 1 ? "s" : ""
                    })`}
              </Button>
              {!isUploading && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFiles([]);
                    setBatchCreated(false);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
