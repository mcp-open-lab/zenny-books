/**
 * LLM Logging Service
 * Persists LLM interactions to database for cost tracking and quality analysis
 */

import { db } from "@/lib/db";
import { llmLogs } from "@/lib/db/schema";
import { calculateCost } from "./costs";
import type { LLMProvider } from "./types";
import { devLogger } from "@/lib/dev-logger";
import type { EntityType, PromptType, LlmLogStatus } from "@/lib/constants";

export interface LogLLMInteractionParams {
  userId: string;
  entityId?: string | null;
  entityType?: EntityType | null;
  provider: LLMProvider;
  model: string;
  promptType: PromptType;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  inputJson?: any;
  outputJson?: any;
  status: LlmLogStatus;
  errorMessage?: string;
}

/**
 * Log an LLM interaction to the database
 * This is fire-and-forget - errors are logged but don't throw
 */
export async function logLLMInteraction(
  params: LogLLMInteractionParams
): Promise<void> {
  try {
    const {
      userId,
      entityId,
      entityType,
      provider,
      model,
      promptType,
      inputTokens,
      outputTokens,
      durationMs,
      inputJson,
      outputJson,
      status,
      errorMessage,
    } = params;

    const totalTokens = inputTokens + outputTokens;
    const costUsd = calculateCost(model, inputTokens, outputTokens);

    await db.insert(llmLogs).values({
      userId,
      entityId: entityId || null,
      entityType: entityType || null,
      provider,
      model,
      promptType,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd: costUsd.toString(), // Decimal stored as string
      durationMs,
      inputJson: inputJson ? JSON.stringify(inputJson) : null,
      outputJson: outputJson ? JSON.stringify(outputJson) : null,
      status,
      errorMessage: errorMessage || null,
    });

    devLogger.debug("LLM interaction logged", {
      provider,
      model,
      promptType,
      totalTokens,
      costUsd: costUsd.toFixed(6),
      status,
    });
  } catch (error) {
    // Don't throw - logging failures shouldn't break the app
    devLogger.error("Failed to log LLM interaction", {
      error: error instanceof Error ? error.message : String(error),
      provider: params.provider,
      model: params.model,
    });
  }
}

/**
 * Get usage stats for a user (for billing/limits)
 */
export async function getUserUsageStats() {
  // This will be implemented when needed for usage limits
  // For now, returning a placeholder
  return {
    totalCost: 0,
    totalTokens: 0,
    requestCount: 0,
  };
}

