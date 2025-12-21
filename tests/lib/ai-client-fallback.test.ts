import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// Mock the Vercel AI SDK
const mockGenerateObject = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: (model: string) => ({ provider: "openai", modelId: model }),
}));

vi.mock("@ai-sdk/google", () => ({
  google: (model: string) => ({ provider: "google", modelId: model }),
}));

describe("AI Client Fallback Logic", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockGenerateObject.mockClear();
    mockGenerateText.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("generateObject", () => {
    it("should use OpenAI when available and successful", async () => {
      process.env.OPENAI_API_KEY = "test-openai-key";
      delete process.env.GOOGLE_AI_API_KEY;

      mockGenerateObject.mockResolvedValue({
        object: { test: "value" },
        usage: { inputTokens: 50, outputTokens: 50 },
      });

      const { generateObject } = await import("@/lib/ai/client");
      const schema = z.object({ test: z.string() });
      const result = await generateObject("test prompt", schema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ test: "value" });
      expect(result.provider).toBe("openai");
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    });

    it("should fallback to Gemini when OpenAI fails", async () => {
      process.env.OPENAI_API_KEY = "test-openai-key";
      process.env.GOOGLE_AI_API_KEY = "test-gemini-key";

      let callCount = 0;
      mockGenerateObject.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("OpenAI rate limit");
        }
        return Promise.resolve({
          object: { test: "value" },
          usage: { inputTokens: 25, outputTokens: 25 },
        });
      });

      const { generateObject } = await import("@/lib/ai/client");
      const schema = z.object({ test: z.string() });
      const result = await generateObject("test prompt", schema);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("gemini");
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });

    it("should return error when both providers fail", async () => {
      process.env.OPENAI_API_KEY = "test-openai-key";
      process.env.GOOGLE_AI_API_KEY = "test-gemini-key";

      mockGenerateObject.mockRejectedValue(new Error("Provider error"));

      const { generateObject } = await import("@/lib/ai/client");
      const schema = z.object({ test: z.string() });
      const result = await generateObject("test prompt", schema);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Provider error");
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });

    it("should return error when no providers are configured", async () => {
      delete process.env.GOOGLE_AI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const { generateObject } = await import("@/lib/ai/client");
      const schema = z.object({ test: z.string() });
      const result = await generateObject("test prompt", schema);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No LLM providers available");
    });
  });

  describe("generateText", () => {
    it("should use Gemini when available and successful", async () => {
      process.env.GOOGLE_AI_API_KEY = "test-gemini-key";
      delete process.env.OPENAI_API_KEY;

      mockGenerateText.mockResolvedValue({
        text: "test response",
        usage: { inputTokens: 50, outputTokens: 50 },
      });

      const { generateText } = await import("@/lib/ai/client");
      const result = await generateText("test prompt");

      expect(result.success).toBe(true);
      expect(result.data).toBe("test response");
      expect(result.provider).toBe("gemini");
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
    });

    it("should fallback to OpenAI when Gemini fails", async () => {
      process.env.GOOGLE_AI_API_KEY = "test-gemini-key";
      process.env.OPENAI_API_KEY = "test-openai-key";

      let callCount = 0;
      mockGenerateText.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Gemini rate limit");
        }
        return Promise.resolve({
          text: "test response",
          usage: { inputTokens: 25, outputTokens: 25 },
        });
      });

      const { generateText } = await import("@/lib/ai/client");
      const result = await generateText("test prompt");

      expect(result.success).toBe(true);
      expect(result.provider).toBe("openai");
      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });
  });

  describe("generateObjectForCategorization", () => {
    it("should use Gemini as primary for categorization", async () => {
      process.env.GOOGLE_AI_API_KEY = "test-gemini-key";
      process.env.OPENAI_API_KEY = "test-openai-key";

      mockGenerateObject.mockResolvedValue({
        object: { category: "food" },
        usage: { inputTokens: 25, outputTokens: 25 },
      });

      const { generateObjectForCategorization } = await import("@/lib/ai/client");
      const schema = z.object({ category: z.string() });
      const result = await generateObjectForCategorization("categorize this", schema);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("gemini");
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    });
  });

  describe("generateObjectForExtraction", () => {
    it("should use GPT-4o-mini as primary for extraction", async () => {
      process.env.OPENAI_API_KEY = "test-openai-key";
      delete process.env.GOOGLE_AI_API_KEY;

      mockGenerateObject.mockResolvedValue({
        object: { amount: 100 },
        usage: { inputTokens: 50, outputTokens: 50 },
      });

      const { generateObjectForExtraction } = await import("@/lib/ai/client");
      const schema = z.object({ amount: z.number() });
      const result = await generateObjectForExtraction("extract this", schema);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("openai");
      expect(result.model).toBe("gpt-4o-mini");
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    });

    it("should use Gemini for PDF extraction", async () => {
      process.env.GOOGLE_AI_API_KEY = "test-gemini-key";
      process.env.OPENAI_API_KEY = "test-openai-key";

      mockGenerateObject.mockResolvedValue({
        object: { amount: 100 },
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const { generateObjectForExtraction } = await import("@/lib/ai/client");
      const schema = z.object({ amount: z.number() });
      const result = await generateObjectForExtraction("extract this", schema, {
        image: { data: "base64data", mimeType: "application/pdf" },
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe("gemini");
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    });
  });
});
