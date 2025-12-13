"use server";

import { db } from "@/lib/db";
import {
  categories,
  categoryRules,
  receipts,
  bankStatementTransactions,
} from "@/lib/db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
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

const UNCATEGORIZED_SYSTEM_NAME = "Uncategorized";

async function ensureUncategorizedSystemCategory() {
  const existing = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.type, "system"),
        sql`LOWER(${categories.name}) = LOWER(${UNCATEGORIZED_SYSTEM_NAME})`,
        sql`${categories.deletedAt} IS NULL`
      )
    )
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(categories)
    .values({
      id: createId(),
      name: UNCATEGORIZED_SYSTEM_NAME,
      type: "system",
      userId: null,
      transactionType: "expense",
      usageScope: "both",
      description: "System: Uncategorized",
    })
    .returning();

  return created;
}

export const getUserCategories = createAuthenticatedAction(
  "getUserCategories",
  async (userId) => {
    // Ensure baseline system category exists for safe defaults
    await ensureUncategorizedSystemCategory();

    // Only return Plaid system categories (those with "Plaid:" in description) and user categories
    return db
      .select()
      .from(categories)
      .where(
        or(
          // Plaid system categories
          and(
            eq(categories.type, "system"),
            or(
              sql`${categories.description} LIKE 'Plaid:%'`,
              sql`LOWER(${categories.name}) = LOWER(${UNCATEGORIZED_SYSTEM_NAME})`
            ),
            sql`${categories.deletedAt} IS NULL`
          ),
          // User-created categories
          and(
            eq(categories.type, "user"),
            eq(categories.userId, userId),
            sql`${categories.deletedAt} IS NULL`
          )
        )
      );
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
      .where(
        and(
          sql`LOWER(${categories.name}) = LOWER(${validated.name})`,
          sql`${categories.deletedAt} IS NULL`
        )
      );

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
  confirmDetach: z.boolean().optional(),
});

export const deleteUserCategory = createAuthenticatedAction(
  "deleteUserCategory",
  async (userId, data: z.infer<typeof DeleteCategorySchema>) => {
    const validated = DeleteCategorySchema.parse(data);

    const uncategorized = await ensureUncategorizedSystemCategory();

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

    if (category[0].deletedAt) {
      throw new Error("Category is already deleted");
    }

    // Pre-delete impact check (protect users from accidentally orphaning lots of data)
    const [receiptCountRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(receipts)
      .where(
        and(
          eq(receipts.userId, userId),
          eq(receipts.categoryId, validated.categoryId)
        )
      );

    // Bank tx ownership is enforced via documents elsewhere; for impact we only count by categoryId
    const [bankTxCountRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(bankStatementTransactions)
      .where(eq(bankStatementTransactions.categoryId, validated.categoryId));

    const receiptCount = Number(receiptCountRow?.count ?? 0);
    const bankTxCount = Number(bankTxCountRow?.count ?? 0);

    if ((receiptCount > 0 || bankTxCount > 0) && !validated.confirmDetach) {
      throw new Error(
        `Category is used by ${receiptCount} receipt(s) and ${bankTxCount} bank transaction(s). ` +
          `Deleting will move them to Review. Re-try delete with confirmDetach=true.`
      );
    }

    // Soft-delete: mark deleted + detach existing transactions so they show up in review queue
    await db.transaction(async (tx) => {
      const now = new Date();

      // Detach receipts and flag for review
      await tx
        .update(receipts)
        .set({
          categoryId: uncategorized.id,
          category: uncategorized.name,
          status: "needs_review",
          updatedAt: now,
        })
        .where(
          and(
            eq(receipts.userId, userId),
            eq(receipts.categoryId, validated.categoryId)
          )
        );

      // Detach bank transactions (ownership enforced by join via documents isn't available here)
      // We'll detach by categoryId; downstream UI is already scoped by userId via documents join.
      await tx
        .update(bankStatementTransactions)
        .set({
          categoryId: uncategorized.id,
          category: uncategorized.name,
          updatedAt: now,
        })
        .where(eq(bankStatementTransactions.categoryId, validated.categoryId));

      await tx
        .update(categories)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(categories.id, validated.categoryId),
            eq(categories.userId, userId)
          )
        );
    });

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
  businessId: z.string().optional().nullable(),
  displayName: z.string().optional().nullable(),
  isEnabled: z.boolean().optional(),
  source: z.string().optional().nullable(),
  createdFrom: z.string().optional().nullable(),
});

async function assertCategoryUsableByUser(userId: string, categoryId: string) {
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (category.length === 0) {
    throw new Error("Category not found");
  }

  if (category[0].type === "user" && category[0].userId !== userId) {
    throw new Error("Unauthorized to use this category");
  }

  if (category[0].deletedAt) {
    throw new Error("Category not found");
  }
}

