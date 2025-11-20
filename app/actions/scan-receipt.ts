"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getUserSettings } from "./user-settings";

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

export async function scanReceipt(imageUrl: string, userId?: string) {
  const authResult = userId ? { userId } : await auth();
  const finalUserId = userId || authResult.userId;
  if (!finalUserId) throw new Error("Unauthorized");

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
    const mimeType = getMimeType(imageUrl);

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

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType } },
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

    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    console.error("Error scanning receipt:", error);
    throw new Error(
      `Failed to scan receipt: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
