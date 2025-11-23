/**
 * Base Document Processor
 * Abstract class for processing single-document OCR (receipts, invoices, etc.)
 */

import type { createId } from "@paralleldrive/cuid2";

export interface ProcessedDocument {
  // Document metadata
  documentId: string;
  documentType: "receipt" | "invoice";

  // Extracted fields (all optional - depends on document type)
  merchantName?: string | null;
  vendorName?: string | null;
  customerName?: string | null;

  // Dates
  date?: Date | null;
  invoiceDate?: Date | null;
  dueDate?: Date | null;

  // Amounts
  subtotal?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  tipAmount?: number | null;

  // Tax breakdown (Canada)
  gstAmount?: number | null;
  hstAmount?: number | null;
  pstAmount?: number | null;

  // Tax breakdown (US)
  salesTaxAmount?: number | null;

  // Invoice-specific
  invoiceNumber?: string | null;
  poNumber?: string | null;
  amountPaid?: number | null;
  amountDue?: number | null;
  paymentTerms?: string | null;
  direction?: "in" | "out" | null;

  // Receipt-specific
  receiptNumber?: string | null;
  paymentMethod?: string | null;

  // Classification
  category?: string | null;
  categoryId?: string | null;
  businessId?: string | null;
  description?: string | null;

  // Metadata
  currency: string;
  country?: string | null;
  province?: string | null;
  extractionConfidence?: number;
}

export interface DocumentProcessorConfig {
  userId: string;
  batchId?: string;
  country?: string | null;
  province?: string | null;
  currency?: string;
  usageType?: string | null;
}

/**
 * Abstract base class for document processors
 *
 * Responsibilities:
 * - Define the contract for OCR-based document processing
 * - Provide common utilities (field validation, AI prompting)
 * - Enforce separation between receipt and invoice processing
 */
export abstract class BaseDocumentProcessor {
  protected userId: string;
  protected batchId?: string;
  protected country?: string | null;
  protected province?: string | null;
  protected currency: string;
  protected usageType?: string | null;

  constructor(config: DocumentProcessorConfig) {
    this.userId = config.userId;
    this.batchId = config.batchId;
    this.country = config.country;
    this.province = config.province;
    this.currency = config.currency || "USD";
    this.usageType = config.usageType;
  }

  /**
   * Process a document (image/PDF) and extract fields
   * Main entry point - implemented by subclasses
   */
  abstract processDocument(
    fileUrl: string,
    fileName: string
  ): Promise<ProcessedDocument>;

  /**
   * Get document type identifier
   */
  abstract getDocumentType(): "receipt" | "invoice";

  /**
   * Get human-readable description
   */
  abstract getDescription(): string;

  /**
   * Get required fields for this document type
   */
  abstract getRequiredFields(): Set<string>;

  /**
   * Get optional fields for this document type
   */
  abstract getOptionalFields(): Set<string>;

  /**
   * Validate extracted data meets minimum requirements
   */
  protected validateExtractedData(data: Record<string, any>): {
    isValid: boolean;
    missingFields: string[];
  } {
    const requiredFields = this.getRequiredFields();
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!data[field] || data[field] === null || data[field] === undefined) {
        missingFields.push(field);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Common utility: Auto-categorize document
   */
  protected async categorizeDocument(
    merchantName: string | null,
    description: string | null,
    amount: string
  ): Promise<{
    categoryId: string | null;
    categoryName: string | null;
    businessId: string | null;
  }> {
    if (!merchantName && !description) {
      return { categoryId: null, categoryName: null, businessId: null };
    }

    try {
      const { CategoryEngine } = await import("@/lib/categorization/engine");
      const result = await CategoryEngine.categorizeWithAI(
        { merchantName, description, amount },
        { userId: this.userId, includeAI: true, minConfidence: 0.7 }
      );

      return {
        categoryId: result.categoryId || null,
        categoryName: result.categoryName || result.suggestedCategory || null,
        businessId: result.businessId || null,
      };
    } catch (error) {
      // Categorization is optional - don't fail the whole process
      return { categoryId: null, categoryName: null, businessId: null };
    }
  }
}
