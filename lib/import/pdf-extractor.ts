/**
 * PDF Text Extractor
 * Extracts text content from PDF files for bank statement processing
 */

import { PDFParse } from "pdf-parse";
import { devLogger } from "@/lib/dev-logger";

// Configure pdfjs-dist to disable workers for server-side usage
// This must be done before any PDFParse instances are created
// Solution: Set GlobalWorkerOptions.workerSrc to undefined for server-side code
if (typeof window === "undefined") {
  try {
    // Import pdfjs-dist directly to configure GlobalWorkerOptions
    // This prevents the worker file loading error in Next.js server environment
    const pdfjsDist = await import("pdfjs-dist");
    if (pdfjsDist.GlobalWorkerOptions) {
      // Set to undefined to disable worker (TypeScript requires type assertion)
      (pdfjsDist.GlobalWorkerOptions as any).workerSrc = undefined;
    }
  } catch (error) {
    // If import fails, use PDFParse.setWorker as fallback
    devLogger.debug("Direct pdfjs-dist configuration failed, using PDFParse.setWorker", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (PDFParse.isNodeJS) {
      PDFParse.setWorker("");
    }
  }
}

export interface PdfExtractionResult {
  text: string;
  pages: string[];
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
  };
  isScanned: boolean;
}

/**
 * Extract text from PDF buffer
 * Returns structured text content with page separation
 */
export async function extractPdfText(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  let parser: PDFParse | null = null;
  
  try {
    // Create parser with buffer data
    // Worker is disabled via static setWorker() call above for Node.js environments
    // Additional options to prevent worker usage
    parser = new PDFParse({ 
      data: buffer,
      useWorkerFetch: false,
      isOffscreenCanvasSupported: false,
      disableFontFace: true,
    });
    
    // Get text and info in parallel
    const [textResult, infoResult] = await Promise.all([
      parser.getText(),
      parser.getInfo(),
    ]);

    const pageCount = textResult.total;
    const text = textResult.text;
    
    // Extract pages from TextResult
    const pages = textResult.pages.map((p) => p.text.trim());

    // Detect if PDF is scanned (very little extractable text relative to page count)
    const avgCharsPerPage = text.length / pageCount;
    const isScanned = avgCharsPerPage < 100; // Less than 100 chars per page suggests scanned

    devLogger.info("PDF text extracted", {
      pageCount,
      totalChars: text.length,
      avgCharsPerPage: Math.round(avgCharsPerPage),
      isScanned,
    });

    return {
      text,
      pages,
      pageCount,
      metadata: {
        title: infoResult.info?.Title,
        author: infoResult.info?.Author,
        creator: infoResult.info?.Creator,
      },
      isScanned,
    };
  } catch (error) {
    devLogger.error("PDF extraction failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Failed to extract text from PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  } finally {
    // Clean up parser resources
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Check if text extraction quality is sufficient for LLM parsing
 * Returns confidence score 0-1
 */
export function assessExtractionQuality(result: PdfExtractionResult): number {
  // If scanned, quality is poor
  if (result.isScanned) {
    return 0.1;
  }

  // Check for common bank statement patterns
  const text = result.text.toLowerCase();
  const hasDatePatterns = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text);
  const hasAmountPatterns = /\$?\d+[,.]?\d*\.\d{2}/.test(text);
  const hasBankKeywords = /statement|account|balance|transaction|deposit|withdrawal/i.test(
    text
  );

  let score = 0.5; // Base score for non-scanned PDF

  if (hasDatePatterns) score += 0.2;
  if (hasAmountPatterns) score += 0.2;
  if (hasBankKeywords) score += 0.1;

  return Math.min(score, 1);
}

/**
 * Check if a file is a PDF based on extension
 */
export function isPdfFile(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension === "pdf";
}
