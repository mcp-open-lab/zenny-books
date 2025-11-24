"use server";

import { db } from "@/lib/db";
import {
  categories,
  categoryRules,
  receipts,
  bankStatementTransactions,
} from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
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
  transactionType: z.enum(["income", "expense"]),
  usageScope: z.enum(["personal", "business", "both"]),
  description: z.string().optional(),
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
        transactionType: validated.transactionType,
        usageScope: validated.usageScope,
        description: validated.description || null,
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

// Update a category rule
const UpdateRuleSchema = z.object({
  ruleId: z.string(),
  categoryId: z.string(),
  businessId: z.string().optional(), // Optional business assignment
  matchType: z.enum(["exact", "contains", "regex"]),
  field: z.enum(["merchantName", "description"]),
  value: z.string().min(1, "Pattern is required"),
});

export const updateCategoryRule = createSafeAction(
  "updateCategoryRule",
  async (data: z.infer<typeof UpdateRuleSchema>) => {
    const validated = UpdateRuleSchema.parse(data);
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

    // Verify category exists
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, validated.categoryId))
      .limit(1);

    if (category.length === 0) {
      throw new Error("Category not found");
    }

    if (category[0].type === "user" && category[0].userId !== userId) {
      throw new Error("Unauthorized to use this category");
    }

    await db
      .update(categoryRules)
      .set({
        categoryId: validated.categoryId,
        businessId: validated.businessId || null,
        matchType: validated.matchType,
        field: validated.field,
        value: validated.value,
        updatedAt: new Date(),
      })
      .where(eq(categoryRules.id, validated.ruleId));

    devLogger.info("Category rule updated", {
      context: { ruleId: validated.ruleId },
    });

    revalidatePath("/app/settings/categories");
    return { success: true };
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

    /**
     * IMPLICATIONS OF DELETING A RULE:
     *
     * 1. Future Transactions:
     *    - New transactions matching this rule will NO LONGER be auto-categorized
     *    - They will fall back to History Matcher (if past transactions exist)
     *    - Or AI Matcher (if enabled and no history)
     *    - Or remain uncategorized
     *
     * 2. Existing Transactions:
     *    - Transactions already categorized by this rule KEEP their categoryId
     *    - No cascade delete - existing data is NOT affected
     *    - The categoryId is stored on the transaction record itself
     *
     * 3. Categorization Priority:
     *    - Rules have Priority 1 (highest - checked first)
     *    - After deletion, History Matcher (Priority 2) may take over
     *    - Or AI Matcher (Priority 100) as fallback
     *
     * 4. No Transaction Count:
     *    - We don't track which transactions were categorized by which rule
     *    - Cannot show "X transactions will be affected" warning
     *    - Deletion is immediate and affects future categorization only
     */

    await db
      .delete(categoryRules)
      .where(eq(categoryRules.id, validated.ruleId));

    devLogger.info("Category rule deleted", {
      context: { ruleId: validated.ruleId },
    });

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

// Get merchant statistics from transaction history
export async function getMerchantStatistics(
  page: number = 1,
  pageSize: number = 25
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  devLogger.info("Getting merchant statistics", { context: { userId, page, pageSize } });

  const repository = new TransactionRepository();
  const result = await repository.getMerchantStatistics(userId, page, pageSize);

  // Check which merchants have existing rules
  const merchantRules = await db
    .select({
      id: categoryRules.id,
      value: categoryRules.value,
      categoryId: categoryRules.categoryId,
      displayName: categoryRules.displayName,
      field: categoryRules.field,
      matchType: categoryRules.matchType,
    })
    .from(categoryRules)
    .where(
      and(
        eq(categoryRules.userId, userId),
        eq(categoryRules.field, "merchantName"),
        eq(categoryRules.matchType, "exact")
      )
    );

  // Create a map of merchant name -> rule data
  const rulesMap = new Map(
    merchantRules.map((r) => [r.value.toLowerCase(), r])
  );

  result.stats.forEach((stat) => {
    const rule = rulesMap.get(stat.merchantName.toLowerCase());
    if (rule) {
      stat.hasRule = true;
      stat.ruleId = rule.id;
      stat.ruleCategoryId = rule.categoryId;
      stat.ruleDisplayName = rule.displayName;
    } else {
      stat.hasRule = false;
      stat.ruleId = null;
      stat.ruleCategoryId = null;
      stat.ruleDisplayName = null;
    }
  });

  devLogger.info("Merchant statistics retrieved", {
    context: { count: result.stats.length, totalCount: result.totalCount },
  });

  return result;
}

