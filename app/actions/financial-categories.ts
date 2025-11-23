"use server";

import { db } from "@/lib/db";
import { categories, categoryRules } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { createSafeAction } from "@/lib/safe-action";
import { devLogger } from "@/lib/dev-logger";
import { TransactionRepository } from "@/lib/categorization/repositories/transaction-repository";

// Get all categories for a user (system + user-defined)
export async function getUserCategories() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const allCategories = await db
    .select()
    .from(categories)
    .where(or(eq(categories.type, "system"), eq(categories.userId, userId)));

  return allCategories;
}

// Create a new user category
const CreateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(50),
});

export const createUserCategory = createSafeAction(
  "createUserCategory",
  async (data: z.infer<typeof CreateCategorySchema>) => {
    // Validate input
    const validated = CreateCategorySchema.parse(data);

    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    devLogger.info("Creating user category", {
      context: { categoryName: validated.name, userId },
    });

    // Check if a category with this name already exists (system or user's own)
    const existingCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.name, validated.name));

    // Check if any matching category is a system category or belongs to this user
    const isDuplicate = existingCategories.some(
      (cat) => cat.type === "system" || cat.userId === userId
    );

    if (isDuplicate) {
      devLogger.warn("Category creation failed - duplicate name", {
        context: {
          categoryName: validated.name,
          existingCount: existingCategories.length,
        },
      });
      throw new Error("A category with this name already exists");
    }

    const newCategory = await db
      .insert(categories)
      .values({
        id: createId(),
        name: validated.name,
        type: "user",
        userId,
      })
      .returning();

    devLogger.info("Category created successfully", {
      context: {
        categoryId: newCategory[0].id,
        categoryName: newCategory[0].name,
      },
    });

    revalidatePath("/app/settings/categories");
    return newCategory[0];
  }
);

// Delete a user category
const DeleteCategorySchema = z.object({
  categoryId: z.string(),
});

export const deleteUserCategory = createSafeAction(
  "deleteUserCategory",
  async (data: z.infer<typeof DeleteCategorySchema>) => {
    const validated = DeleteCategorySchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify ownership
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, validated.categoryId))
      .limit(1);

    if (
      category.length === 0 ||
      category[0].type === "system" ||
      category[0].userId !== userId
    ) {
      throw new Error("Category not found or unauthorized");
    }

    await db.delete(categories).where(eq(categories.id, validated.categoryId));

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

// Get all rules for a user
export async function getUserRules() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const rules = await db
    .select({
      rule: categoryRules,
      category: categories,
    })
    .from(categoryRules)
    .innerJoin(categories, eq(categoryRules.categoryId, categories.id))
    .where(eq(categoryRules.userId, userId));

  return rules;
}

// Create a new rule
const CreateRuleSchema = z.object({
  categoryId: z.string(),
  matchType: z.enum(["exact", "contains", "regex"]),
  field: z.enum(["merchantName", "description"]),
  value: z.string().min(1, "Pattern is required"),
});

export const createCategoryRule = createSafeAction(
  "createCategoryRule",
  async (data: z.infer<typeof CreateRuleSchema>) => {
    const validated = CreateRuleSchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify category exists and user has access
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, validated.categoryId))
      .limit(1);

    if (category.length === 0) {
      throw new Error("Category not found");
    }

    if (category[0].type === "user" && category[0].userId !== userId) {
      throw new Error("Unauthorized to create rules for this category");
    }

    const newRule = await db
      .insert(categoryRules)
      .values({
        id: createId(),
        categoryId: validated.categoryId,
        userId,
        matchType: validated.matchType,
        field: validated.field,
        value: validated.value,
      })
      .returning();

    revalidatePath("/app/settings/categories");
    return newRule[0];
  }
);

// Delete a rule
const DeleteRuleSchema = z.object({
  ruleId: z.string(),
});

export const deleteCategoryRule = createSafeAction(
  "deleteCategoryRule",
  async (data: z.infer<typeof DeleteRuleSchema>) => {
    const validated = DeleteRuleSchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify ownership
    const rule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, validated.ruleId))
      .limit(1);

    if (rule.length === 0 || rule[0].userId !== userId) {
      throw new Error("Rule not found or unauthorized");
    }

    await db
      .delete(categoryRules)
      .where(eq(categoryRules.id, validated.ruleId));

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

