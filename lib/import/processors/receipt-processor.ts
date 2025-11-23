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
import { generateObjectForExtraction, generateObject } from "@/lib/ai/client";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { devLogger } from "@/lib/dev-logger";
import { ReceiptExtractionPrompt } from "@/lib/ai/prompts";
import { AI_TEMPERATURES, CONFIDENCE_DEFAULTS } from "@/lib/ai/constants";

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
    // merchantName is preferred but not required - some receipts don't have clear merchant names
    return new Set(["date", "totalAmount"]);
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

    // Call AI API for OCR (uses GPT-4o-mini primary, GPT-4o fallback)
    // If validation fails, retry with GPT-4o for better accuracy
    let extractedData = await this.extractWithAI(
      base64Image,
      fileUrl,
      fieldsToExtract,
      fileName,
      false // Use GPT-4o-mini first
    );

    // Validate minimum requirements - retry with GPT-4o if validation fails
    const validation = this.validateExtractedData(extractedData);
    if (!validation.isValid) {
      devLogger.warn("Receipt extraction missing required fields, retrying with GPT-4o", {
        missingFields: validation.missingFields,
        fileName: fileName || "unknown",
        model: "gpt-4o-mini",
      });

      // Retry with GPT-4o for better accuracy
      extractedData = await this.extractWithAI(
        base64Image,
        fileUrl,
        fieldsToExtract,
        fileName,
        true // Force GPT-4o
      );

      // Validate again after retry
      const retryValidation = this.validateExtractedData(extractedData);
      if (!retryValidation.isValid) {
        devLogger.error("Receipt extraction still missing required fields after GPT-4o retry", {
          missingFields: retryValidation.missingFields,
          fileName: fileName || "unknown",
          model: "gpt-4o",
        });
        throw new Error(
          `Failed to extract required fields from receipt: ${retryValidation.missingFields.join(
            ", "
          )}. The image may be unclear or not a valid receipt.`
        );
      }

      devLogger.info("Receipt extraction succeeded after GPT-4o retry", {
        fileName: fileName || "unknown",
        model: "gpt-4o",
      });
    }

    // Auto-categorize if merchant name is present
    let categoryId: string | null = null;
    let categoryName: string | null = extractedData.category || null;

    if (extractedData.merchantName) {
      const catResult = await this.categorizeDocument(
        extractedData.merchantName,
        extractedData.description || null,
        extractedData.totalAmount?.toString() || "0"
      );
      categoryId = catResult.categoryId;
      if (!categoryName) {
        categoryName = catResult.categoryName;
      }
    }

    // Return processed document
    return {
      documentId: "", // Will be set by caller
      documentType: "receipt",
      merchantName: extractedData.merchantName || null,
      date: extractedData.date ? new Date(extractedData.date) : null,
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
      description: extractedData.description || null,
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
    fields.add("description");

    return fields;
  }

  private async extractWithAI(
    base64Image: string,
    imageUrl: string,
    fieldsToExtract: Set<string>,
    fileName?: string,
    useGPT4o: boolean = false
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
    // Use GPT-4o-mini for cost optimization (93% cheaper), or GPT-4o if forced
    const result = useGPT4o
      ? await generateObject(prompt, receiptSchema, {
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
              retry: true, // Mark as retry
            },
          },
        })
      : await generateObjectForExtraction(prompt, receiptSchema, {
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
    if (fieldsToExtract.has("description")) {
      schemaFields.description = z.string().nullable();
    }

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
