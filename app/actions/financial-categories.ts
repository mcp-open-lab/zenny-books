"use server";

import { db } from "@/lib/db";
import {
  categories,
  categoryRules,
  receipts,
  bankStatementTransactions,
} from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { createAuthenticatedAction } from "@/lib/safe-action";
import { devLogger } from "@/lib/dev-logger";
import { TransactionRepository } from "@/lib/categorization/repositories/transaction-repository";
import {
  TRANSACTION_TYPES,
  USAGE_SCOPES,
  MATCH_TYPES,
  RULE_FIELDS,
} from "@/lib/constants";

export const getUserCategories = createAuthenticatedAction(
  "getUserCategories",
  async (userId) => {
    return db
      .select()
      .from(categories)
      .where(or(eq(categories.type, "system"), eq(categories.userId, userId)));
  }
);

const CreateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(50),
  transactionType: z.enum(TRANSACTION_TYPES),
  usageScope: z.enum(USAGE_SCOPES),
  description: z.string().optional(),
});

export const createUserCategory = createAuthenticatedAction(
  "createUserCategory",
  async (userId, data: z.infer<typeof CreateCategorySchema>) => {
    const validated = CreateCategorySchema.parse(data);

    const existingCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.name, validated.name));

    const isDuplicate = existingCategories.some(
      (cat) => cat.type === "system" || cat.userId === userId
    );

    if (isDuplicate) {
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

    revalidatePath("/app/settings/categories");
    return newCategory[0];
  }
);

const DeleteCategorySchema = z.object({
  categoryId: z.string(),
});

export const deleteUserCategory = createAuthenticatedAction(
  "deleteUserCategory",
  async (userId, data: z.infer<typeof DeleteCategorySchema>) => {
    const validated = DeleteCategorySchema.parse(data);

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

export const getUserRules = createAuthenticatedAction(
  "getUserRules",
  async (userId) => {
    return db
      .select({
        rule: categoryRules,
        category: categories,
      })
      .from(categoryRules)
      .innerJoin(categories, eq(categoryRules.categoryId, categories.id))
      .where(eq(categoryRules.userId, userId));
  }
);

const CreateRuleSchema = z.object({
  categoryId: z.string(),
  matchType: z.enum(MATCH_TYPES),
  field: z.enum(RULE_FIELDS),
  value: z.string().min(1, "Pattern is required"),
});

export const createCategoryRule = createAuthenticatedAction(
  "createCategoryRule",
  async (userId, data: z.infer<typeof CreateRuleSchema>) => {
    const validated = CreateRuleSchema.parse(data);

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

const UpdateRuleSchema = z.object({
  ruleId: z.string(),
  categoryId: z.string(),
  businessId: z.string().optional(),
  matchType: z.enum(MATCH_TYPES),
  field: z.enum(RULE_FIELDS),
  value: z.string().min(1, "Pattern is required"),
});

export const updateCategoryRule = createAuthenticatedAction(
  "updateCategoryRule",
  async (userId, data: z.infer<typeof UpdateRuleSchema>) => {
    const validated = UpdateRuleSchema.parse(data);

    const rule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, validated.ruleId))
      .limit(1);

    if (rule.length === 0 || rule[0].userId !== userId) {
      throw new Error("Rule not found or unauthorized");
    }

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

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

const DeleteRuleSchema = z.object({
  ruleId: z.string(),
});

export const deleteCategoryRule = createAuthenticatedAction(
  "deleteCategoryRule",
  async (userId, data: z.infer<typeof DeleteRuleSchema>) => {
    const validated = DeleteRuleSchema.parse(data);

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

type MerchantStatsInput = {
  page?: number;
  pageSize?: number;
};

export const getMerchantStatistics = createAuthenticatedAction(
  "getMerchantStatistics",
  async (userId, input: MerchantStatsInput = {}) => {
    const { page = 1, pageSize = 25 } = input;

    const repository = new TransactionRepository();
    const result = await repository.getMerchantStatistics(
      userId,
      page,
      pageSize
    );

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

    return result;
  }
);

const CreateMerchantRuleSchema = z.object({
  merchantName: z.string().min(1, "Merchant name is required"),
  categoryId: z.string(),
  displayName: z.string().optional(),
  businessId: z.string().optional(),
});

export const createMerchantRule = createAuthenticatedAction(
  "createMerchantRule",
  async (userId, data: z.infer<typeof CreateMerchantRuleSchema>) => {
    const validated = CreateMerchantRuleSchema.parse(data);

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

    revalidatePath("/app/settings/categories");
    return newRule[0];
  }
);

const UpdateMerchantRuleSchema = z.object({
  ruleId: z.string(),
  categoryId: z.string(),
  displayName: z.string().optional(),
  businessId: z.string().optional(),
});

export const updateMerchantRule = createAuthenticatedAction(
  "updateMerchantRule",
  async (userId, data: z.infer<typeof UpdateMerchantRuleSchema>) => {
    const validated = UpdateMerchantRuleSchema.parse(data);

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

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

const UpdateRuleDisplayNameSchema = z.object({
  ruleId: z.string(),
  displayName: z.string().min(1, "Display name is required").max(100),
});

export const updateRuleDisplayName = createAuthenticatedAction(
  "updateRuleDisplayName",
  async (userId, data: z.infer<typeof UpdateRuleDisplayNameSchema>) => {
    const validated = UpdateRuleDisplayNameSchema.parse(data);

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

    revalidatePath("/app/settings/categories");
    return { success: true };
  }
);

type MerchantTxInput = {
  merchantName: string;
  page?: number;
  pageSize?: number;
};

export const getMerchantTransactions = createAuthenticatedAction(
  "getMerchantTransactions",
  async (userId, input: MerchantTxInput) => {
    const { merchantName, page = 1, pageSize = 25 } = input;

    const repository = new TransactionRepository();
    return repository.getMerchantTransactions(
      merchantName,
      userId,
      page,
      pageSize
    );
  }
);

type BulkUpdateInput = {
  merchantName: string;
  categoryId: string;
  businessId?: string | null;
};

export const bulkUpdateMerchantCategory = createAuthenticatedAction(
  "bulkUpdateMerchantCategory",
  async (userId, input: BulkUpdateInput) => {
    const { merchantName, categoryId, businessId } = input;

    const repository = new TransactionRepository();
    const { transactions } = await repository.getMerchantTransactions(
      merchantName,
      userId,
      1,
      10000
    );

    const categoryResult = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    const categoryName = categoryResult[0]?.name ?? null;

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
  }
);
