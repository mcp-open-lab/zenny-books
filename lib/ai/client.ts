import { z } from "zod";
import { generateObject as aiGenerateObject, generateText as aiGenerateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel, UserContent } from "ai";
import type { LLMResponse, CompletionOptions, LLMProvider } from "./types";
import { devLogger } from "@/lib/dev-logger";
import { logLLMInteraction } from "./logger";

interface ModelConfig {
  model: LanguageModel;
  provider: LLMProvider;
  modelName: string;
}

function getGeminiModel(): ModelConfig | null {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  return {
    model: google("gemini-2.0-flash"),
    provider: "gemini",
    modelName: "gemini-2.0-flash",
  };
}

function getOpenAIModel(): ModelConfig | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return {
    model: openai("gpt-4o"),
    provider: "openai",
    modelName: "gpt-4o",
  };
}

function getOpenAIMiniModel(): ModelConfig | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return {
    model: openai("gpt-4o-mini"),
    provider: "openai",
    modelName: "gpt-4o-mini",
  };
}

function buildUserContent(prompt: string, options?: CompletionOptions): UserContent {
  if (!options?.image) {
    return prompt;
  }

  const isPdf = options.image.mimeType === "application/pdf";

  if (isPdf) {
    return [
      { type: "text", text: prompt },
      {
        type: "file",
        data: options.image.data,
        mediaType: options.image.mimeType,
      },
    ];
  }

  return [
    { type: "text", text: prompt },
    {
      type: "image",
      image: options.image.data,
      mediaType: options.image.mimeType,
    },
  ];
}

interface SDKResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

