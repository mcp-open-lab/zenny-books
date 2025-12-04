/**
 * Wipe all user data - database documents AND UploadThing files
 * NOTE: Categories and User Settings are ALWAYS preserved
 *
 * Usage:
 *   npm run wipe -- --confirm
 */

import { db } from "@/lib/db";
import {
  importBatchItems,
  bankStatementTransactions,
  receipts,
  bankStatements,
  invoices,
  documentExtractions,
  documentMetadata,
  documents,
  importBatches,
  batchActivityLogs,
  linkedBankAccounts,
  categoryBudgets,
  categoryRules,
  businesses,
  llmLogs,
} from "@/lib/db/schema";
import { UTApi } from "uploadthing/server";

async function wipeAll() {
  const args = process.argv.join(" ");
  const hasConfirm = args.includes("--confirm") || args.includes("-y");

  if (!hasConfirm) {
    console.log(
      "\n⚠️  WARNING: This will delete ALL documents, accounts, and uploaded files!"
    );
    console.log("   Categories and user settings are always preserved.");
    console.log("   Run with --confirm flag to proceed.");
    console.log("   Example: npm run wipe -- --confirm\n");
    process.exit(0);
  }

  console.log("\n🗑️  Starting full wipe...\n");

  // Step 1: Delete UploadThing files
  console.log("📁 UPLOADTHING FILES");
  console.log("─".repeat(40));

  try {
    const utapi = new UTApi();
    const response = await utapi.listFiles();
    const files = Array.isArray(response)
      ? response
      : (response as any)?.files || [];

    if (files.length === 0) {
      console.log("   No files found.\n");
    } else {
      console.log(`   Found ${files.length} file(s). Deleting...`);

      const fileKeys = files.map((f: any) => f.key || f.id).filter(Boolean);
      const batchSize = 10;

      for (let i = 0; i < fileKeys.length; i += batchSize) {
        const batch = fileKeys.slice(i, i + batchSize);
        await utapi.deleteFiles(batch);

        if (i + batchSize < fileKeys.length) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      console.log(`   ✅ Deleted ${files.length} file(s).\n`);
    }
  } catch (error) {
    console.log(
      `   ⚠️  UploadThing error: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
  }

  // Step 2: Delete database records (order matters for foreign keys)
  console.log("🗄️  DATABASE RECORDS");
  console.log("─".repeat(40));

  try {
    // Delete in order of dependencies (children first)
    const tables = [
      // Activity & logs
      { name: "batch_activity_logs", table: batchActivityLogs },
      { name: "llm_logs", table: llmLogs },

      // Import items
      { name: "import_batch_items", table: importBatchItems },

      // Transactions & receipts
      { name: "bank_statement_transactions", table: bankStatementTransactions },
      { name: "receipts", table: receipts },

      // Statements & invoices
      { name: "bank_statements", table: bankStatements },
      { name: "invoices", table: invoices },

      // Document metadata
      { name: "document_extractions", table: documentExtractions },
      { name: "document_metadata", table: documentMetadata },

      // Documents
      { name: "documents", table: documents },

      // Import batches
      { name: "import_batches", table: importBatches },

      // Plaid linked accounts
      { name: "linked_bank_accounts", table: linkedBankAccounts },

      // Budgets & rules
      { name: "category_budgets", table: categoryBudgets },
      { name: "category_rules", table: categoryRules },

      // Businesses
      { name: "businesses", table: businesses },
    ];

    for (const { name, table } of tables) {
      await db.delete(table);
      console.log(`   ✅ ${name}`);
    }

    // These are NEVER deleted - they should persist across wipes
    console.log(`   ⏭️  categories (preserved)`);
    console.log(`   ⏭️  user_settings (preserved)`);

    console.log("\n✅ Wipe completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Database error:", error);
    process.exit(1);
  }
}

wipeAll()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
