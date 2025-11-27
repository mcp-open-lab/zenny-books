/**
 * Process bank statement files (CSV, XLSX, XLS, PDF)
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
import { isPdfFile } from "./pdf-extractor";
import { devLogger } from "@/lib/dev-logger";
import { createId } from "@paralleldrive/cuid2";
import { BankAccountProcessor } from "./processors/bank-account-processor";
import { CreditCardProcessor } from "./processors/credit-card-processor";
import { BankStatementPdfProcessor } from "./processors/bank-statement-pdf-processor";
import type { BaseStatementProcessor } from "./processors/base-statement-processor";
import { getFileFormatFromUrl } from "@/lib/constants";

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
 * Process a bank statement file and create database records
 * Supports spreadsheets (CSV, XLSX, XLS) and PDFs
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

  // Determine file type and route to appropriate processor
  const isPdf = isPdfFile(fileName);
  const isSpreadsheet = isSpreadsheetFile(fileName);

  if (!isPdf && !isSpreadsheet) {
    throw new Error(
      `Unsupported file type. Bank statements must be CSV, XLSX, XLS, or PDF files.`
    );
  }

  // Download file
  const fileBuffer = await downloadFile(fileUrl);
  const fileFormat = getFileFormatFromUrl(fileUrl);

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
    extractionMethod: isPdf ? "ai_gemini" : "excel_parser",
  });

  try {
    // Route to appropriate processor based on file type
    if (isPdf) {
      return await processPdfStatement(
        fileBuffer,
        fileName,
        documentId,
        userId,
        defaultCurrency || "USD",
        statementType || "bank_account"
      );
    } else {
      return await processSpreadsheetStatement(
        fileBuffer,
        fileName,
        documentId,
        userId,
        defaultCurrency,
        statementType
      );
    }
  } catch (error) {
    // If processing failed, delete the document so it can be retried
    // Otherwise duplicate detection will block re-uploads
    try {
      await db.delete(documents).where(eq(documents.id, documentId));
      devLogger.info("Cleaned up failed document", { documentId, reason: "processing_failed" });
    } catch (cleanupError) {
      devLogger.error("Failed to cleanup failed document", { documentId, error: cleanupError });
    }

    throw error;
  }
}

/**
 * Process PDF bank statement using AI extraction
 */
async function processPdfStatement(
  fileBuffer: Buffer,
  fileName: string,
  documentId: string,
  userId: string,
  defaultCurrency: string,
  statementType: "bank_account" | "credit_card"
): Promise<{ documentId: string; transactionCount: number }> {
  const processor = new BankStatementPdfProcessor(
    userId,
    defaultCurrency,
    statementType
  );

  devLogger.info("Processing PDF bank statement", {
    documentId,
    statementType,
    processorDescription: processor.getDescription(),
  });

  const result = await processor.processPdf(fileBuffer, fileName);

  if (!result.success || result.transactions.length === 0) {
    throw new Error(result.error || "No transactions found in PDF");
  }

  devLogger.info("PDF extraction completed", {
    documentId,
    transactionCount: result.transactions.length,
    method: result.method,
    confidence: result.confidence,
  });

  // Create bank statement record
  const bankStatementId = createId();
  const currency = result.statement?.currency || defaultCurrency;

  await db.insert(bankStatements).values({
    id: bankStatementId,
    documentId,
    bankName: result.statement?.accountInfo.bankName || null,
    accountNumber: result.statement?.accountInfo.accountNumber || null,
    accountHolderName: result.statement?.accountInfo.accountHolderName || null,
    accountType: result.statement?.accountInfo.accountType || null,
    periodStart: result.statement?.statementPeriod.startDate
      ? new Date(result.statement.statementPeriod.startDate)
      : null,
    periodEnd: result.statement?.statementPeriod.endDate
      ? new Date(result.statement.statementPeriod.endDate)
      : null,
    statementDate: result.statement?.statementPeriod.statementDate
      ? new Date(result.statement.statementPeriod.statementDate)
      : null,
    openingBalance: result.statement?.balances.openingBalance?.toString() || null,
    closingBalance: result.statement?.balances.closingBalance?.toString() || null,
    currency,
    transactionCount: result.transactions.length,
    processedTransactionCount: 0,
  });

  // Convert to database records
  const transactionRecords = result.transactions.map((tx) => ({
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
      extractionConfidence: result.confidence.toString(),
    })
    .where(eq(documents.id, documentId));

  // Update bank statement with processed count
  await db
    .update(bankStatements)
    .set({
      processedTransactionCount: transactionRecords.length,
    })
    .where(eq(bankStatements.id, bankStatementId));

  devLogger.info("PDF bank statement processed successfully", {
    documentId,
    bankStatementId,
    transactionCount: transactionRecords.length,
    extractionMethod: result.method,
  });

  return {
    documentId,
    transactionCount: transactionRecords.length,
  };
}

/**
 * Process spreadsheet bank statement (CSV, XLSX, XLS)
 */
async function processSpreadsheetStatement(
  fileBuffer: Buffer,
  fileName: string,
  documentId: string,
  userId: string,
  defaultCurrency?: string,
  statementType?: "bank_account" | "credit_card"
): Promise<{ documentId: string; transactionCount: number }> {
  // Import using AI orchestrator (pass userId for category context)
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

  devLogger.info("Spreadsheet parsed successfully", {
    documentId,
    transactionCount: importResult.transactions.length,
    mappingConfidence: importResult.mappingConfig?.confidence,
    currency: importResult.mappingConfig?.currency,
  });

  // Create bank statement record
  const bankStatementId = createId();
  const currency =
    importResult.mappingConfig?.currency || defaultCurrency || "USD";
  await db.insert(bankStatements).values({
    id: bankStatementId,
    documentId,
    currency,
    transactionCount: importResult.transactions.length,
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
    importResult.transactions,
    importResult.mappingConfig?.currency || defaultCurrency || "USD"
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
      extractionConfidence: importResult.mappingConfig?.confidence?.toString(),
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
}
