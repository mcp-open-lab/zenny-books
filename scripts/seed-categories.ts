import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";

const SYSTEM_CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Utilities",
  "Office Supplies",
  "Travel",
  "Professional Services",
  "Software & Subscriptions",
  "Rent & Lease",
  "Advertising & Marketing",
  "Insurance",
  "Taxes",
  "Other",
];

async function seedCategories() {
  console.log("Starting category seeding...");

  try {
    // Check if system categories already exist
    const existingCategories = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.type, "system"),
          eq(categories.userId, null as any)
        )
      );

    if (existingCategories.length > 0) {
      console.log(
        `Found ${existingCategories.length} existing system categories. Skipping seed.`
      );
      return;
    }

    // Insert system categories
    const categoriesToInsert = SYSTEM_CATEGORIES.map((name) => ({
      id: createId(),
      name,
      type: "system",
      userId: null,
      parentId: null,
    }));

    await db.insert(categories).values(categoriesToInsert);

    console.log(`✓ Successfully seeded ${SYSTEM_CATEGORIES.length} system categories`);
    console.log("Categories:", SYSTEM_CATEGORIES.join(", "));
  } catch (error) {
    console.error("Error seeding categories:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedCategories()
    .then(() => {
      console.log("Seed completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedCategories };

