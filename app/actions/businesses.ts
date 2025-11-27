"use server";

import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { createSafeAction } from "@/lib/safe-action";
import { devLogger } from "@/lib/dev-logger";
import { BUSINESS_TYPES } from "@/lib/constants";

// Get all businesses for the current user
export async function getUserBusinesses() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const userBusinesses = await db
    .select()
    .from(businesses)
    .where(eq(businesses.userId, userId))
    .orderBy(businesses.name);

  return userBusinesses;
}

// Create a new business
const CreateBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(100),
  type: z.enum(BUSINESS_TYPES),
  description: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const createBusiness = createSafeAction(
  "createBusiness",
  async (data: z.infer<typeof CreateBusinessSchema>) => {
    const validated = CreateBusinessSchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    devLogger.info("Creating business", {
      context: { businessName: validated.name, type: validated.type, userId },
    });

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

    devLogger.info("Business created successfully", {
      context: {
        businessId: newBusiness[0].id,
        businessName: newBusiness[0].name,
      },
    });

    revalidatePath("/app/settings/businesses");
    return newBusiness[0];
  }
);

// Update a business
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

export const updateBusiness = createSafeAction(
  "updateBusiness",
  async (data: z.infer<typeof UpdateBusinessSchema>) => {
    const validated = UpdateBusinessSchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify ownership
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

    devLogger.info("Business updated", {
      context: { businessId: validated.businessId },
    });

    revalidatePath("/app/settings/businesses");
    return { success: true };
  }
);

// Delete a business
const DeleteBusinessSchema = z.object({
  businessId: z.string(),
});

export const deleteBusiness = createSafeAction(
  "deleteBusiness",
  async (data: z.infer<typeof DeleteBusinessSchema>) => {
    const validated = DeleteBusinessSchema.parse(data);
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Verify ownership
    const business = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, validated.businessId))
      .limit(1);

    if (business.length === 0 || business[0].userId !== userId) {
      throw new Error("Business not found or unauthorized");
    }

    /**
     * IMPLICATIONS OF DELETING A BUSINESS:
     *
     * 1. Existing Transactions:
     *    - Transactions linked to this business will still have the businessId
     *    - They will become "orphaned" references
     *    - Consider updating them to businessId=null (personal) before deleting
     *
     * 2. Reporting:
     *    - Historical reports may show invalid business references
     *    - Consider archiving instead of deleting
     *
     * 3. No Cascade:
     *    - businessId is nullable, so no foreign key constraints
     *    - Deletion is immediate and permanent
     */

    await db
      .delete(businesses)
      .where(eq(businesses.id, validated.businessId));

    devLogger.info("Business deleted", {
      context: { businessId: validated.businessId },
    });

    revalidatePath("/app/settings/businesses");
    return { success: true };
  }
);

