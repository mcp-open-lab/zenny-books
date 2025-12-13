/**
 * Maps Plaid personal_finance_category to our system categories
 * Uses dynamic lookup from database based on Plaid category codes stored in description
 */

import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Cache for category mappings (refreshed on server restart)
let categoryCache: Map<string, string> | null = null;

// Fallback mappings for common categories (used if no exact match found)
const FALLBACK_MAPPINGS: Record<string, string> = {
  // Primary category fallbacks
  "INCOME": "Other Income",
  "FOOD_AND_DRINK": "Restaurants",
  "TRANSPORTATION": "Other Transportation",
  "TRAVEL": "Other Travel",
  "RENT_AND_UTILITIES": "Other Utilities",
  "MEDICAL": "Other Medical",
  "PERSONAL_CARE": "Other Personal Care",
  "ENTERTAINMENT": "Other Entertainment",
  "GENERAL_MERCHANDISE": "Other Shopping",
  "GENERAL_SERVICES": "Other Services",
  "HOME_IMPROVEMENT": "Other Home",
  "LOAN_PAYMENTS": "Other Loan Payment",
  "BANK_FEES": "Other Bank Fees",
  "GOVERNMENT_AND_NON_PROFIT": "Government Fees",
  "TRANSFER_IN": "Transfer In",
  "TRANSFER_OUT": "Transfer Out",
};

/**
 * Build category cache from database
 */
async function buildCategoryCache(): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  
  // Get all system categories
  const systemCategories = await db
    .select({ id: categories.id, name: categories.name, description: categories.description })
    .from(categories)
    .where(eq(categories.type, "system"));

  // Build lookup by name (for fallback mappings)
  const byName = new Map<string, string>();
  for (const cat of systemCategories) {
    byName.set(cat.name, cat.id);
    
    // Also extract Plaid codes from description if present
    // Format: "Plaid: PRIMARY > DETAILED"
    if (cat.description?.startsWith("Plaid:")) {
      const match = cat.description.match(/Plaid:\s*(\w+)\s*>\s*(\w+)/);
      if (match) {
        const detailed = match[2];
        cache.set(detailed, cat.id);
      }
    }
  }

  // Add fallback mappings by name
  for (const [plaidPrimary, categoryName] of Object.entries(FALLBACK_MAPPINGS)) {
    const categoryId = byName.get(categoryName);
    if (categoryId && !cache.has(plaidPrimary)) {
      cache.set(plaidPrimary, categoryId);
    }
  }

  return cache;
}

/**
 * Get category cache (lazy initialization)
 */
async function getCategoryCache(): Promise<Map<string, string>> {
  if (!categoryCache) {
    categoryCache = await buildCategoryCache();
  }
  return categoryCache;
}

/**
 * Clear category cache (call after seeding new categories)
 */
export function clearCategoryCache(): void {
  categoryCache = null;
}

/**
 * Map Plaid category to our system category ID
 * Tries detailed category first, falls back to primary
 */
export async function mapPlaidCategoryAsync(
  primaryCategory: string | undefined | null,
  detailedCategory: string | undefined | null
): Promise<string | null> {
  const cache = await getCategoryCache();
  
  // Try detailed category first (more specific)
  if (detailedCategory && cache.has(detailedCategory)) {
    return cache.get(detailedCategory)!;
  }
  
  // Fall back to primary category
  if (primaryCategory && cache.has(primaryCategory)) {
    return cache.get(primaryCategory)!;
  }
  
  // No mapping found
  return null;
}

/**
 * Synchronous version for use in sync loops
 * Uses pre-built cache, returns null if cache not ready
 */
export function mapPlaidCategory(
  primaryCategory: string | undefined | null,
  detailedCategory: string | undefined | null
): string | null {
  if (!categoryCache) {
    // Cache not ready - return null and let it be uncategorized
    // Next sync will have cache ready
    return null;
  }
  
  // Try detailed category first
  if (detailedCategory && categoryCache.has(detailedCategory)) {
    return categoryCache.get(detailedCategory)!;
  }
  
  // Fall back to primary
  if (primaryCategory && categoryCache.has(primaryCategory)) {
    return categoryCache.get(primaryCategory)!;
  }
  
  return null;
}

/**
 * Initialize category cache (call at app startup or before sync)
 */
export async function initializeCategoryCache(): Promise<void> {
  categoryCache = await buildCategoryCache();
}
