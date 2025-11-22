/**
 * Process bank statement spreadsheets (CSV, XLSX, XLS)
 * Uses AI-driven orchestrator to parse and import transactions
 */

import { db } from "@/lib/db";
import {
  documents,
  bankStatements,
  bankStatementTransactions,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { importSpreadsheet, isSpreadsheetFile } from "./import-orchestrator";
import { devLogger } from "@/lib/dev-logger";
import { createId } from "@paralleldrive/cuid2";
import { CategoryEngine } from "@/lib/categorization/engine";

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
 * Get file format from URL
 */
function getFileFormat(url: string): "csv" | "xlsx" | "xls" | "other" {
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  return "other";
}

/**
 * Process a bank statement file and create database records
 */
export async function processBankStatement(
  fileUrl: string,
  fileName: string,
  batchId: string,
  userId: string
): Promise<{ documentId: string; transactionCount: number }> {
  devLogger.info("Processing bank statement", {
    fileName,
    fileUrl: fileUrl.substring(0, 50) + "...",
    batchId,
    userId,
  });

  // Validate file type
  if (!isSpreadsheetFile(fileName)) {
    throw new Error(
      `Unsupported file type. Bank statements must be CSV, XLSX, or XLS files.`
    );
  }

  // Download file
  const fileBuffer = await downloadFile(fileUrl);
  const fileFormat = getFileFormat(fileUrl);

  // Create document record
  const documentId = createId();
  await db.insert(documents).values({
    id: documentId,
    userId,
    documentType: "bank_statement",
    fileFormat,
    fileName,
    fileUrl,
    fileSizeBytes: fileBuffer.length,
    status: "processing",
    importBatchId: batchId,
    extractionMethod: "excel_parser",
  });

  try {
    // Import using AI orchestrator
    const importResult = await importSpreadsheet(fileBuffer, fileName);

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
    await db.insert(bankStatements).values({
      id: bankStatementId,
      documentId,
      currency: importResult.mappingConfig?.currency || "USD",
      transactionCount: importResult.transactions.length,
      processedTransactionCount: 0,
    });

    // Categorize and insert transactions
    const transactionRecords = await Promise.all(
      importResult.transactions.map(async (tx, index) => {
        // Calculate amount (handle debit/credit split)
        let amount = tx.amount ?? 0;
        if (tx.debit !== null && tx.debit !== undefined) {
          amount = -Math.abs(tx.debit);
        }
        if (tx.credit !== null && tx.credit !== undefined) {
          amount = Math.abs(tx.credit);
        }

        // Ensure dates are Date objects or null (not strings)
        const transactionDate =
          tx.transactionDate instanceof Date
            ? tx.transactionDate
            : tx.transactionDate
            ? new Date(tx.transactionDate)
            : null;

        const postedDate =
          tx.postedDate instanceof Date
            ? tx.postedDate
            : tx.postedDate
            ? new Date(tx.postedDate)
            : null;

        // Auto-categorize the transaction
        let categoryId: string | null = null;
        let categoryName: string | null = tx.category || null;

        if (tx.merchantName || tx.description) {
          const categorizationResult = await CategoryEngine.categorizeWithAI(
            {
              merchantName: tx.merchantName,
              description: tx.description,
              amount: amount.toString(),
            },
            {
              userId,
              includeAI: true,
              minConfidence: 0.7,
            }
          );

          if (categorizationResult.categoryId) {
            categoryId = categorizationResult.categoryId;
            categoryName = categorizationResult.categoryName;
          } else if (categorizationResult.suggestedCategory) {
            // New category suggested by AI, store as text for now
            categoryName = categorizationResult.suggestedCategory;
          }

          devLogger.debug("Transaction categorized", {
            merchantName: tx.merchantName,
            categoryName,
            categoryId,
            method: categorizationResult.method,
            confidence: categorizationResult.confidence,
          });
        }

        return {
          id: createId(),
          bankStatementId,
          transactionDate: transactionDate,
          postedDate: postedDate,
          description: tx.description || "",
          merchantName: tx.merchantName,
          referenceNumber: tx.referenceNumber,
          amount: amount.toString(),
          currency: importResult.mappingConfig?.currency || "USD",
          category: categoryName,
          categoryId: categoryId,
          order: index,
        };
      })
    );

    await db.insert(bankStatementTransactions).values(transactionRecords);

    // Update document status
    await db
      .update(documents)
      .set({
        status: "completed",
        extractedAt: new Date(),
        processedAt: new Date(),
        extractionConfidence:
          importResult.mappingConfig?.confidence?.toString(),
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
    // Update document to failed status
    await db
      .update(documents)
      .set({
        status: "failed",
        extractionErrors: JSON.stringify([
          {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
        ]),
      })
      .where(eq(documents.id, documentId));

    throw error;
  }
}
