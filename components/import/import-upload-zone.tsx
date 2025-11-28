"use client";

import { useState, useEffect } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { future_genUploader } from "uploadthing/client-future";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { batchImport } from "@/app/actions/batch-import";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Settings2 } from "lucide-react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { ALLOWED_MIME_TYPES } from "@/lib/constants";

type ImportType = "receipts" | "bank_statements" | "mixed";

type Business = {
  id: string;
  name: string;
};

function validateFilesForImportType(
  files: FileWithPreview[],
  importType: ImportType
): string | null {
  const getFileExtension = (file: File): string => {
    return file.name.split(".").pop()?.toLowerCase() || "";
  };

  const spreadsheetExtensions = ["csv", "xlsx", "xls"];
  const imageExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"];
  const pdfExtension = "pdf";

  for (const file of files) {
    const ext = getFileExtension(file);

    if (importType === "receipts") {
      // Receipts: only images and PDFs
      if (!imageExtensions.includes(ext) && ext !== pdfExtension) {
        return `File "${file.name}" is not supported for Receipts. Please use images (JPG, PNG, HEIC, etc.) or PDF files. For spreadsheets, select "Bank Statements" import type.`;
      }
    } else if (importType === "bank_statements") {
      // Bank statements: spreadsheets (CSV, XLSX, XLS) and PDFs
      if (!spreadsheetExtensions.includes(ext) && ext !== pdfExtension) {
        return `File "${file.name}" is not supported for Bank Statements. Please use CSV, Excel (XLSX/XLS), or PDF files.`;
      }
    }
    // Mixed: allow all types
  }

  return null;
}

export function ImportUploadZone({
  defaultCurrency = "USD",
}: {
  defaultCurrency?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [importType, setImportType] = useState<ImportType>("receipts");
  const [statementType, setStatementType] = useState<"bank_account" | "credit_card">("bank_account");
  const [currency, setCurrency] = useState<string>(defaultCurrency || "USD");
  const [isUploading, setIsUploading] = useState(false);
  const [batchCreated, setBatchCreated] = useState(false);
  const [itemsCount, setItemsCount] = useState(0);

  // Processing options
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [defaultBusinessId, setDefaultBusinessId] = useState<string | null>(null);
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");

  // Fetch user businesses on mount
  useEffect(() => {
    async function fetchBusinesses() {
      try {
        const { getUserBusinesses } = await import("@/app/actions/businesses");
        const userBusinesses = await getUserBusinesses();
        setBusinesses(userBusinesses);
      } catch (error) {
        console.error("Failed to fetch businesses:", error);
      }
    }
    fetchBusinesses();
  }, []);

  const handleFilesChange = (newFiles: FileWithPreview[]) => {
    setFiles(newFiles);
    setBatchCreated(false);
  };

  const handleStartImport = async () => {
    if (files.length === 0) {
      toast.error("Please select files to import");
      return;
    }

    // Validate file types match import type
    const validationError = validateFilesForImportType(files, importType);
    if (validationError) {
      toast.error(validationError);
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
        statementType: importType === "bank_statements" ? statementType : undefined,
        currency,
        files: successfulUploads.map((file) => ({
          fileName: file.name,
          fileUrl: file.url,
          fileSizeBytes: file.size,
        })),
        defaultBusinessId,
        dateRangeStart: dateRangeStart || undefined,
        dateRangeEnd: dateRangeEnd || undefined,
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
    // Auto-detect from all supported types
    return Object.keys(ALLOWED_MIME_TYPES);
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
                <SelectItem value="mixed">Mixed Documents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {importType === "bank_statements" && (
            <div className="space-y-3 border p-4 rounded-md bg-muted/30">
              <Label className="text-base">Statement Type</Label>
              <RadioGroup
                value={statementType}
                onValueChange={(v) =>
                  setStatementType(v as "bank_account" | "credit_card")
                }
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bank_account" id="bank_account" />
                  <Label htmlFor="bank_account" className="font-normal cursor-pointer">
                    Bank Account (Checking/Savings)
                    <span className="block text-xs text-muted-foreground">
                      Expenses are negative (withdrawals), Income is positive (deposits)
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="credit_card" id="credit_card" />
                  <Label htmlFor="credit_card" className="font-normal cursor-pointer">
                    Credit Card
                    <span className="block text-xs text-muted-foreground">
                      Expenses are positive (purchases), Payments are negative
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <CurrencySelect
              value={currency}
              onValueChange={setCurrency}
              defaultValue={defaultCurrency}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to your profile currency setting
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="processing-options" className="border-none">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Processing Options
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {/* Default Business */}
                <div className="space-y-2">
                  <Label htmlFor="default-business">Default Business (Optional)</Label>
                  <Select
                    value={defaultBusinessId || "personal"}
                    onValueChange={(value) => setDefaultBusinessId(value === "personal" ? null : value)}
                  >
                    <SelectTrigger id="default-business">
                      <SelectValue placeholder="Personal (No Business)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal (No Business)</SelectItem>
                      {businesses.map((business) => (
                        <SelectItem key={business.id} value={business.id}>
                          {business.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Assign all imported transactions to this business by default. Can be changed later.
                  </p>
                </div>

                {/* Date Range Filter (for bank statements) */}
                {importType === "bank_statements" && (
                  <div className="space-y-3 pt-2 border-t">
                    <Label className="text-sm font-medium">Date Range Filter (Optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Only import transactions within this date range
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="date-start" className="text-xs">Start Date</Label>
                        <Input
                          id="date-start"
                          type="date"
                          value={dateRangeStart}
                          onChange={(e) => setDateRangeStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date-end" className="text-xs">End Date</Label>
                        <Input
                          id="date-end"
                          type="date"
                          value={dateRangeEnd}
                          onChange={(e) => setDateRangeEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
