import { z } from "zod";
import { aiClient } from "@/lib/ai/client";
import { devLogger } from "@/lib/dev-logger";
import type { TransactionToCategorize, CategorizationResult } from "./types";

const CategorizationSchema = z.object({
  categoryName: z.string(),
  confidence: z.number().min(0).max(1),
  isNewCategory: z.boolean(),
  reasoning: z.string().optional(),
});

export interface AICategorizeOptions {
  availableCategories: Array<{ id: string; name: string }>;
  userPreferences?: {
    country?: string | null;
    usageType?: string | null;
  };
}

/**
 * Use AI to categorize a transaction
 */
export async function aiCategorizeTransaction(
  transaction: TransactionToCategorize,
  options: AICategorizeOptions
): Promise<CategorizationResult> {
  const { availableCategories, userPreferences } = options;

  const categoryList = availableCategories.map((c) => c.name).join(", ");

  const prompt = `You are a financial categorization assistant. Categorize the following transaction into one of the available categories.

Transaction Details:
- Merchant: ${transaction.merchantName || "Unknown"}
- Description: ${transaction.description || "N/A"}
- Amount: ${transaction.amount || "N/A"}

Available Categories: ${categoryList}

${
  userPreferences?.country
    ? `User Location: ${userPreferences.country}\n`
    : ""
}${
    userPreferences?.usageType
      ? `Usage Type: ${userPreferences.usageType}\n`
      : ""
  }

Instructions:
1. Select the BEST matching category from the available list.
2. If none of the categories fit well, suggest a new category name and set isNewCategory to true.
3. Provide a confidence score (0.0 to 1.0).
4. Briefly explain your reasoning.

Return your response as JSON matching this schema:
{
  "categoryName": "string",
  "confidence": number,
  "isNewCategory": boolean,
  "reasoning": "string (optional)"
}`;

  try {
    const result = await aiClient.generateObject(prompt, CategorizationSchema, {
      temperature: 0.1,
    });

    if (!result.success || !result.data) {
      devLogger.warn("AI categorization failed", { error: result.error });
      return {
        categoryId: null,
        categoryName: null,
        confidence: 0,
        method: "none",
      };
    }

    const { categoryName, confidence, isNewCategory, reasoning } = result.data;

    devLogger.info("AI categorization completed", {
      merchantName: transaction.merchantName,
      categoryName,
      confidence,
      isNewCategory,
      reasoning,
    });

    // Find the category ID if it exists
    let categoryId: string | null = null;
    if (!isNewCategory) {
      const matchedCategory = availableCategories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      categoryId = matchedCategory?.id || null;
    }

    return {
      categoryId,
      categoryName,
      confidence,
      method: "ai",
      suggestedCategory: isNewCategory ? categoryName : undefined,
    };
  } catch (error) {
    devLogger.error("AI categorization error", {
      error,
      merchantName: transaction.merchantName,
    });
    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      method: "none",
    };
  }
}

/**
 * Batch categorize multiple transactions
 */
export async function aiBatchCategorizeTransactions(
  transactions: TransactionToCategorize[],
  options: AICategorizeOptions
): Promise<CategorizationResult[]> {
  // For now, we'll call AI for each transaction individually
  // In the future, we could optimize this with a batch prompt
  const results: CategorizationResult[] = [];

  for (const transaction of transactions) {
    const result = await aiCategorizeTransaction(transaction, options);
    results.push(result);
  }

  return results;
}