// Get merchant statistics from transaction history
export async function getMerchantStatistics() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  devLogger.info("Getting merchant statistics", { context: { userId } });

  const repository = new TransactionRepository();
  const stats = await repository.getMerchantStatistics(userId);

  // Check which merchants have existing rules
  const merchantRules = await db
    .select({
      value: categoryRules.value,
      field: categoryRules.field,
      matchType: categoryRules.matchType,
    })
    .from(categoryRules)
    .where(
      and(
        eq(categoryRules.userId, userId),
        eq(categoryRules.field, "merchantName")
      )
    );

  // Mark merchants that have rules
  const rulesSet = new Set(
    merchantRules
      .filter((r) => r.matchType === "exact")
      .map((r) => r.value.toLowerCase())
  );

  stats.forEach((stat) => {
    stat.hasRule = rulesSet.has(stat.merchantName.toLowerCase());
  });

  devLogger.info("Merchant statistics retrieved", {
    context: { count: stats.length },
  });

  return stats;
}

// Create a merchant rule from transaction history
const CreateMerchantRuleSchema = z.object({
  merchantName: z.string().min(1, "Merchant name is required"),
  categoryId: z.string(),
  displayName: z.string().optional(),
});

export const createMerchantRule = createSafeAction(
  "createMerchantRule",
  async (data: z.infer<typeof CreateMerchantRuleSchema>) => {
    const validated = CreateMerchantRuleSchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    devLogger.info("Creating merchant rule", {
      context: {
        merchantName: validated.merchantName,
        categoryId: validated.categoryId,
      },
    });

    // Verify category exists and user has access
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, validated.categoryId))
      .limit(1);

    if (category.length === 0) {
      throw new Error("Category not found");
    }

    if (category[0].type === "user" && category[0].userId !== userId) {
      throw new Error("Unauthorized to create rules for this category");
    }

    // Check if a rule already exists for this merchant
    const existingRule = await db
      .select()
      .from(categoryRules)
      .where(
        and(
          eq(categoryRules.userId, userId),
          eq(categoryRules.field, "merchantName"),
          eq(categoryRules.matchType, "exact"),
          eq(categoryRules.value, validated.merchantName)
        )
      )
      .limit(1);

    if (existingRule.length > 0) {
      throw new Error("A rule already exists for this merchant");
    }

    const newRule = await db
      .insert(categoryRules)
      .values({
        id: createId(),
        categoryId: validated.categoryId,
        userId,
        matchType: "exact",
        field: "merchantName",
        value: validated.merchantName,
        displayName: validated.displayName || null,
      })
      .returning();

    devLogger.info("Merchant rule created successfully", {
      context: { ruleId: newRule[0].id, merchantName: validated.merchantName },
    });

    revalidatePath("/app/settings/categories");
    return newRule[0];
  }
);

// Update display name for a merchant rule
const UpdateRuleDisplayNameSchema = z.object({
  ruleId: z.string(),
  displayName: z.string().min(1, "Display name is required").max(100),
});

export const updateRuleDisplayName = createSafeAction(
  "updateRuleDisplayName",
  async (data: z.infer<typeof UpdateRuleDisplayNameSchema>) => {
    const validated = UpdateRuleDisplayNameSchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify ownership
    const rule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, validated.ruleId))
      .limit(1);

    if (rule.length === 0 || rule[0].userId !== userId) {
      throw new Error("Rule not found or unauthorized");
    }

    await db
      .update(categoryRules)
      .set({
        displayName: validated.displayName,
        updatedAt: new Date(),
      })
      .where(eq(categoryRules.id, validated.ruleId));

    devLogger.info("Rule display name updated", {
      context: { ruleId: validated.ruleId, displayName: validated.displayName },
    });

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

// Get all transactions for a specific merchant
export async function getMerchantTransactions(merchantName: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const repository = new TransactionRepository();
  const transactions = await repository.getMerchantTransactions(
    merchantName,
    userId
  );

  return transactions;
}
