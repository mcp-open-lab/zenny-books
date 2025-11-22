import type { categories, categoryRules } from "@/lib/db/schema";

export type Category = typeof categories.$inferSelect;
export type CategoryRule = typeof categoryRules.$inferSelect;

export interface TransactionToCategorize {
  merchantName?: string | null;
  description?: string | null;
  amount?: string | null;
}

export interface CategorizationResult {
  categoryId: string | null;
  categoryName: string | null;
  confidence: number; // 0.0 to 1.0
  method: "rule" | "history" | "ai" | "none";
  suggestedCategory?: string; // For new categories suggested by AI
}

export interface CategorizationOptions {
  userId: string;
  includeAI?: boolean; // Default: true
  minConfidence?: number; // Default: 0.7
}

