/**
 * Bank Statement PDF Processor
 *
 * Extracts transaction data from bank statement PDFs using:
 * 1. Primary: PDF text extraction + LLM parsing
 * 2. Fallback: Vision LLM for scanned PDFs
 */

import { z } from "zod";
import { generateObjectForExtraction } from "@/lib/ai/client";
import { BankStatementExtractionPrompt } from "@/lib/ai/prompts";
import {
  extractPdfText,
  assessExtractionQuality,
  type PdfExtractionResult,
} from "../pdf-extractor";
import {
  BaseStatementProcessor,
  type ProcessedTransaction,
} from "./base-statement-processor";
import { devLogger } from "@/lib/dev-logger";
import { AI_TEMPERATURES } from "@/lib/constants";

const TransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  balance: z.number().nullable(),
  category: z.string().nullable(),
});

const BankStatementSchema = z.object({
  accountInfo: z.object({
    bankName: z.string().nullable(),
    accountNumber: z.string().nullable(),
    accountHolderName: z.string().nullable(),
    accountType: z.enum(["checking", "savings", "credit", "other"]).nullable(),
  }),
  statementPeriod: z.object({
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    statementDate: z.string().nullable(),
  }),
  balances: z.object({
    openingBalance: z.number().nullable(),
    closingBalance: z.number().nullable(),
  }),
  currency: z.string(),
  transactions: z.array(TransactionSchema),
  extractionConfidence: z.number(),
});

export type ExtractedBankStatement = z.infer<typeof BankStatementSchema>;
export type ExtractedTransaction = z.infer<typeof TransactionSchema>;

export interface PdfProcessingResult {
  success: boolean;
  statement?: ExtractedBankStatement;
  transactions: ProcessedTransaction[];
  error?: string;
  method: "text" | "vision";
  confidence: number;
}

export class BankStatementPdfProcessor extends BaseStatementProcessor {
  private statementType: "bank_account" | "credit_card";

  constructor(
    userId: string,
    defaultCurrency: string = "USD",
    statementType: "bank_account" | "credit_card" = "bank_account"
  ) {
    super(userId, defaultCurrency);
    this.statementType = statementType;
  }

  getStatementType(): "bank_account" | "credit_card" {
    return this.statementType;
  }

  getDescription(): string {
    return this.statementType === "credit_card"
      ? "Credit Card PDF Statement - Extracts transactions from PDF"
      : "Bank Account PDF Statement - Extracts transactions from PDF";
  }

