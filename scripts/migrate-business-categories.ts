/**
 * Migration: Business Table Setup
 * 
 * This migration sets up the businesses table and links existing business transactions.
 * 
 * Note: Categories keep usageScope='both' - they can be used for both personal 
 * and business transactions. The businessId field on transactions determines context:
 * - businessId=NULL → personal transaction
 * - businessId=set → business transaction
 * 
 * What it does:
 * 1. Finds users who have business transactions (isBusinessExpense='true')
 * 2. Creates a default "My Business" entry for those users
 * 3. Links existing business receipts to those businesses
 * 
 * Run with: node --env-file=.env.local -r esbuild-register scripts/migrate-business-categories.ts
 */

import { db } from "../lib/db";
import {
  categories,
  businesses,
  receipts,
  bankStatementTransactions,
} from "../lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

async function migrate() {
  console.log("Starting business table setup migration...\n");

  try {
    // Step 1: Find users with business transactions (isBusinessExpense='true')
    console.log("Step 1: Finding users with business transactions...");

    // Get unique user IDs from receipts with business expenses
    const businessReceiptUsers = await db
      .selectDistinct({ userId: receipts.userId })
      .from(receipts)
      .where(eq(receipts.isBusinessExpense, "true"));

    // Get unique user IDs from bank transactions with business expenses
    // Note: bank_statement_transactions don't have userId directly,
    // they're linked through bank_statements -> documents
    // For this migration, we'll update all bank transactions with isBusinessExpense='true'
    // regardless of user (they'll be linked by businessId in the update step)

    const allBusinessUserIds = [
      ...new Set(businessReceiptUsers.map((u) => u.userId)),
    ];

    console.log(
      `Found ${allBusinessUserIds.length} users with business transactions\n`
    );

    // Step 2: Create default business for each user
    console.log("Step 2: Creating default business for users...");
    let createdBusinessCount = 0;

    for (const userId of allBusinessUserIds) {
      // Check if user already has a business
      const existingBusiness = await db
        .select()
        .from(businesses)
        .where(eq(businesses.userId, userId))
        .limit(1);

      if (existingBusiness.length === 0) {
        // Create default business
        await db.insert(businesses).values({
          id: createId(),
          userId,
          name: "My Business",
          type: "business",
          description: "Default business (created by migration)",
        });
        createdBusinessCount++;
      }
    }

    console.log(`✓ Created ${createdBusinessCount} default businesses\n`);

    // Step 3: Link existing business transactions to default business
    console.log(
      "Step 3: Linking business transactions to default businesses..."
    );

    let linkedReceiptsCount = 0;

    for (const userId of allBusinessUserIds) {
      // Get the default business for this user
      const userBusiness = await db
        .select()
        .from(businesses)
        .where(eq(businesses.userId, userId))
        .limit(1);

      if (userBusiness.length > 0) {
        const businessId = userBusiness[0].id;

        // Update receipts
        const receiptUpdate = await db
          .update(receipts)
          .set({ businessId, updatedAt: new Date() })
          .where(
            and(
              eq(receipts.userId, userId),
              eq(receipts.isBusinessExpense, "true")
            )
          )
          .returning();

        linkedReceiptsCount += receiptUpdate.length;
      }
    }

    console.log(`✓ Linked ${linkedReceiptsCount} receipts to businesses\n`);

    console.log("Migration completed successfully! ✨");
    console.log("\nSummary:");
    console.log(`- Created ${createdBusinessCount} default businesses`);
    console.log(`- Linked ${linkedReceiptsCount} business receipts`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run the migration
migrate()
  .then(() => {
    console.log(
      "\nMigration finished. You can now use the new business categorization system!"
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nMigration error:", error);
    process.exit(1);
  });
