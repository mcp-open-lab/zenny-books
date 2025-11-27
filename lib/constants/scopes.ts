/**
 * Scope Constants
 * Usage scopes, transaction types, and categorization-related constants
 */

// Usage Scopes
export const USAGE_SCOPES = ["personal", "business", "both"] as const;
export type UsageScope = (typeof USAGE_SCOPES)[number];

// Alternate naming for user settings
export const USAGE_TYPES = ["personal", "business", "mixed"] as const;
export type UsageType = (typeof USAGE_TYPES)[number];

// Transaction Types
export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// Category Types
export const CATEGORY_TYPES = ["system", "user"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

// Categorization Methods
export const CATEGORIZATION_METHODS = ["rule", "history", "ai", "none"] as const;
export type CategorizationMethod = (typeof CATEGORIZATION_METHODS)[number];

// Category Rule Match Types
export const MATCH_TYPES = ["exact", "contains", "regex"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

// Category Rule Fields
export const RULE_FIELDS = ["merchantName", "description"] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

// Duplicate Match Types
export const DUPLICATE_MATCH_TYPES = [
  "exact_image",
  "merchant_date_amount",
  "manual",
] as const;
export type DuplicateMatchType = (typeof DUPLICATE_MATCH_TYPES)[number];

