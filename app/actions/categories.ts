"use server";

import { db } from "@/lib/db";
import { categories, categoryRules } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { createSafeAction } from "@/lib/safe-action";

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
  CreateCategorySchema,
  async (data) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Check for duplicate name
    const existing = await db
      .select()
      .from(categories)
      .where(
        and(eq(categories.name, data.name), eq(categories.userId, userId))
      );

    if (existing.length > 0) {
      throw new Error("A category with this name already exists");
    }

    const newCategory = await db
      .insert(categories)
      .values({
        id: createId(),
        name: data.name,
        type: "user",
        userId,
      })
      .returning();

    revalidatePath("/app/settings/categories");
    return newCategory[0];
  }
);

// Delete a user category
const DeleteCategorySchema = z.object({
  categoryId: z.string(),
});

export const deleteUserCategory = createSafeAction(
  DeleteCategorySchema,
  async (data) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify ownership
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, data.categoryId))
      .limit(1);

    if (
      category.length === 0 ||
      category[0].type === "system" ||
      category[0].userId !== userId
    ) {
      throw new Error("Category not found or unauthorized");
    }

    await db.delete(categories).where(eq(categories.id, data.categoryId));

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
  CreateRuleSchema,
  async (data) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify category exists and user has access
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, data.categoryId))
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
        categoryId: data.categoryId,
        userId,
        matchType: data.matchType,
        field: data.field,
        value: data.value,
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
  DeleteRuleSchema,
  async (data) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify ownership
    const rule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, data.ruleId))
      .limit(1);

    if (rule.length === 0 || rule[0].userId !== userId) {
      throw new Error("Rule not found or unauthorized");
    }

    await db.delete(categoryRules).where(eq(categoryRules.id, data.ruleId));

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

