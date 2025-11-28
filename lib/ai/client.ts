import { z } from "zod";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import type { LLMResponse, CompletionOptions } from "./types";
import { devLogger } from "@/lib/dev-logger";
import { logLLMInteraction } from "./logger";

let geminiProvider: GeminiProvider | null = null;
let openaiProvider: OpenAIProvider | null = null;
let openaiMiniProvider: OpenAIProvider | null = null;

function getGeminiProvider(): GeminiProvider | null {
  if (!geminiProvider && process.env.GOOGLE_AI_API_KEY) {
    geminiProvider = new GeminiProvider(process.env.GOOGLE_AI_API_KEY);
  }
  return geminiProvider;
}

function getOpenAIProvider(): OpenAIProvider | null {
  if (!openaiProvider && process.env.OPENAI_API_KEY) {
    openaiProvider = new OpenAIProvider(process.env.OPENAI_API_KEY);
  }
  return openaiProvider;
}

function getOpenAIMiniProvider(): OpenAIProvider | null {
  if (!openaiMiniProvider && process.env.OPENAI_API_KEY) {
    openaiMiniProvider = new OpenAIProvider(
      process.env.OPENAI_API_KEY,
      "gpt-4o-mini"
    );
  }
  return openaiMiniProvider;
}

/**
 * Generate structured object output from LLM with Gemini primary (for categorization)
 * Uses Gemini Flash (free) as primary, OpenAI as fallback
 */
export async function generateObjectForCategorization<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: CompletionOptions
): Promise<LLMResponse<T>> {
  const startTime = Date.now();
  const gemini = getGeminiProvider();

  if (gemini) {
    devLogger.info("Attempting categorization with Gemini", {
      context: { provider: "gemini" },
    });

    const result = await gemini.generateObject(prompt, schema, options);
    const durationMs = Date.now() - startTime;

    if (result.success) {
      devLogger.info("Gemini categorization successful", {
        context: { tokensUsed: result.tokensUsed },
      });

      // Log interaction if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "unknown",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return result;
    }

    devLogger.warn(
      "Gemini categorization failed, attempting fallback to OpenAI",
      {
        context: { error: result.error },
      }
    );
  }

  const openai = getOpenAIProvider();

  if (openai) {
    devLogger.info("Attempting categorization with OpenAI", {
      context: { provider: "openai" },
    });

    const result = await openai.generateObject(prompt, schema, options);

    if (result.success) {
      const durationMs = Date.now() - startTime;
      devLogger.info("OpenAI categorization successful", {
        context: { tokensUsed: result.tokensUsed },
      });

      // Log interaction if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "unknown",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return result;
    }

    devLogger.error("OpenAI categorization failed", {
      context: { error: result.error },
    });

    // Log failure if context provided
    if (options?.loggingContext) {
      await logLLMInteraction({
        ...options.loggingContext,
        provider: result.provider,
        model: result.model || "unknown",
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        durationMs: result.durationMs || Date.now() - startTime,
        inputJson: options.loggingContext.inputData,
        status: "failed",
        errorMessage: result.error,
      });
    }
  }

  return {
    success: false,
    error:
      "No LLM providers available. Please configure GOOGLE_AI_API_KEY or OPENAI_API_KEY.",
    provider: "gemini",
  };
}

/**
 * Generate structured object output from LLM with GPT-4o-mini primary (for extraction)
 * Uses GPT-4o-mini (cheaper) as primary, GPT-4o as fallback
 * For PDFs, uses Gemini (OpenAI doesn't support PDFs)
 */
