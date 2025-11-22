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
        context: { categoryName: validated.name, existingCount: existingCategories.length },
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
      context: { categoryId: newCategory[0].id, categoryName: newCategory[0].name },
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

    if (
      category[0].type === "user" &&
      category[0].userId !== userId
    ) {
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

    await db.delete(categoryRules).where(eq(categoryRules.id, validated.ruleId));

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

