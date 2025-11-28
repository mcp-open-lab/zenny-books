/**
 * PDF Table Extractor
 * Extracts text from PDFs using unpdf (serverless compatible)
 * Then uses LLM to parse transactions into structured format
 */

import { getDocumentProxy, getMeta } from "unpdf";
import { z } from "zod";
import { generateObjectForCategorization } from "@/lib/ai/client";
import type { NormalizedTransaction } from "./spreadsheet-parser";

// Schema for LLM to extract transactions
const TransactionSchema = z.object({
  transactionDate: z
    .string()
    .nullable()
    .describe("Transaction date in YYYY-MM-DD format"),
  postDate: z.string().nullable().describe("Posting date in YYYY-MM-DD format"),
  description: z.string().describe("Full transaction description"),
  merchant: z
    .string()
    .describe("Merchant/vendor name extracted from description"),
  amount: z
    .number()
    .describe(
      "Amount as number. Negative for purchases/debits, positive for credits/payments"
    ),
});

const ExtractedTransactionsSchema = z.object({
  transactions: z.array(TransactionSchema),
  currency: z.string().default("CAD"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
});

export interface PdfExtractionResult {
  text: string;
  pageTexts: string[];
  metadata: {
    title?: string;
    author?: string;
    pageCount: number;
  };
}

/**
 * Extract raw text from PDF using unpdf
 */
export async function extractPdfText(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  const uint8Array = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8Array);
  const meta = await getMeta(pdf);

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .filter((item): item is typeof item & { str: string } => "str" in item)
      .map((item) => item.str)
      .join(" ");

    pageTexts.push(pageText);
  }

  return {
    text: pageTexts.join("\n\n"),
    pageTexts,
    metadata: {
      title: meta.info?.Title,
      author: meta.info?.Author,
      pageCount: pdf.numPages,
    },
  };
}

/**
 * Check if PDF appears to be scanned (low text content)
 */
export function isScannedPdf(result: PdfExtractionResult): boolean {
  const avgTextPerPage =
    result.text.length / Math.max(1, result.metadata.pageCount);
  return avgTextPerPage < 100;
}

/**
 * Parse transactions from PDF text using LLM
 */
export async function parseTransactionsFromPdf(
  pdfResult: PdfExtractionResult
): Promise<NormalizedTransaction[]> {
  const prompt = `Extract all financial transactions from this bank/credit card statement text.

For each transaction, extract:
- transactionDate: The transaction date (YYYY-MM-DD format)
- postDate: The posting date if different (YYYY-MM-DD format)  
- description: The full description text
- merchant: A clean merchant name extracted from the description
- amount: The amount as a number. Use NEGATIVE for purchases/debits/charges. Use POSITIVE for payments/credits/refunds.

Rules:
- Extract ALL individual transactions, not summaries
- Skip header rows, totals, and account summaries
- For credit cards: purchases are negative, payments/credits are positive
- Parse dates to YYYY-MM-DD format (assume current year if not specified)
- Clean up merchant names (remove payment processor prefixes like "PAYPAL *", location codes, etc.)

Statement text:
${pdfResult.text.substring(0, 30000)}`;

  const result = await generateObjectForCategorization(
    prompt,
    ExtractedTransactionsSchema,
    { maxTokens: 16384 } // Need high token limit for many transactions
  );

  if (!result.success || !result.data) {
    return [];
  }

  // Convert to NormalizedTransaction format
  return result.data.transactions.map((tx) => ({
    transactionDate: tx.transactionDate ? new Date(tx.transactionDate) : null,
    postedDate: tx.postDate ? new Date(tx.postDate) : null,
    description: tx.description,
    merchantName: tx.merchant,
    amount: tx.amount,
    raw: { originalDescription: tx.description, originalAmount: tx.amount },
  }));
}

/**
 * Convert transactions to CSV format
 */
export function transactionsToCsv(
  transactions: NormalizedTransaction[]
): string {
  const headers = [
    "Transaction Date",
    "Posted Date",
    "Merchant",
    "Description",
    "Amount",
  ];

  const rows = transactions.map((tx) => [
    tx.transactionDate?.toISOString().split("T")[0] || "",
    tx.postedDate?.toISOString().split("T")[0] || "",
    tx.merchantName || "",
    tx.description || "",
    tx.amount?.toString() || "",
  ]);

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
}
