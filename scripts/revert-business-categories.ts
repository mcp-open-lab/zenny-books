/**
 * Revert Migration: Business Categories
 * 
 * This script reverts the previous migration that incorrectly changed
 * usageScope from 'both' to 'business'.
 * 
 * What it does:
 * 1. Updates all system categories back to usageScope='both'
 *    (Most categories should be usable for both personal and business)
 * 
 * The businessId field on transactions determines if it's personal or business:
 * - businessId=NULL → personal transaction
 * - businessId=set → business transaction
 */

import { db } from "../lib/db";
import { categories } from "../lib/db/schema";
import { eq, and } from "drizzle-orm";

async function revert() {
  console.log("Reverting business categories migration...\n");

  try {
    // Revert system categories back to 'both' (they should be usable for both contexts)
    console.log("Reverting system categories to usageScope='both'...");
    const updateResult = await db
      .update(categories)
      .set({ 
        usageScope: "both",
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(categories.type, "system"),
          eq(categories.usageScope, "business")
        )
      )
      .returning();

    console.log(
      `✓ Reverted ${updateResult.length} categories back to 'both'\n`
    );

    console.log("Revert completed successfully! ✨");
    console.log("\nSummary:");
    console.log(`- Reverted ${updateResult.length} system categories to usageScope='both'`);
    console.log("\nCategories can now be used for both personal and business transactions.");
    console.log("The businessId field on the transaction determines its context.");
  } catch (error) {
    console.error("Revert failed:", error);
    throw error;
  }
}

revert()
  .then(() => {
    console.log("\nRevert finished!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Revert error:", error);
    process.exit(1);
  });

