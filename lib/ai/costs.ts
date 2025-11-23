/**
 * LLM Cost Calculation
 * Pricing per 1M tokens (as of 2025-11-23)
 */

import type { LLMProvider } from "./types";

// Pricing per 1M tokens (USD)
export const MODEL_PRICING = {
  "gpt-4o-mini": {
    input: 0.15, // $0.15 per 1M input tokens
    output: 0.6, // $0.60 per 1M output tokens
  },
  "gemini-2.0-flash": {
    input: 0.1, // $0.10 per 1M input tokens (GA pricing as of Nov 2025)
    output: 0.4, // $0.40 per 1M output tokens (GA pricing as of Nov 2025)
  },
} as const;

export type ModelName = keyof typeof MODEL_PRICING;

/**
 * Calculate cost in USD for an LLM request
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model as ModelName];

  if (!pricing) {
    // Unknown model - return 0 cost but log warning
    console.warn(`Unknown model for cost calculation: ${model}`);
    return 0;
  }

  // Cost = (input_tokens / 1M * input_price) + (output_tokens / 1M * output_price)
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Get pricing info for a model
 */
export function getModelPricing(model: string) {
  return MODEL_PRICING[model as ModelName] || null;
}

/**
 * Estimate cost for a request before making it
 * (useful for displaying estimates to users)
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): {
  cost: number;
  inputCost: number;
  outputCost: number;
} {
  const pricing = MODEL_PRICING[model as ModelName];

  if (!pricing) {
    return { cost: 0, inputCost: 0, outputCost: 0 };
  }

  const inputCost = (estimatedInputTokens / 1_000_000) * pricing.input;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output;

  return {
    cost: inputCost + outputCost,
    inputCost,
    outputCost,
  };
}

/**
 * Format cost for display
 */
export function formatCost(costUsd: number): string {
  if (costUsd === 0) return "$0.00";
  if (costUsd < 0.01) return `$${costUsd.toFixed(4)}`;
  return `$${costUsd.toFixed(2)}`;
}
