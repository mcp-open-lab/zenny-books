"use server";

import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { createAuthenticatedAction } from "@/lib/safe-action";
import { BUSINESS_TYPES } from "@/lib/constants";

export const getUserBusinesses = createAuthenticatedAction(
  "getUserBusinesses",
  async (userId) => {
    return db
      .select()
      .from(businesses)
      .where(eq(businesses.userId, userId))
      .orderBy(businesses.name);
  }
);

const CreateBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(100),
  type: z.enum(BUSINESS_TYPES),
  description: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const createBusiness = createAuthenticatedAction(
  "createBusiness",
  async (userId, data: z.infer<typeof CreateBusinessSchema>) => {
    const validated = CreateBusinessSchema.parse(data);

    const newBusiness = await db
      .insert(businesses)
      .values({
        id: createId(),
        userId,
        name: validated.name,
        type: validated.type,
        description: validated.description || null,
        taxId: validated.taxId || null,
        address: validated.address || null,
        color: validated.color || null,
        icon: validated.icon || null,
      })
      .returning();

    revalidatePath("/app/settings/businesses");
    return newBusiness[0];
  }
);

const UpdateBusinessSchema = z.object({
  businessId: z.string(),
  name: z.string().min(1, "Business name is required").max(100),
  type: z.enum(BUSINESS_TYPES),
  description: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateBusiness = createAuthenticatedAction(
  "updateBusiness",
  async (userId, data: z.infer<typeof UpdateBusinessSchema>) => {
    const validated = UpdateBusinessSchema.parse(data);

    const business = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, validated.businessId))
      .limit(1);

    if (business.length === 0 || business[0].userId !== userId) {
      throw new Error("Business not found or unauthorized");
    }

    await db
      .update(businesses)
      .set({
        name: validated.name,
        type: validated.type,
        description: validated.description || null,
        taxId: validated.taxId || null,
        address: validated.address || null,
        color: validated.color || null,
        icon: validated.icon || null,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, validated.businessId));

    revalidatePath("/app/settings/businesses");
    return { success: true };
  }
);

const DeleteBusinessSchema = z.object({
  businessId: z.string(),
});

export const deleteBusiness = createAuthenticatedAction(
  "deleteBusiness",
  async (userId, data: z.infer<typeof DeleteBusinessSchema>) => {
    const validated = DeleteBusinessSchema.parse(data);

    const business = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, validated.businessId))
      .limit(1);

    if (business.length === 0 || business[0].userId !== userId) {
      throw new Error("Business not found or unauthorized");
    }

    await db.delete(businesses).where(eq(businesses.id, validated.businessId));

    revalidatePath("/app/settings/businesses");
    return { success: true };
  }
);

