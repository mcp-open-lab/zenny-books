/**
 * Receipt Processor
 *
 * Handles receipt OCR extraction with specific fields:
 * - Merchant name, date, amounts
 * - Tax breakdown (GST/HST/PST for CA, sales tax for US)
 * - Tip amount, discount amount
 * - Payment method
 * - Business purpose and classification
 */

import {
  BaseDocumentProcessor,
  type ProcessedDocument,
  type DocumentProcessorConfig,
} from "./base-document-processor";
import { generateObjectForExtraction } from "@/lib/ai/client";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { devLogger } from "@/lib/dev-logger";
import { ReceiptExtractionPrompt } from "@/lib/ai/prompts";
import { AI_TEMPERATURES, CONFIDENCE_DEFAULTS } from "@/lib/constants";

export class ReceiptProcessor extends BaseDocumentProcessor {
  constructor(config: DocumentProcessorConfig) {
    super(config);
  }

  getDocumentType(): "receipt" {
    return "receipt";
  }

  getDescription(): string {
    return "Receipt - Extract merchant, amounts, taxes, tips, and payment method";
  }

  getRequiredFields(): Set<string> {
    // Minimum fields needed for a valid receipt
    // date is optional - users can enter it manually if missing
    // merchantName is preferred but not required - some receipts don't have clear merchant names
    return new Set(["totalAmount"]);
  }

  getOptionalFields(): Set<string> {
    return new Set([
      "subtotal",
      "taxAmount",
      "gstAmount",
      "hstAmount",
      "pstAmount",
      "salesTaxAmount",
      "tipAmount",
      "discountAmount",
      "receiptNumber",
      "paymentMethod",
      "category",
      "description",
      "businessPurpose",
      "isBusinessExpense",
    ]);
  }

  async processDocument(
    fileUrl: string,
    fileName: string
  ): Promise<ProcessedDocument> {
    devLogger.info("Processing receipt", {
      fileName,
      userId: this.userId,
      country: this.country,
      currency: this.currency,
    });

    // Build fields to extract based on config
    const fieldsToExtract = this.getFieldsToExtract();

    // Download and convert image to base64
    const imageResp = await fetch(fileUrl);
    if (!imageResp.ok) {
      throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    }

    const imageBuffer = await imageResp.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Call AI API for OCR (uses GPT-4o-mini for cost optimization)
    const extractedData = await this.extractWithAI(
      base64Image,
      fileUrl,
      fieldsToExtract,
      fileName
    );

    // Validate minimum requirements
    const validation = this.validateExtractedData(extractedData);
    if (!validation.isValid) {
      devLogger.error("Receipt extraction missing required fields", {
        missingFields: validation.missingFields,
        fileName: fileName || "unknown",
      });
      throw new Error(
        `Failed to extract required fields from receipt: ${validation.missingFields.join(
          ", "
        )}. The image may be unclear or not a valid receipt.`
      );
    }

    // Auto-categorize if merchant name is present
    let categoryId: string | null = null;
    let categoryName: string | null = extractedData.category || null;
    let businessId: string | null = null;

    if (extractedData.merchantName) {
      const catResult = await this.categorizeDocument(
        extractedData.merchantName,
        null, // description is user-driven, not used for categorization
        extractedData.totalAmount?.toString() || "0"
      );
      categoryId = catResult.categoryId;
      businessId = catResult.businessId;
      if (!categoryName) {
        categoryName = catResult.categoryName;
      }
    }

    // Return processed document
    return {
      documentId: "", // Will be set by caller
      documentType: "receipt",
      merchantName: extractedData.merchantName || null,
      date: extractedData.date
        ? (() => {
            try {
              const parsedDate = new Date(extractedData.date);
              // Check if date is valid
              if (isNaN(parsedDate.getTime())) {
                devLogger.warn("Invalid date value from extraction", {
                  dateValue: extractedData.date,
                  fileName: fileName || "unknown",
                });
                return null;
              }
              return parsedDate;
            } catch (error) {
              devLogger.warn("Error parsing date from extraction", {
                dateValue: extractedData.date,
                error: error instanceof Error ? error.message : String(error),
                fileName: fileName || "unknown",
              });
              return null;
            }
          })()
        : null,
      subtotal: extractedData.subtotal || null,
      taxAmount: extractedData.taxAmount || null,
      totalAmount: extractedData.totalAmount || null,
      gstAmount: extractedData.gstAmount || null,
      hstAmount: extractedData.hstAmount || null,
      pstAmount: extractedData.pstAmount || null,
      salesTaxAmount: extractedData.salesTaxAmount || null,
      tipAmount: extractedData.tipAmount || null,
      receiptNumber: extractedData.receiptNumber || null,
      paymentMethod: extractedData.paymentMethod || null,
      category: categoryName,
      categoryId,
      businessId,
      description: null, // User-driven field, not extracted by LLM
      currency: this.currency,
      country: this.country,
      province: extractedData.province || null,
      extractionConfidence: CONFIDENCE_DEFAULTS.EXTRACTION,
    };
  }

