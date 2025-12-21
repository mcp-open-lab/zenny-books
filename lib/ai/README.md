# AI Module Architecture

## Overview

This module provides LLM processing workflows with support for multiple providers (OpenAI, Gemini) and structured outputs using the Vercel AI SDK.

## Structure

```
lib/ai/
├── client.ts              # Orchestrator - handles provider selection & fallback
├── prompts/               # Centralized prompt builders
├── logger.ts              # LLM interaction logging
├── costs.ts               # Cost calculation
└── types.ts               # Shared types & interfaces
```

## Architecture

Uses the Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`) for provider-agnostic LLM calls with automatic fallback.

### Provider Selection

- **`generateObject`**: OpenAI primary (better structured output), Gemini fallback
- **`generateObjectForCategorization`**: Gemini primary (cost savings), OpenAI fallback
- **`generateObjectForExtraction`**: GPT-4o-mini primary (cost-effective), GPT-4o fallback, Gemini for PDFs
- **`generateText`**: Gemini primary (cheaper), OpenAI fallback

## Usage

### Structured Output

```typescript
import { generateObject } from "@/lib/ai/client";
import { z } from "zod";

const schema = z.object({
  merchantName: z.string().nullable(),
  totalAmount: z.number(),
});

const result = await generateObject("Extract data from receipt", schema, {
  image: { data: base64Image, mimeType: "image/jpeg" },
});

if (result.success) {
  console.log(result.data); // Typed as { merchantName: string | null; totalAmount: number }
}
```

### Text Generation

```typescript
import { generateText } from "@/lib/ai/client";

const result = await generateText("Summarize this document...");
if (result.success) {
  console.log(result.data); // string
}
```

### Categorization (Gemini Primary)

```typescript
import { generateObjectForCategorization } from "@/lib/ai/client";

const result = await generateObjectForCategorization(prompt, schema, {
  loggingContext: {
    userId: "user123",
    promptType: "categorization",
  },
});
```

### Extraction with Images/PDFs

```typescript
import { generateObjectForExtraction } from "@/lib/ai/client";

// For images - uses GPT-4o-mini
const imageResult = await generateObjectForExtraction(prompt, schema, {
  image: { data: base64Image, mimeType: "image/jpeg" },
});

// For PDFs - automatically uses Gemini
const pdfResult = await generateObjectForExtraction(prompt, schema, {
  image: { data: base64Pdf, mimeType: "application/pdf" },
});
```

## Response Type

All functions return `LLMResponse<T>`:

```typescript
interface LLMResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  provider: "openai" | "gemini";
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  durationMs?: number;
}
```

## Logging

LLM interactions are logged to the database when `loggingContext` is provided:

```typescript
const result = await generateObject(prompt, schema, {
  loggingContext: {
    userId: "user123",
    entityId: "receipt456",
    entityType: "receipt",
    promptType: "extraction",
    inputData: { fileName: "receipt.jpg" },
  },
});
```
