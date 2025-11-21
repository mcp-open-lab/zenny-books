"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import {
  receipts,
  documents,
  importBatches,
  importBatchItems,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getUserSettings } from "./user-settings";
import { createSafeAction } from "@/lib/safe-action";
import { devLogger } from "@/lib/dev-logger";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

function getMimeType(url: string): string {
  const extension = url.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return mimeTypes[extension || ""] || "image/jpeg";
}

function getFileFormat(url: string): string {
  const extension = url.split(".").pop()?.toLowerCase() || "";
  const formatMap: Record<string, string> = {
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    gif: "gif",
    pdf: "pdf",
    csv: "csv",
    xlsx: "xlsx",
    xls: "xls",
  };
  return formatMap[extension] || "jpg";
}

function getFileName(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split("/").pop();
    return fileName || null;
  } catch {
    return null;
  }
}

async function scanReceiptHandler(
  imageUrl: string,
  batchId?: string,
  userId?: string
) {
  const authResult = userId ? { userId } : await auth();
  const finalUserId = userId || authResult.userId;
  if (!finalUserId) throw new Error("Unauthorized");

  // Only use batches if batchId is explicitly provided (for batch imports)
  // Single uploads (phone camera, quick actions) don't use batches
  const finalBatchId = batchId;
  let batchItem: { id: string } | undefined;

  // Get user settings for location context and field preferences
  const settings = await getUserSettings();
  const country = settings?.country || "US";
  const currency = settings?.currency || (country === "CA" ? "CAD" : "USD");
  const province = settings?.province || null;
  const visibleFields = settings?.visibleFields || {};
  const defaultValues = settings?.defaultValues || {};

  // Core fields are always extracted (required for basic receipt functionality)
  const coreFields = ["merchantName", "date", "totalAmount"];

  // Determine which fields to extract:
  // 1. Always extract core fields
  // 2. Extract visible fields (if user wants to see/edit them)
  // 3. Skip fields that have default values set (we'll use defaults instead)
  const fieldsToExtract = new Set<string>(coreFields);

  // Add visible fields that don't have defaults
  if (visibleFields.taxAmount) {
    fieldsToExtract.add("taxAmount");
  }
  if (visibleFields.category) {
    fieldsToExtract.add("category");
  }
  if (visibleFields.tipAmount) {
    fieldsToExtract.add("tipAmount");
  }
  if (visibleFields.discountAmount) {
    fieldsToExtract.add("discountAmount");
  }
  if (visibleFields.description) {
    fieldsToExtract.add("description");
  }
  // Only extract paymentMethod if visible AND no default is set
  if (
    visibleFields.paymentMethod &&
    (defaultValues.paymentMethod === null ||
      defaultValues.paymentMethod === undefined)
  ) {
    fieldsToExtract.add("paymentMethod");
  }
  // Only extract businessPurpose if visible AND no default is set
  if (
    visibleFields.businessPurpose &&
    (defaultValues.businessPurpose === null ||
      defaultValues.businessPurpose === undefined ||
      defaultValues.businessPurpose.trim() === "")
  ) {
    fieldsToExtract.add("businessPurpose");
  }
  // Only extract isBusinessExpense if visible AND no default is set
  if (
    visibleFields.isBusinessExpense &&
    (defaultValues.isBusinessExpense === null ||
      defaultValues.isBusinessExpense === undefined)
  ) {
    fieldsToExtract.add("isBusinessExpense");
  }

  // Always extract subtotal (needed for tax calculations)
  fieldsToExtract.add("subtotal");

  // Tax fields based on country (always extract if visible)
  if (country === "CA" && visibleFields.taxAmount) {
    fieldsToExtract.add("gstAmount");
    fieldsToExtract.add("hstAmount");
    fieldsToExtract.add("pstAmount");
  }
  if (country === "US" && visibleFields.taxAmount) {
    fieldsToExtract.add("salesTaxAmount");
  }

  try {
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
      throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    }

    const imageBuffer = await imageResp.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Build tax extraction instructions based on user's location
    let taxInstructions = "";
    if (country === "CA" && fieldsToExtract.has("taxAmount")) {
      taxInstructions = `Extract Canadian tax fields if present:
- GST (Goods and Services Tax) - federal tax
- HST (Harmonized Sales Tax) - combined GST+PST in some provinces
- PST (Provincial Sales Tax) - provincial tax
If only a total tax is shown, extract it as taxAmount.`;
    } else if (country === "US" && fieldsToExtract.has("taxAmount")) {
      taxInstructions = `Extract US sales tax if present. Sales tax varies by state.`;
    }

    // Build JSON schema dynamically based on fields to extract
    const jsonFields: string[] = [];

    if (fieldsToExtract.has("merchantName")) {
      jsonFields.push('  "merchantName": "string or null"');
    }
    if (fieldsToExtract.has("date")) {
      jsonFields.push('  "date": "ISO 8601 date string (YYYY-MM-DD) or null"');
    }
    if (fieldsToExtract.has("totalAmount")) {
      jsonFields.push('  "totalAmount": number or null');
    }
    if (fieldsToExtract.has("subtotal")) {
      jsonFields.push('  "subtotal": number or null');
    }
    if (fieldsToExtract.has("taxAmount")) {
      jsonFields.push('  "taxAmount": number or null');
    }
    if (fieldsToExtract.has("gstAmount")) {
      jsonFields.push('  "gstAmount": number or null');
    }
    if (fieldsToExtract.has("hstAmount")) {
      jsonFields.push('  "hstAmount": number or null');
    }
    if (fieldsToExtract.has("pstAmount")) {
      jsonFields.push('  "pstAmount": number or null');
    }
    if (fieldsToExtract.has("salesTaxAmount")) {
      jsonFields.push('  "salesTaxAmount": number or null');
    }
    if (fieldsToExtract.has("tipAmount")) {
      jsonFields.push('  "tipAmount": number or null');
    }
    if (fieldsToExtract.has("discountAmount")) {
      jsonFields.push('  "discountAmount": number or null');
    }
    if (fieldsToExtract.has("category")) {
      jsonFields.push(
        '  "category": "Food" | "Transport" | "Utilities" | "Supplies" | "Other" or null'
      );
    }
    if (fieldsToExtract.has("description")) {
      jsonFields.push('  "description": "string or null"');
    }
    if (fieldsToExtract.has("paymentMethod")) {
      jsonFields.push(
        '  "paymentMethod": "cash" | "card" | "check" | "other" or null'
      );
    }
    if (fieldsToExtract.has("businessPurpose")) {
      jsonFields.push('  "businessPurpose": "string or null"');
    }
    if (fieldsToExtract.has("isBusinessExpense")) {
      jsonFields.push('  "isBusinessExpense": boolean or null');
    }

    const prompt = `Analyze this receipt image and extract the following information. The user is located in ${country}${
      province ? ` (${province})` : ""
    } and uses ${currency} currency. Return ONLY valid JSON, no markdown, no code blocks, no explanations.

${taxInstructions ? `${taxInstructions}\n\n` : ""}Required JSON format:
{
${jsonFields.join(",\n")}
}

Extract tax amounts separately if shown on the receipt. If tax is included in the total but not shown separately, use null for tax fields.
If you cannot determine a value, use null. Be precise with amounts as numbers.`;

    // Domain-specific logging - Gemini API call details (wrapper handles action-level logging)
    devLogger.debug("Calling Gemini API for receipt extraction", {
      userId: finalUserId,
      fieldsToExtract: Array.from(fieldsToExtract),
      country,
      currency,
    });

    const imageMimeType = getMimeType(imageUrl);
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: imageMimeType } },
    ]);

    let responseText = result.response.text().trim();

    // Remove markdown code blocks if present
    responseText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Try to extract JSON if wrapped in text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    const data = JSON.parse(responseText);

    // Create document record first
    const fileFormat = getFileFormat(imageUrl);
    const fileName = getFileName(imageUrl);
    const mimeType = getMimeType(imageUrl);

    const [document] = await db
      .insert(documents)
      .values({
        userId: finalUserId,
        documentType: "receipt",
        fileFormat,
        fileName,
        fileUrl: imageUrl,
        mimeType,
        status: "processing",
        extractionMethod: "ai_gemini",
        importBatchId: finalBatchId || null,
      })
      .returning();

    // Only create/update batch item if batchId is provided (batch import)
    if (finalBatchId) {
      const existingItem = await db
        .select()
        .from(importBatchItems)
        .where(
          and(
            eq(importBatchItems.batchId, finalBatchId),
            eq(importBatchItems.fileUrl, imageUrl)
          )
        )
        .limit(1);

      if (existingItem.length > 0) {
        // Update existing item
        const [updated] = await db
          .update(importBatchItems)
          .set({
            documentId: document.id,
            status: "processing",
          })
          .where(eq(importBatchItems.id, existingItem[0].id))
          .returning();
        batchItem = updated;
      } else {
        // Create new batch item
        const [newItem] = await db
          .insert(importBatchItems)
          .values({
            batchId: finalBatchId,
            documentId: document.id,
            fileName: fileName || "receipt",
            fileUrl: imageUrl,
            status: "processing",
            order: 0,
            retryCount: 0,
          })
          .returning();
        batchItem = newItem;
      }
    }

    // Apply user defaults for fields we didn't extract (or if extraction returned null)
    const paymentMethod = fieldsToExtract.has("paymentMethod")
      ? data.paymentMethod || defaultValues.paymentMethod || null
      : defaultValues.paymentMethod || null;

    const businessPurpose = fieldsToExtract.has("businessPurpose")
      ? data.businessPurpose || defaultValues.businessPurpose || null
      : defaultValues.businessPurpose || null;

    const isBusinessExpense = fieldsToExtract.has("isBusinessExpense")
      ? data.isBusinessExpense !== null && data.isBusinessExpense !== undefined
        ? data.isBusinessExpense
        : defaultValues.isBusinessExpense !== null &&
          defaultValues.isBusinessExpense !== undefined
        ? defaultValues.isBusinessExpense
        : null
      : defaultValues.isBusinessExpense !== null &&
        defaultValues.isBusinessExpense !== undefined
      ? defaultValues.isBusinessExpense
      : null;

    // Extract only fields we asked for, using defaults for others
    await db.insert(receipts).values({
      documentId: document.id,
      userId: finalUserId,
      imageUrl,
      merchantName: fieldsToExtract.has("merchantName")
        ? data.merchantName || null
        : null,
      date:
        fieldsToExtract.has("date") && data.date ? new Date(data.date) : null,
      totalAmount:
        fieldsToExtract.has("totalAmount") && data.totalAmount
          ? data.totalAmount.toString()
          : null,
      subtotal:
        fieldsToExtract.has("subtotal") && data.subtotal
          ? data.subtotal.toString()
          : null,
      taxAmount:
        fieldsToExtract.has("taxAmount") && data.taxAmount
          ? data.taxAmount.toString()
          : null,
      gstAmount:
        fieldsToExtract.has("gstAmount") && data.gstAmount
          ? data.gstAmount.toString()
          : null,
      hstAmount:
        fieldsToExtract.has("hstAmount") && data.hstAmount
          ? data.hstAmount.toString()
          : null,
      pstAmount:
        fieldsToExtract.has("pstAmount") && data.pstAmount
          ? data.pstAmount.toString()
          : null,
      salesTaxAmount:
        fieldsToExtract.has("salesTaxAmount") && data.salesTaxAmount
          ? data.salesTaxAmount.toString()
          : null,
      tipAmount:
        fieldsToExtract.has("tipAmount") && data.tipAmount
          ? data.tipAmount.toString()
          : null,
      discountAmount:
        fieldsToExtract.has("discountAmount") && data.discountAmount
          ? data.discountAmount.toString()
          : null,
      category: fieldsToExtract.has("category") ? data.category || null : null,
      description: fieldsToExtract.has("description")
        ? data.description || null
        : null,
      paymentMethod,
      businessPurpose,
      isBusinessExpense:
        isBusinessExpense !== null ? String(isBusinessExpense) : null,
      country,
      province,
      currency,
      status: "needs_review",
    });

    // Update document status after successful extraction
    await db
      .update(documents)
      .set({
        status: "extracted",
        extractedAt: new Date(),
      })
      .where(eq(documents.id, document.id));

    // Only update batch tracking if this is part of a batch import
    if (finalBatchId && batchItem) {
      // Update batch item status
      await db
        .update(importBatchItems)
        .set({
          status: "completed",
        })
        .where(eq(importBatchItems.id, batchItem.id));

      // Update batch counts
      const batch = await db
        .select()
        .from(importBatches)
        .where(eq(importBatches.id, finalBatchId))
        .limit(1);

      if (batch.length > 0) {
        const newProcessedFiles = (batch[0].processedFiles || 0) + 1;
        const newSuccessfulFiles = (batch[0].successfulFiles || 0) + 1;

        await db
          .update(importBatches)
          .set({
            processedFiles: newProcessedFiles,
            successfulFiles: newSuccessfulFiles,
            status:
              newProcessedFiles >= batch[0].totalFiles
                ? "completed"
                : "processing",
            completedAt:
              newProcessedFiles >= batch[0].totalFiles ? new Date() : null,
          })
          .where(eq(importBatches.id, finalBatchId));
      }
    }

    revalidatePath("/app");
    // Domain-specific logging - receipt scanning milestone (wrapper handles action-level logging)
    devLogger.receipt("new", "scanned_successfully", {
      userId: finalUserId,
      country,
      currency,
    });
    return { success: true };
  } catch (error) {
    // Only update batch tracking if this is part of a batch import
    if (finalBatchId && batchItem) {
      try {
        await db
          .update(importBatchItems)
          .set({
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(importBatchItems.id, batchItem.id));

        // Update batch failed count
        const batch = await db
          .select()
          .from(importBatches)
          .where(eq(importBatches.id, finalBatchId))
          .limit(1);

        if (batch.length > 0) {
          const newProcessedFiles = (batch[0].processedFiles || 0) + 1;
          const newFailedFiles = (batch[0].failedFiles || 0) + 1;

          await db
            .update(importBatches)
            .set({
              processedFiles: newProcessedFiles,
              failedFiles: newFailedFiles,
            })
            .where(eq(importBatches.id, finalBatchId));
        }
      } catch (batchError) {
        // Log but don't fail on batch update error
        devLogger.error("Failed to update batch on receipt scan error", {
          batchError,
          originalError: error,
        });
      }
    }

    // Error logging is handled by createSafeAction wrapper
    // Re-throw with user-friendly message
    throw new Error(
      `Failed to scan receipt: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Wrap with automatic logging
export const scanReceipt = createSafeAction("scanReceipt", scanReceiptHandler);