  /**
   * Process PDF buffer and extract transactions
   */
  async processPdf(
    buffer: Buffer,
    fileName: string
  ): Promise<PdfProcessingResult> {
    devLogger.info("Processing bank statement PDF", {
      fileName,
      statementType: this.statementType,
      userId: this.userId,
    });

    try {
      // Step 1: Extract text from PDF
      const pdfResult = await extractPdfText(buffer);
      const quality = assessExtractionQuality(pdfResult);

      devLogger.info("PDF text extraction complete", {
        pageCount: pdfResult.pageCount,
        isScanned: pdfResult.isScanned,
        quality,
      });

      // Step 2: Decide extraction method based on quality
      if (quality >= 0.5) {
        // Good text extraction - use text-based LLM parsing
        return await this.extractWithText(pdfResult, fileName);
      } else {
        // Poor text extraction - use vision fallback
        devLogger.info(
          "Text extraction quality too low, using vision fallback",
          {
            quality,
            fileName,
          }
        );
        return await this.extractWithVision(buffer, fileName);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      devLogger.error("PDF processing failed", {
        error: errorMessage,
        fileName,
      });

      return {
        success: false,
        transactions: [],
        error: errorMessage,
        method: "text",
        confidence: 0,
      };
    }
  }

  /**
   * Extract transactions using text-based LLM parsing
   */
  private async extractWithText(
    pdfResult: PdfExtractionResult,
    fileName: string
  ): Promise<PdfProcessingResult> {
    const prompt = BankStatementExtractionPrompt.build({
      statementType: this.statementType,
      currency: this.defaultCurrency,
    });

    // Combine prompt with extracted text
    const fullPrompt = `${prompt}

## Extracted Text from PDF

The following text was extracted from a ${pdfResult.pageCount}-page bank statement PDF:

---
${pdfResult.text}
---

Parse the above text and extract all transaction data.`;

    devLogger.debug("Calling LLM for text-based extraction", {
      textLength: pdfResult.text.length,
      pageCount: pdfResult.pageCount,
    });

    const result = await generateObjectForExtraction(
      fullPrompt,
      BankStatementSchema,
      {
        temperature: AI_TEMPERATURES.STRUCTURED_OUTPUT,
        loggingContext: {
          userId: this.userId,
          entityId: null,
          entityType: "batch",
          promptType: "extraction",
          inputData: {
            fileName,
            method: "text",
            pageCount: pdfResult.pageCount,
          },
        },
      }
    );

    if (!result.success || !result.data) {
      return {
        success: false,
        transactions: [],
        error: result.error || "LLM extraction failed",
        method: "text",
        confidence: 0,
      };
    }

    const statement = result.data;
    const processedTransactions = await this.convertToProcessedTransactions(
      statement.transactions,
      statement.currency
    );

    return {
      success: true,
      statement,
      transactions: processedTransactions,
      method: "text",
      confidence: statement.extractionConfidence,
    };
  }

  /**
   * Extract transactions using vision LLM (for scanned PDFs)
   */
  private async extractWithVision(
    buffer: Buffer,
    fileName: string
  ): Promise<PdfProcessingResult> {
    // Convert PDF to base64 for vision API
    const base64Pdf = buffer.toString("base64");

    const prompt = BankStatementExtractionPrompt.buildVisionPrompt({
      statementType: this.statementType,
      currency: this.defaultCurrency,
    });

    devLogger.debug("Calling LLM for vision-based extraction", {
      fileName,
      bufferSize: buffer.length,
    });

    const result = await generateObjectForExtraction(
      prompt,
      BankStatementSchema,
      {
        image: {
          data: base64Pdf,
          mimeType: "application/pdf",
        },
        temperature: AI_TEMPERATURES.STRUCTURED_OUTPUT,
        loggingContext: {
          userId: this.userId,
          entityId: null,
          entityType: "batch",
          promptType: "extraction",
          inputData: {
            fileName,
            method: "vision",
          },
        },
      }
    );

    if (!result.success || !result.data) {
      return {
        success: false,
        transactions: [],
        error: result.error || "Vision extraction failed",
        method: "vision",
        confidence: 0,
      };
    }

    const statement = result.data;
    const processedTransactions = await this.convertToProcessedTransactions(
      statement.transactions,
      statement.currency
    );

    return {
      success: true,
      statement,
      transactions: processedTransactions,
      method: "vision",
      confidence: statement.extractionConfidence,
    };
  }

  /**
   * Convert extracted transactions to ProcessedTransaction format
   */
  private async convertToProcessedTransactions(
    transactions: ExtractedTransaction[],
    currency: string
  ): Promise<ProcessedTransaction[]> {
    const processed: ProcessedTransaction[] = [];

    for (let index = 0; index < transactions.length; index++) {
      const tx = transactions[index];

      // Parse date
      const transactionDate = this.ensureDate(tx.date);

      // Categorize transaction
      const { categoryId, categoryName, businessId } =
        await this.categorizeTransaction(
          null, // No merchant name from raw extraction
          tx.description,
          tx.amount.toString()
        );

      // Detect payment method from description
      const paymentMethod = await this.detectPaymentMethod(tx.description);

      processed.push({
        transactionDate,
        postedDate: null,
        description: tx.description,
        merchantName: null,
        referenceNumber: null,
        amount: tx.amount.toString(),
        currency,
        category: tx.category || categoryName,
        categoryId,
        businessId,
        paymentMethod,
        order: index,
      });
    }

    return processed;
  }

  /**
   * Implementation of base class abstract method
   * Not typically used for PDFs - use processPdf instead
   */
  async processTransactions(
    _transactions: import("../spreadsheet-parser").NormalizedTransaction[],
    _currency: string
  ): Promise<ProcessedTransaction[]> {
    throw new Error(
      "Use processPdf() method for PDF processing, not processTransactions()"
    );
  }
}
