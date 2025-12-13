import { db } from "@/lib/db";
import { categories, userSettings } from "@/lib/db/schema";
import { eq, or, and, sql } from "drizzle-orm";
import { devLogger } from "@/lib/dev-logger";

type Category = typeof categories.$inferSelect;
type UsageType = "personal" | "business" | "both";

/**
 * Repository for category data access
 * Centralizes category queries and caching logic
 */
export class CategoryRepository {
  /**
   * Get user's usage preference (personal/business/both)
   */
  async getUserPreference(userId: string): Promise<UsageType> {
    try {
      const settings = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      return (settings[0]?.usageType as UsageType) || "personal";
    } catch (error) {
      devLogger.error("CategoryRepository: Error getting user preference", {
        error,
      });
      return "personal";
    }
  }

  /**
   * Get all categories available to a user based on their preference
   */
  async getAvailableCategories(
    userId: string,
    options?: {
      transactionType?: "income" | "expense";
      includeUserCategories?: boolean;
    }
  ): Promise<Category[]> {
    try {
      const userPreference = await this.getUserPreference(userId);

      // Build query conditions
      const conditions = [];

      // System categories that match user's scope
      if (userPreference === "both") {
        // Show all system categories
        conditions.push(
          and(eq(categories.type, "system"), sql`${categories.deletedAt} IS NULL`)
        );
      } else {
        // Show only categories that match user's preference OR are marked as 'both'
        conditions.push(
          and(
            eq(categories.type, "system"),
            or(
              eq(categories.usageScope, userPreference),
              eq(categories.usageScope, "both")
            ),
            sql`${categories.deletedAt} IS NULL`
          )
        );
      }

      // Include user's custom categories if requested
      if (options?.includeUserCategories !== false) {
        conditions.push(
          and(
            eq(categories.type, "user"),
            eq(categories.userId, userId),
            sql`${categories.deletedAt} IS NULL`
          )
        );
      }

      let allCategories = await db
        .select()
        .from(categories)
        .where(or(...conditions));

      // Filter by transaction type if specified
      if (options?.transactionType) {
        allCategories = allCategories.filter(
          (cat) => cat.transactionType === options.transactionType
        );
      }

      return allCategories;
    } catch (error) {
      devLogger.error("CategoryRepository: Error getting categories", {
        error,
      });
      return [];
    }
  }

  /**
   * Get formatted category list for AI/strategies
   * Returns: [{ id: string, name: string, type: string }, ...]
   * Includes transaction type for better AI context
   */
  async getCategoriesForAI(
    userId: string,
    options?: {
      transactionType?: "income" | "expense";
      includeUserCategories?: boolean;
    }
  ): Promise<Array<{ id: string; name: string; type?: string }>> {
    const availableCategories = await this.getAvailableCategories(
      userId,
      options
    );

    return availableCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      type: cat.transactionType || undefined,
    }));
  }

  /**
   * Get a single category by ID
   */
  async getCategoryById(categoryId: string): Promise<Category | null> {
    try {
      const result = await db
        .select()
        .from(categories)
        .where(and(eq(categories.id, categoryId), sql`${categories.deletedAt} IS NULL`))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      devLogger.error("CategoryRepository: Error getting category by ID", {
        error,
        categoryId,
      });
      return null;
    }
  }

  /**
   * Validate if a category is available to a user
   */
  async isCategoryAvailable(
    userId: string,
    categoryId: string
  ): Promise<boolean> {
    const availableCategories = await this.getAvailableCategories(userId);
    return availableCategories.some((cat) => cat.id === categoryId);
  }
}

