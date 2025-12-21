import { z } from "zod";
import { generateObjectForCategorization } from "@/lib/ai/client";
import { devLogger } from "@/lib/dev-logger";
import type { TransactionToCategorize, CategorizationResult } from "./types";
import { CategorizationPrompt } from "@/lib/ai/prompts";
import { AI_TEMPERATURES } from "@/lib/constants";

const CategorizationSchema = z.object({
  categoryName: z.string(),
  confidence: z.number().min(0).max(1),
  isNewCategory: z.boolean(),
  isBusinessExpense: z.boolean(),
  businessId: z.string().nullable(),
  businessName: z.string().nullable(),
});

export interface AICategorizeOptions {
  availableCategories: Array<{ id: string; name: string }>;
  userId?: string; // For logging
  transactionId?: string; // For logging
  userPreferences?: {
    country?: string | null;
    usageType?: string | null;
  };
  userBusinesses?: Array<{ id: string; name: string }>; // User's businesses for classification
  transactionType?: "income" | "expense"; // Transaction type for prompt context
}

/**
 * Use AI to categorize a transaction
 */
export async function aiCategorizeTransaction(
  transaction: TransactionToCategorize,
  options: AICategorizeOptions
): Promise<CategorizationResult> {
  const { availableCategories, userPreferences, userBusinesses, transactionType } = options;

  const prompt = CategorizationPrompt.build({
    merchantName: transaction.merchantName ?? null,
    description: transaction.description ?? null,
    amount: transaction.amount ?? null,
    availableCategories,
    userPreferences,
    userBusinesses,
    statementType: transaction.statementType ?? null,
    transactionType,
  });

  try {
    const result = await generateObjectForCategorization(prompt, CategorizationSchema, {
      temperature: AI_TEMPERATURES.STRUCTURED_OUTPUT,
      loggingContext: options.userId
        ? {
            userId: options.userId,
            entityId: options.transactionId || null,
            entityType: "transaction",
            promptType: "categorization",
            inputData: {
              merchantName: transaction.merchantName,
              description: transaction.description,
              amount: transaction.amount,
              categoryCount: availableCategories.length,
            },
          }
        : undefined,
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

    const { categoryName, confidence, isNewCategory, isBusinessExpense, businessId, businessName } = result.data;

    devLogger.info("AI categorization completed", {
      merchantName: transaction.merchantName,
      categoryName,
      confidence,
      isNewCategory,
      isBusinessExpense,
      businessId,
      businessName,
    });

    // Find the category ID if it exists
    let categoryId: string | null = null;
    if (!isNewCategory) {
      const matchedCategory = availableCategories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      categoryId = matchedCategory?.id || null;
    }

    // Validate businessId if provided
    let validatedBusinessId: string | null = null;
    if (isBusinessExpense && businessId && userBusinesses) {
      const matchedBusiness = userBusinesses.find((b) => b.id === businessId);
      if (matchedBusiness) {
        validatedBusinessId = businessId;
        devLogger.debug("AI matched business", {
          businessId,
          businessName: matchedBusiness.name,
        });
      } else {
        devLogger.warn("AI returned invalid businessId", {
          businessId,
          businessName,
          availableBusinesses: userBusinesses.map((b) => b.id),
        });
      }
    }

    return {
      categoryId,
      categoryName,
      confidence,
      method: "ai",
      suggestedCategory: isNewCategory ? categoryName : undefined,
      isBusinessExpense,
      businessId: validatedBusinessId,
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