async function upsertRuleInternal(
  userId: string,
  validated: z.infer<typeof CreateRuleSchema>
) {
  await assertCategoryUsableByUser(userId, validated.categoryId);

  const normalizedValue = validated.value.trim();
  const normalizedField = validated.field;
  const normalizedMatchType = validated.matchType;

  const existing = await db
    .select()
    .from(categoryRules)
    .where(
      and(
        eq(categoryRules.userId, userId),
        eq(categoryRules.field, normalizedField),
        eq(categoryRules.matchType, normalizedMatchType),
        sql`LOWER(${categoryRules.value}) = LOWER(${normalizedValue})`
      )
    )
    .limit(1);

  const now = new Date();
  const isEnabled = validated.isEnabled ?? true;

  if (existing[0]) {
    await db
      .update(categoryRules)
      .set({
        categoryId: validated.categoryId,
        businessId:
          validated.businessId !== undefined ? validated.businessId : null,
        value: normalizedValue,
        displayName:
          validated.displayName !== undefined
            ? validated.displayName?.trim() || null
            : undefined,
        isEnabled,
        source:
          validated.source !== undefined ? validated.source?.trim() || null : null,
        createdFrom:
          validated.createdFrom !== undefined
            ? validated.createdFrom?.trim() || null
            : null,
        updatedAt: now,
      })
      .where(and(eq(categoryRules.id, existing[0].id), eq(categoryRules.userId, userId)));

    return { ruleId: existing[0].id, updated: true };
  }

  const ruleId = createId();
  await db.insert(categoryRules).values({
    id: ruleId,
    categoryId: validated.categoryId,
    userId,
    businessId: validated.businessId || null,
    matchType: validated.matchType,
    field: validated.field,
    value: normalizedValue,
    displayName: validated.displayName?.trim() || null,
    isEnabled,
    source: validated.source?.trim() || null,
    createdFrom: validated.createdFrom?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });

  return { ruleId, updated: false };
}

export const upsertCategoryRule = createAuthenticatedAction(
  "upsertCategoryRule",
  async (userId, data: z.infer<typeof CreateRuleSchema>) => {
    const validated = CreateRuleSchema.parse(data);
    const result = await upsertRuleInternal(userId, validated);
    revalidatePath("/app/settings/rules");
    return { success: true, ...result };
  }
);

export const createCategoryRule = createAuthenticatedAction(
  "createCategoryRule",
  async (userId, data: z.infer<typeof CreateRuleSchema>) => {
    const validated = CreateRuleSchema.parse(data);
    const { ruleId, updated } = await upsertRuleInternal(userId, validated);
    revalidatePath("/app/settings/rules");
    return { success: true, ruleId, updated };
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

    await assertCategoryUsableByUser(userId, validated.categoryId);

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

    revalidatePath("/app/settings/rules");
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

    revalidatePath("/app/settings/rules");
    return { success: true };
  }
);

const SetRuleEnabledSchema = z.object({
  ruleId: z.string(),
  isEnabled: z.boolean(),
});

export const setCategoryRuleEnabled = createAuthenticatedAction(
  "setCategoryRuleEnabled",
  async (userId, data: z.infer<typeof SetRuleEnabledSchema>) => {
    const validated = SetRuleEnabledSchema.parse(data);

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
      .set({ isEnabled: validated.isEnabled, updatedAt: new Date() })
      .where(and(eq(categoryRules.id, validated.ruleId), eq(categoryRules.userId, userId)));

    revalidatePath("/app/settings/rules");
    return { success: true };
  }
);

const TestRuleMatchSchema = z.object({
  merchantName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const testRuleMatch = createAuthenticatedAction(
  "testRuleMatch",
  async (userId, input: z.infer<typeof TestRuleMatchSchema>) => {
    const validated = TestRuleMatchSchema.parse(input);

    const { RuleMatcher } = await import(
      "@/lib/categorization/strategies/rule-matcher"
    );

    const matcher = new RuleMatcher();
    const result = await matcher.categorize(
      {
        merchantName: validated.merchantName ?? undefined,
        description: validated.description ?? undefined,
        amount: undefined,
        statementType: undefined,
      },
      { userId }
    );

    return result;
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
          eq(categoryRules.matchType, "exact"),
          eq(categoryRules.isEnabled, true)
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
  isEnabled: z.boolean().optional(),
  source: z.string().optional(),
  createdFrom: z.string().optional(),
});

export const createMerchantRule = createAuthenticatedAction(
  "createMerchantRule",
  async (userId, data: z.infer<typeof CreateMerchantRuleSchema>) => {
    const validated = CreateMerchantRuleSchema.parse(data);
    const { ruleId, updated } = await upsertRuleInternal(userId, {
      categoryId: validated.categoryId,
      matchType: "exact",
      field: "merchantName",
      value: validated.merchantName,
      businessId: validated.businessId ?? null,
      displayName: validated.displayName ?? null,
      isEnabled: validated.isEnabled ?? true,
      source: validated.source ?? "settings",
      createdFrom: validated.createdFrom ?? null,
    });
    revalidatePath("/app/settings/rules");
    return { success: true, ruleId, updated };
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
