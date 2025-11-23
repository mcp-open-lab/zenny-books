import { z } from "zod";
import { generateObject } from "@/lib/ai/client";
import { devLogger } from "@/lib/dev-logger";
import type { TransactionToCategorize, CategorizationResult } from "./types";
import { CategorizationPrompt } from "@/lib/ai/prompts";
import { AI_TEMPERATURES } from "@/lib/ai/constants";

const CategorizationSchema = z.object({
  categoryName: z.string(),
  confidence: z.number().min(0).max(1),
  isNewCategory: z.boolean(),
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

  const prompt = CategorizationPrompt.build({
    merchantName: transaction.merchantName ?? null,
    description: transaction.description ?? null,
    amount: transaction.amount ?? null,
    availableCategories,
    userPreferences,
  });

  try {
    const result = await generateObject(prompt, CategorizationSchema, {
      temperature: AI_TEMPERATURES.STRUCTURED_OUTPUT,
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

    const { categoryName, confidence, isNewCategory } = result.data;

    devLogger.info("AI categorization completed", {
      merchantName: transaction.merchantName,
      categoryName,
      confidence,
      isNewCategory,
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

