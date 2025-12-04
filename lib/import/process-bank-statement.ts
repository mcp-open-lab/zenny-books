/**
 * Process bank statements (CSV, XLSX, XLS, PDF)
 * Uses class-based processors for clean separation of bank vs credit card logic
 */

import { db } from "@/lib/db";
import {
  documents,
  bankStatements,
  bankStatementTransactions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { importSpreadsheet, isSpreadsheetFile } from "./import-orchestrator";
import { devLogger } from "@/lib/dev-logger";
import { createId } from "@paralleldrive/cuid2";
import { BankAccountProcessor } from "./processors/bank-account-processor";
import { CreditCardProcessor } from "./processors/credit-card-processor";
import type { BaseStatementProcessor } from "./processors/base-statement-processor";
import { getFileFormatFromUrl } from "@/lib/constants";
import {
  extractPdfText,
  parseTransactionsFromPdf,
  isScannedPdf,
} from "./pdf-table-extractor";
import type { NormalizedTransaction } from "./spreadsheet-parser";

/**
 * Download file buffer from URL
 */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Check if file is a PDF
 */
function isPdfFile(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension === "pdf";
}

/**
 * Check if file is a supported bank statement format
 */
function isSupportedStatementFile(fileName: string): boolean {
  return isSpreadsheetFile(fileName) || isPdfFile(fileName);
}

/**
 * Import PDF bank statement using table extraction
 */
async function importPdfStatement(
  fileBuffer: Buffer,
  fileName: string
): Promise<{
  success: boolean;
  transactions: NormalizedTransaction[];
  error?: string;
  metadata?: {
    totalRows: number;
    validRows: number;
    isScanned: boolean;
    pageCount: number;
  };
}> {
  try {
    devLogger.info("Starting PDF statement import", { fileName });

    // Extract text from PDF
    const pdfResult = await extractPdfText(fileBuffer);

    if (isScannedPdf(pdfResult)) {
      return {
        success: false,
        transactions: [],
        error:
          "This PDF appears to be scanned. Please use a digital/native PDF statement.",
      };
    }

    // Parse into NormalizedTransaction[] using LLM
    const transactions = await parseTransactionsFromPdf(pdfResult);

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        error:
          "No transactions found in PDF. The statement format may not be supported.",
      };
    }

    // Filter valid transactions
    const validTransactions = transactions.filter((tx) => {
      const hasDate =
        tx.transactionDate !== null && tx.transactionDate !== undefined;
      const hasAmount = tx.amount !== null && tx.amount !== undefined;
      return hasDate && hasAmount;
    });

    devLogger.info("PDF statement parsed", {
      fileName,
      totalTransactions: transactions.length,
      validTransactions: validTransactions.length,
      pageCount: pdfResult.metadata.pageCount,
    });

    return {
      success: true,
      transactions: validTransactions,
      metadata: {
        totalRows: transactions.length,
        validRows: validTransactions.length,
        isScanned: false,
        pageCount: pdfResult.metadata.pageCount,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    devLogger.error("PDF statement import failed", {
      fileName,
      error: errorMessage,
    });

    return {
      success: false,
      transactions: [],
      error: `PDF import failed: ${errorMessage}`,
    };
  }
}

/**
 * Process a bank statement file and create database records
 */
export async function processBankStatement(
  fileUrl: string,
  fileName: string,
  batchId: string,
  userId: string,
  defaultCurrency?: string,
  statementType?: "bank_account" | "credit_card"
): Promise<{ documentId: string; transactionCount: number }> {
  devLogger.info("Processing bank statement", {
    fileName,
    fileUrl: fileUrl.substring(0, 50) + "...",
    batchId,
    userId,
  });

  // Validate file type
  if (!isSupportedStatementFile(fileName)) {
    throw new Error(
      `Unsupported file type. Bank statements must be CSV, XLSX, XLS, or PDF files.`
    );
  }

  // Download file
  const fileBuffer = await downloadFile(fileUrl);
  const fileFormat = getFileFormatFromUrl(fileUrl);
  const isPdf = isPdfFile(fileName);

  // Calculate file hash for duplicate detection
  const { calculateFileHash } = await import("@/lib/utils/file-hash");
  const fileHash = await calculateFileHash(fileUrl);

  // Check for duplicate file (same hash + same user)
  const existingDocument = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.fileHash, fileHash)))
    .limit(1);

  if (existingDocument.length > 0) {
    throw new Error(
      `Duplicate file detected. This file has already been uploaded (${
        existingDocument[0].fileName || "previous upload"
      })`
    );
  }

  // Create document record
  const documentId = createId();
  await db.insert(documents).values({
    id: documentId,
    userId,
    documentType: "bank_statement",
    fileFormat,
    fileName,
    fileUrl,
    fileHash,
    fileSizeBytes: fileBuffer.length,
    status: "processing",
    importBatchId: batchId,
    extractionMethod: isPdf ? "pdf_table_extraction" : "excel_parser",
  });

  try {
    // Import using appropriate method based on file type
    let transactions: NormalizedTransaction[];
    let detectedCurrency: string | undefined;
    let confidence: number | undefined;

    if (isPdf) {
      // PDF: Use table extraction
      const pdfResult = await importPdfStatement(fileBuffer, fileName);

      if (!pdfResult.success || pdfResult.transactions.length === 0) {
        throw new Error(pdfResult.error || "No transactions found in PDF");
      }

      transactions = pdfResult.transactions;
      // PDF doesn't detect currency, use default
      detectedCurrency = undefined;
      confidence = undefined;

      devLogger.info("PDF statement parsed successfully", {
        documentId,
        transactionCount: transactions.length,
        pageCount: pdfResult.metadata?.pageCount,
      });
    } else {
      // Spreadsheet: Use AI orchestrator
    const importResult = await importSpreadsheet(
      fileBuffer, 
      fileName, 
      userId, 
      statementType
    );

    if (!importResult.success || importResult.transactions.length === 0) {
      throw new Error(
        importResult.error || "No transactions found in spreadsheet"
      );
    }

      transactions = importResult.transactions;
      detectedCurrency = importResult.mappingConfig?.currency ?? undefined;
      confidence = importResult.mappingConfig?.confidence;

    devLogger.info("Spreadsheet parsed successfully", {
      documentId,
        transactionCount: transactions.length,
        mappingConfidence: confidence,
        currency: detectedCurrency,
    });
    }

    // Create bank statement record
    const bankStatementId = createId();
    const currency = detectedCurrency || defaultCurrency || "USD";
    await db.insert(bankStatements).values({
      id: bankStatementId,
      documentId,
      currency,
      transactionCount: transactions.length,
      processedTransactionCount: 0,
    });

    // Select appropriate processor based on statement type
    const processor: BaseStatementProcessor = 
      statementType === "credit_card"
        ? new CreditCardProcessor(userId, defaultCurrency || "USD")
        : new BankAccountProcessor(userId, defaultCurrency || "USD");

    devLogger.info("Using processor", {
      type: processor.getStatementType(),
      description: processor.getDescription(),
    });

    // Process transactions using the appropriate processor
    const processedTransactions = await processor.processTransactions(
      transactions,
      currency
    );

    // Convert to database records
    const transactionRecords = processedTransactions.map((tx) => ({
      id: createId(),
      bankStatementId,
      transactionDate: tx.transactionDate,
      postedDate: tx.postedDate,
      description: tx.description,
      merchantName: tx.merchantName,
      referenceNumber: tx.referenceNumber,
      amount: tx.amount,
      currency: tx.currency || currency,
      category: tx.category,
      categoryId: tx.categoryId,
      businessId: tx.businessId,
      paymentMethod: tx.paymentMethod,
      order: tx.order,
    }));

    await db.insert(bankStatementTransactions).values(transactionRecords);

    // Update document status
    await db
      .update(documents)
      .set({
        status: "completed",
        extractedAt: new Date(),
        processedAt: new Date(),
        extractionConfidence: confidence?.toString(),
      })
      .where(eq(documents.id, documentId));

    // Update bank statement with processed count
    await db
      .update(bankStatements)
      .set({
        processedTransactionCount: transactionRecords.length,
      })
      .where(eq(bankStatements.id, bankStatementId));

    devLogger.info("Bank statement processed successfully", {
      documentId,
      bankStatementId,
      transactionCount: transactionRecords.length,
    });

    return {
      documentId,
      transactionCount: transactionRecords.length,
    };
  } catch (error) {
    // If processing failed, delete the document so it can be retried
    // Otherwise duplicate detection will block re-uploads
    try {
      await db.delete(documents).where(eq(documents.id, documentId));
      devLogger.info("Cleaned up failed document", {
        documentId,
        reason: "processing_failed",
      });
    } catch (cleanupError) {
      devLogger.error("Failed to cleanup failed document", {
        documentId,
        error: cleanupError,
      });
    }

    throw error;
  }
}
