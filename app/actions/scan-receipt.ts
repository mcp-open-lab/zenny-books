'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

function getMimeType(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return mimeTypes[extension || ''] || 'image/jpeg';
}

export async function scanReceipt(imageUrl: string, userId?: string) {
  const authResult = userId ? { userId } : await auth();
  const finalUserId = userId || authResult.userId;
  if (!finalUserId) throw new Error("Unauthorized");

  try {
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
      throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    }

    const imageBuffer = await imageResp.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const mimeType = getMimeType(imageUrl);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Analyze this receipt image and extract the following information. Return ONLY valid JSON, no markdown, no code blocks, no explanations.

Required JSON format:
{
  "merchantName": "string or null",
  "date": "ISO 8601 date string (YYYY-MM-DD) or null",
  "totalAmount": number or null,
  "taxAmount": number or null,
  "category": "Food" | "Transport" | "Utilities" | "Supplies" | "Other" or null
}

Extract the tax amount separately if shown on the receipt. If tax is included in the total but not shown separately, use null for taxAmount.
If you cannot determine a value, use null. Be precise with amounts as numbers.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType } }
    ]);

    let responseText = result.response.text().trim();
    
    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to extract JSON if wrapped in text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    const data = JSON.parse(responseText);

    await db.insert(receipts).values({
      userId: finalUserId,
      imageUrl,
      merchantName: data.merchantName || null,
      date: data.date ? new Date(data.date) : null,
      totalAmount: data.totalAmount ? data.totalAmount.toString() : null,
      taxAmount: data.taxAmount ? data.taxAmount.toString() : null,
      category: data.category || null,
      status: 'needs_review'
    });

    revalidatePath("/app");
    return { success: true };
  } catch (error) {
    console.error("Error scanning receipt:", error);
    throw new Error(`Failed to scan receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

