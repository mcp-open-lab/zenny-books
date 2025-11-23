import { z } from "zod";

export type LLMProvider = "gemini" | "openai";

export interface LoggingContext {
  userId: string;
  entityId?: string | null;
  entityType?: "receipt" | "transaction" | "batch" | "document" | null;
  promptType: "extraction" | "categorization" | "mapping";
  inputData?: any; // For storing in inputJson
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
  image?: {
    data: string; // base64 encoded
    mimeType: string;
  };
  loggingContext?: LoggingContext;
}

export interface LLMResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  provider: LLMProvider;
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  durationMs?: number;
}

export interface LLMProviderInterface {
  generateObject<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: CompletionOptions
  ): Promise<LLMResponse<T>>;
  
  generateText(
    prompt: string,
    options?: CompletionOptions
  ): Promise<LLMResponse<string>>;
}