async function callGenerateObject<T>(
  config: ModelConfig,
  schema: z.ZodSchema<T>,
  prompt: string,
  options?: CompletionOptions
): Promise<SDKResult<T>> {
  try {
    const result = await aiGenerateObject({
      model: config.model,
      schema,
      messages: [{ role: "user", content: buildUserContent(prompt, options) }],
      temperature: options?.temperature ?? 0.1,
      maxOutputTokens: options?.maxTokens ?? 2048,
    });

    return {
      success: true,
      data: result.object,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function callGenerateText(
  config: ModelConfig,
  prompt: string,
  options?: CompletionOptions
): Promise<SDKResult<string>> {
  try {
    const result = await aiGenerateText({
      model: config.model,
      messages: [{ role: "user", content: buildUserContent(prompt, options) }],
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 2048,
    });

    return {
      success: true,
      data: result.text,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
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
  const gemini = getGeminiModel();

  if (gemini) {
    devLogger.info("Attempting categorization with Gemini", {
      context: { provider: "gemini" },
    });

    const result = await callGenerateObject(gemini, schema, prompt, options);
    const durationMs = Date.now() - startTime;

    if (result.success && result.data !== undefined) {
      devLogger.info("Gemini categorization successful", {
        context: { tokensUsed: result.totalTokens },
      });

      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: gemini.provider,
          model: gemini.modelName,
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return {
        success: true,
        data: result.data,
        provider: gemini.provider,
        tokensUsed: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: gemini.modelName,
        durationMs,
      };
    }

    devLogger.warn("Gemini categorization failed, attempting fallback to OpenAI", {
      context: { error: result.error },
    });
  }

  const openaiConfig = getOpenAIModel();

  if (openaiConfig) {
    devLogger.info("Attempting categorization with OpenAI", {
      context: { provider: "openai" },
    });

    const result = await callGenerateObject(openaiConfig, schema, prompt, options);
    const durationMs = Date.now() - startTime;

    if (result.success && result.data !== undefined) {
      devLogger.info("OpenAI categorization successful", {
        context: { tokensUsed: result.totalTokens },
      });

      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: openaiConfig.provider,
          model: openaiConfig.modelName,
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return {
        success: true,
        data: result.data,
        provider: openaiConfig.provider,
        tokensUsed: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: openaiConfig.modelName,
        durationMs,
      };
    }

    devLogger.error("OpenAI categorization failed", {
      context: { error: result.error },
    });

    if (options?.loggingContext) {
      await logLLMInteraction({
        ...options.loggingContext,
        provider: openaiConfig.provider,
        model: openaiConfig.modelName,
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        durationMs,
        inputJson: options.loggingContext.inputData,
        status: "failed",
        errorMessage: result.error,
      });
    }
  }

  return {
    success: false,
    error: "No LLM providers available. Please configure GOOGLE_AI_API_KEY or OPENAI_API_KEY.",
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
  const isPdf = options?.image?.mimeType === "application/pdf";

  if (isPdf) {
    const gemini = getGeminiModel();

    if (gemini) {
      devLogger.info("Attempting PDF extraction with Gemini (OpenAI doesn't support PDFs)", {
        context: { provider: "gemini" },
      });

      const result = await callGenerateObject(gemini, schema, prompt, options);
      const durationMs = Date.now() - startTime;

      if (result.success && result.data !== undefined) {
        devLogger.info("Gemini PDF extraction successful", {
          context: { tokensUsed: result.totalTokens },
        });

        if (options?.loggingContext) {
          await logLLMInteraction({
            ...options.loggingContext,
            provider: gemini.provider,
            model: gemini.modelName,
            inputTokens: result.inputTokens || 0,
            outputTokens: result.outputTokens || 0,
            durationMs,
            inputJson: options.loggingContext.inputData,
            outputJson: result.data,
            status: "success",
          });
        }

        return {
          success: true,
          data: result.data,
          provider: gemini.provider,
          tokensUsed: result.totalTokens,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          model: gemini.modelName,
          durationMs,
        };
      }

      devLogger.error("Gemini PDF extraction failed", {
        context: { error: result.error },
      });

      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: gemini.provider,
          model: gemini.modelName,
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs,
          inputJson: options.loggingContext.inputData,
          status: "failed",
          errorMessage: result.error,
        });
      }

      return {
        success: false,
        error: result.error || "Gemini PDF extraction failed",
        provider: gemini.provider,
      };
    }

    return {
      success: false,
      error: "PDF extraction requires Gemini. Please configure GOOGLE_AI_API_KEY.",
      provider: "gemini",
    };
  }

  const openaiMini = getOpenAIMiniModel();

  if (openaiMini) {
    devLogger.info("Attempting extraction with GPT-4o-mini", {
      context: { provider: "openai", model: "gpt-4o-mini" },
    });

    const result = await callGenerateObject(openaiMini, schema, prompt, options);

    if (result.success && result.data !== undefined) {
      const durationMs = Date.now() - startTime;
      devLogger.info("GPT-4o-mini extraction successful", {
        context: { tokensUsed: result.totalTokens },
      });

      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: openaiMini.provider,
          model: openaiMini.modelName,
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return {
        success: true,
        data: result.data,
        provider: openaiMini.provider,
        tokensUsed: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: openaiMini.modelName,
        durationMs,
      };
    }

    devLogger.warn("GPT-4o-mini extraction failed, attempting fallback to GPT-4o", {
      context: { error: result.error },
    });
  }

  const openaiConfig = getOpenAIModel();

  if (openaiConfig) {
    devLogger.info("Attempting extraction with GPT-4o", {
      context: { provider: "openai", model: "gpt-4o" },
    });

    const result = await callGenerateObject(openaiConfig, schema, prompt, options);
    const durationMs = Date.now() - startTime;

    if (result.success && result.data !== undefined) {
      devLogger.info("GPT-4o extraction successful", {
        context: { tokensUsed: result.totalTokens },
      });

      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: openaiConfig.provider,
          model: openaiConfig.modelName,
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return {
        success: true,
        data: result.data,
        provider: openaiConfig.provider,
        tokensUsed: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: openaiConfig.modelName,
        durationMs,
      };
    }

    devLogger.error("GPT-4o extraction failed", {
      context: { error: result.error },
    });

    if (options?.loggingContext) {
      await logLLMInteraction({
        ...options.loggingContext,
        provider: openaiConfig.provider,
        model: openaiConfig.modelName,
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        durationMs,
        inputJson: options.loggingContext.inputData,
        status: "failed",
        errorMessage: result.error,
      });
    }

    return {
      success: false,
      error: result.error || "GPT-4o extraction failed",
      provider: openaiConfig.provider,
    };
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
  const openaiConfig = getOpenAIModel();

  if (openaiConfig) {
    devLogger.info("Attempting LLM request with OpenAI", {
      context: { provider: "openai" },
    });

    const result = await callGenerateObject(openaiConfig, schema, prompt, options);

    if (result.success && result.data !== undefined) {
      const durationMs = Date.now() - startTime;
      devLogger.info("OpenAI request successful", {
        context: { tokensUsed: result.totalTokens },
      });

      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: openaiConfig.provider,
          model: openaiConfig.modelName,
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return {
        success: true,
        data: result.data,
        provider: openaiConfig.provider,
        tokensUsed: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: openaiConfig.modelName,
        durationMs,
      };
    }

    devLogger.warn("OpenAI request failed, attempting fallback to Gemini", {
      context: { error: result.error },
    });
  }

  const gemini = getGeminiModel();

  if (gemini) {
    devLogger.info("Attempting LLM request with Gemini", {
      context: { provider: "gemini" },
    });

    const result = await callGenerateObject(gemini, schema, prompt, options);
    const durationMs = Date.now() - startTime;

    if (result.success && result.data !== undefined) {
      devLogger.info("Gemini request successful", {
        context: { tokensUsed: result.totalTokens },
      });

      if (options?.loggingContext) {
        await logLLMInteraction({
          ...options.loggingContext,
          provider: gemini.provider,
          model: gemini.modelName,
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          durationMs,
          inputJson: options.loggingContext.inputData,
          outputJson: result.data,
          status: "success",
        });
      }

      return {
        success: true,
        data: result.data,
        provider: gemini.provider,
        tokensUsed: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: gemini.modelName,
        durationMs,
      };
    }

    devLogger.error("Gemini request failed", {
      context: { error: result.error },
    });

    if (options?.loggingContext) {
      await logLLMInteraction({
        ...options.loggingContext,
        provider: gemini.provider,
        model: gemini.modelName,
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        durationMs,
        inputJson: options.loggingContext.inputData,
        status: "failed",
        errorMessage: result.error,
      });
    }

    return {
      success: false,
      error: result.error || "Gemini request failed",
      provider: gemini.provider,
    };
  }

  return {
    success: false,
    error: "No LLM providers available. Please configure GOOGLE_AI_API_KEY or OPENAI_API_KEY.",
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
  const gemini = getGeminiModel();

  if (gemini) {
    devLogger.info("Attempting LLM text generation with Gemini", {
      context: { provider: "gemini" },
    });

    const result = await callGenerateText(gemini, prompt, options);

    if (result.success && result.data !== undefined) {
      devLogger.info("Gemini text generation successful", {
        context: { tokensUsed: result.totalTokens },
      });

      return {
        success: true,
        data: result.data,
        provider: gemini.provider,
        tokensUsed: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: gemini.modelName,
      };
    }

    devLogger.warn("Gemini text generation failed, attempting fallback to OpenAI", {
      context: { error: result.error },
    });
  }

  const openaiConfig = getOpenAIModel();

  if (openaiConfig) {
    devLogger.info("Attempting LLM text generation with OpenAI", {
      context: { provider: "openai" },
    });

    const result = await callGenerateText(openaiConfig, prompt, options);

    if (result.success && result.data !== undefined) {
      devLogger.info("OpenAI text generation successful", {
        context: { tokensUsed: result.totalTokens },
      });

      return {
        success: true,
        data: result.data,
        provider: openaiConfig.provider,
        tokensUsed: result.totalTokens,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: openaiConfig.modelName,
      };
    }

    devLogger.error("OpenAI text generation failed", {
      context: { error: result.error },
    });

    return {
      success: false,
      error: result.error || "OpenAI text generation failed",
      provider: openaiConfig.provider,
    };
  }

  return {
    success: false,
    error: "No LLM providers available. Please configure GOOGLE_AI_API_KEY or OPENAI_API_KEY.",
    provider: "gemini",
  };
}