  private getFieldsToExtract(): Set<string> {
    const fields = new Set<string>();

    // Always extract core fields
    fields.add("merchantName");
    fields.add("date");
    fields.add("totalAmount");

    // Add optional fields based on country
    fields.add("subtotal");
    fields.add("taxAmount");

    if (this.country === "CA") {
      fields.add("gstAmount");
      fields.add("hstAmount");
      fields.add("pstAmount");
    } else if (this.country === "US") {
      fields.add("salesTaxAmount");
    }

    fields.add("tipAmount");
    fields.add("discountAmount");
    fields.add("receiptNumber");
    fields.add("paymentMethod");
    fields.add("category");
    // description is user-driven, not extracted by LLM

    return fields;
  }

  private async extractWithAI(
    base64Image: string,
    imageUrl: string,
    fieldsToExtract: Set<string>,
    fileName?: string
  ): Promise<Record<string, any>> {
    // Build Zod schema for structured output
    const receiptSchema = this.buildReceiptSchema(fieldsToExtract);

    // Convert Zod schema to JSON Schema for prompt
    const jsonSchema = zodToJsonSchema(receiptSchema, "ReceiptData");

    // Build prompt with explicit JSON schema and field names
    // date and totalAmount are truly required; merchantName is highly preferred but not required
    const requiredFields = Array.from(fieldsToExtract).filter((f) =>
      ["date", "totalAmount"].includes(f)
    );
    const preferredFields = Array.from(fieldsToExtract).filter(
      (f) => f === "merchantName"
    );
    const optionalFields = Array.from(fieldsToExtract).filter(
      (f) => !["merchantName", "date", "totalAmount"].includes(f)
    );

    // Build prompt using centralized prompt builder
    const prompt = ReceiptExtractionPrompt.build({
      requiredFields,
      preferredFields,
      optionalFields,
      country: this.country,
      currency: this.currency,
      jsonSchema,
    });

    devLogger.debug(
      "Calling AI for receipt extraction with structured output",
      {
        userId: this.userId,
        fieldsToExtract: Array.from(fieldsToExtract),
        country: this.country,
        currency: this.currency,
      }
    );

    // Get MIME type from URL
    const imageMimeType = this.getMimeType(imageUrl);

    // Call AI with structured output (Zod schema enforces structure)
    // Using GPT-4o-mini for cost optimization (93% cheaper than GPT-4o)
    const result = await generateObjectForExtraction(prompt, receiptSchema, {
      image: { data: base64Image, mimeType: imageMimeType },
      temperature: AI_TEMPERATURES.STRUCTURED_OUTPUT,
      loggingContext: {
        userId: this.userId,
        entityId: null, // Will be set after receipt is created
        entityType: "receipt",
        promptType: "extraction",
        inputData: {
          fileName,
          country: this.country,
          currency: this.currency,
          fieldsToExtract: Array.from(fieldsToExtract),
        },
      },
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || "AI extraction failed");
    }

    devLogger.info("Receipt extraction completed", {
      hasMerchantName: !!result.data.merchantName,
      merchantName: result.data.merchantName || null,
      hasDate: !!result.data.date,
      date: result.data.date || null,
      hasTotalAmount: !!result.data.totalAmount,
      totalAmount: result.data.totalAmount || null,
      provider: result.provider,
    });

    return result.data as Record<string, any>;
  }

  private buildReceiptSchema(fieldsToExtract: Set<string>): z.ZodSchema {
    const schemaFields: Record<string, z.ZodType> = {};

    if (fieldsToExtract.has("merchantName")) {
      schemaFields.merchantName = z.string().nullable();
    }
    if (fieldsToExtract.has("date")) {
      schemaFields.date = z.string().nullable();
    }
    if (fieldsToExtract.has("totalAmount")) {
      schemaFields.totalAmount = z.number().nullable();
    }
    if (fieldsToExtract.has("subtotal")) {
      schemaFields.subtotal = z.number().nullable();
    }
    if (fieldsToExtract.has("taxAmount")) {
      schemaFields.taxAmount = z.number().nullable();
    }
    if (fieldsToExtract.has("gstAmount")) {
      schemaFields.gstAmount = z.number().nullable();
    }
    if (fieldsToExtract.has("hstAmount")) {
      schemaFields.hstAmount = z.number().nullable();
    }
    if (fieldsToExtract.has("pstAmount")) {
      schemaFields.pstAmount = z.number().nullable();
    }
    if (fieldsToExtract.has("salesTaxAmount")) {
      schemaFields.salesTaxAmount = z.number().nullable();
    }
    if (fieldsToExtract.has("tipAmount")) {
      schemaFields.tipAmount = z.number().nullable();
    }
    if (fieldsToExtract.has("discountAmount")) {
      schemaFields.discountAmount = z.number().nullable();
    }
    if (fieldsToExtract.has("receiptNumber")) {
      schemaFields.receiptNumber = z.string().nullable();
    }
    if (fieldsToExtract.has("paymentMethod")) {
      schemaFields.paymentMethod = z.string().nullable();
    }
    if (fieldsToExtract.has("category")) {
      schemaFields.category = z.string().nullable();
    }
    // description is user-driven, not extracted by LLM

    return z.object(schemaFields);
  }

  private getMimeType(url: string): string {
    const ext = url.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "webp":
        return "image/webp";
      case "gif":
        return "image/gif";
      default:
        return "image/jpeg";
    }
  }
}
