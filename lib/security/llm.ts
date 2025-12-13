"use server";

import { z } from "zod";
import { ValidationError } from "@/lib/errors";

/**
 * Enforce that a model response is valid JSON and matches the schema.
 */
export function enforceJsonOutput<T>(
  rawText: string,
  schema: z.ZodSchema<T>
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (_error) {
    throw new ValidationError(
      "LLM did not return valid JSON",
      "Invalid AI response"
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(
      `LLM JSON validation failed: ${result.error.message}`,
      "AI response could not be validated"
    );
  }

  return result.data;
}

/**
 * Basic sanitizer to keep prompts lean and avoid leaking PII.
 * Extend as needed for stricter redaction rules.
 */
export function sanitizeForPrompt(value: string): string {
  return value.trim();
}