export async function generateObjectForExtraction<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: CompletionOptions
): Promise<LLMResponse<T>> {
  const startTime = Date.now();
  
  // Check if input is a PDF - OpenAI doesn't support PDFs, use Gemini instead
  const isPdf = options?.image?.mimeType === "application/pdf";
  
  if (isPdf) {
    const gemini = getGeminiProvider();
    
    if (gemini) {
      devLogger.info("Attempting PDF extraction with Gemini (OpenAI doesn't support PDFs)", {
        context: { provider: "gemini" },
      });

      const result = await gemini.generateObject(prompt, schema, options);
      const durationMs = Date.now() - startTime;

      if (result.success) {
        devLogger.info("Gemini PDF extraction successful", {
          context: { tokensUsed: result.tokensUsed },
        });

        // Log interaction if context provided
        if (options?.loggingContext) {
          await logLLMInteraction({
            ...options.loggingContext,
            provider: result.provider,
            model: result.model || "unknown",
            inputTokens: result.inputTokens || 0,
            outputTokens: result.outputTokens || 0,
            durationMs: result.durationMs || durationMs,
            inputJson: options.loggingContext.inputData,
            outputJson: result.data,
            status: "success",
          });
        }

        return result;
      }

      devLogger.error("Gemini PDF extraction failed", {
        context: { error: result.error },
      });

      // Log failure if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "unknown",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          status: "failed",
          errorMessage: result.error,
        });
      }

      return result;
    }

    return {
      success: false,
      error: "PDF extraction requires Gemini. Please configure GOOGLE_AI_API_KEY.",
      provider: "gemini",
    };
  }

  const openaiMini = getOpenAIMiniProvider();

  if (openaiMini) {
    devLogger.info("Attempting extraction with GPT-4o-mini", {
      context: { provider: "openai", model: "gpt-4o-mini" },
    });

    const result = await openaiMini.generateObject(prompt, schema, options);

    if (result.success) {
      const durationMs = Date.now() - startTime;
      devLogger.info("GPT-4o-mini extraction successful", {
        context: { tokensUsed: result.tokensUsed },
      });

      // Log interaction if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "gpt-4o-mini",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return result;
    }

    devLogger.warn(
      "GPT-4o-mini extraction failed, attempting fallback to GPT-4o",
      {
        context: { error: result.error },
      }
    );
  }

  const openai = getOpenAIProvider();

  if (openai) {
    devLogger.info("Attempting extraction with GPT-4o", {
      context: { provider: "openai", model: "gpt-4o" },
    });

    const result = await openai.generateObject(prompt, schema, options);
    const durationMs = Date.now() - startTime;

    if (result.success) {
      devLogger.info("GPT-4o extraction successful", {
        context: { tokensUsed: result.tokensUsed },
      });

      // Log interaction if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "gpt-4o",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }
    } else {
      devLogger.error("GPT-4o extraction failed", {
        context: { error: result.error },
      });

      // Log failure if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "gpt-4o",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          status: "failed",
          errorMessage: result.error,
        });
      }
    }

    return result;
  }

  return {
    success: false,
    error: "No LLM providers available. Please configure OPENAI_API_KEY.",
    provider: "openai",
  };
}

/**
 * Generate structured object output from LLM with OpenAI primary and Gemini fallback
 * OpenAI works better with Zod schemas via zodResponseFormat (strict mode)
 * For categorization, use generateObjectForCategorization
 * For extraction, use generateObjectForExtraction
 */
export async function generateObject<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: CompletionOptions
): Promise<LLMResponse<T>> {
  const startTime = Date.now();
  const openai = getOpenAIProvider();

  if (openai) {
    devLogger.info("Attempting LLM request with OpenAI", {
      context: { provider: "openai" },
    });

    const result = await openai.generateObject(prompt, schema, options);

    if (result.success) {
      const durationMs = Date.now() - startTime;
      devLogger.info("OpenAI request successful", {
        context: { tokensUsed: result.tokensUsed },
      });

      // Log interaction if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "unknown",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return result;
    }

    devLogger.warn("OpenAI request failed, attempting fallback to Gemini", {
      context: { error: result.error },
    });
  }

  const gemini = getGeminiProvider();

  if (gemini) {
    devLogger.info("Attempting LLM request with Gemini", {
      context: { provider: "gemini" },
    });

    const result = await gemini.generateObject(prompt, schema, options);
    const durationMs = Date.now() - startTime;

    if (result.success) {
      devLogger.info("Gemini request successful", {
        context: { tokensUsed: result.tokensUsed },
      });

      // Log interaction if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "unknown",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }
    } else {
      devLogger.error("Gemini request failed", {
        context: { error: result.error },
      });

      // Log failure if context provided
      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: result.provider,
          model: result.model || "unknown",
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs: result.durationMs || durationMs,
          inputJson: options.loggingContext.inputData,
          status: "failed",
          errorMessage: result.error,
        });
      }
    }

    return result;
  }

  return {
    success: false,
    error:
      "No LLM providers available. Please configure GOOGLE_AI_API_KEY or OPENAI_API_KEY.",
    provider: "openai",
  };
}

/**
 * Generate text output from LLM with Gemini primary and OpenAI fallback
 * Note: For structured outputs, use generateObject (OpenAI primary)
 */
export async function generateText(
  prompt: string,
  options?: CompletionOptions
): Promise<LLMResponse<string>> {
  const gemini = getGeminiProvider();

  if (gemini) {
    devLogger.info("Attempting LLM text generation with Gemini", {
      context: { provider: "gemini" },
    });

    const result = await gemini.generateText(prompt, options);

    if (result.success) {
      devLogger.info("Gemini text generation successful", {
        context: { tokensUsed: result.tokensUsed },
      });
      return result;
    }

    devLogger.warn(
      "Gemini text generation failed, attempting fallback to OpenAI",
      {
        context: { error: result.error },
      }
    );
  }

  const openai = getOpenAIProvider();

  if (openai) {
    devLogger.info("Attempting LLM text generation with OpenAI", {
      context: { provider: "openai" },
    });

    const result = await openai.generateText(prompt, options);

    if (result.success) {
      devLogger.info("OpenAI text generation successful", {
        context: { tokensUsed: result.tokensUsed },
      });
    } else {
      devLogger.error("OpenAI text generation failed", {
        context: { error: result.error },
      });
    }

    return result;
  }

  return {
    success: false,
    error:
      "No LLM providers available. Please configure GOOGLE_AI_API_KEY or OPENAI_API_KEY.",
    provider: "gemini",
  };
}