// Create a merchant rule from transaction history
const CreateMerchantRuleSchema = z.object({
  merchantName: z.string().min(1, "Merchant name is required"),
  categoryId: z.string(),
  displayName: z.string().optional(),
  businessId: z.string().optional(), // Optional business assignment for this rule
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
        businessId: validated.businessId || null,
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

// Update a merchant rule
const UpdateMerchantRuleSchema = z.object({
  ruleId: z.string(),
  categoryId: z.string(),
  displayName: z.string().optional(),
  businessId: z.string().optional(), // Optional business assignment
});

export const updateMerchantRule = createSafeAction(
  "updateMerchantRule",
  async (data: z.infer<typeof UpdateMerchantRuleSchema>) => {
    const validated = UpdateMerchantRuleSchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify ownership and rule type
    const rule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, validated.ruleId))
      .limit(1);

    if (
      rule.length === 0 ||
      rule[0].userId !== userId ||
      rule[0].field !== "merchantName" ||
      rule[0].matchType !== "exact"
    ) {
      throw new Error("Rule not found or unauthorized");
    }

    // Verify category exists
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, validated.categoryId))
      .limit(1);

    if (category.length === 0) {
      throw new Error("Category not found");
    }

    await db
      .update(categoryRules)
      .set({
        categoryId: validated.categoryId,
        displayName: validated.displayName || null,
        businessId: validated.businessId || null,
        updatedAt: new Date(),
      })
      .where(eq(categoryRules.id, validated.ruleId));

    devLogger.info("Merchant rule updated", {
      context: { ruleId: validated.ruleId, categoryId: validated.categoryId },
    });

    revalidatePath("/app/settings/categories");
    return { success: true };
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
export async function getMerchantTransactions(
  merchantName: string,
  page: number = 1,
  pageSize: number = 25
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const repository = new TransactionRepository();
  const result = await repository.getMerchantTransactions(
    merchantName,
    userId,
    page,
    pageSize
  );

  return result;
}

export async function bulkUpdateMerchantCategory(
  merchantName: string,
  categoryId: string,
  businessId?: string | null
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    // Get all transactions for this merchant (without pagination)
    const repository = new TransactionRepository();
    const { transactions } = await repository.getMerchantTransactions(
      merchantName,
      userId,
      1,
      10000 // Large number to get all
    );

    // Get category name for denormalization
    const categoryResult = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    const categoryName = categoryResult[0]?.name ?? null;

    // Update receipts
    const receiptIds = transactions
      .filter((t) => t.source === "receipt")
      .map((t) => t.id);

    if (receiptIds.length > 0) {
      await db
        .update(receipts)
        .set({
          categoryId,
          category: categoryName,
          businessId: businessId || null,
          status: "approved",
          updatedAt: new Date(),
        })
        .where(
          and(inArray(receipts.id, receiptIds), eq(receipts.userId, userId))
        );
    }

    // Update bank transactions
    const bankTxIds = transactions
      .filter((t) => t.source === "bank_transaction")
      .map((t) => t.id);

    if (bankTxIds.length > 0) {
      await db
        .update(bankStatementTransactions)
        .set({
          categoryId,
          category: categoryName,
          businessId: businessId || null,
          updatedAt: new Date(),
        })
        .where(inArray(bankStatementTransactions.id, bankTxIds));
    }

    return {
      success: true,
      updatedCount: transactions.length,
    };
  } catch (error) {
    devLogger.error("Error bulk updating merchant category", {
      error,
      merchantName,
      userId,
    });
    throw new Error("Failed to update merchant transactions");
  }
}
