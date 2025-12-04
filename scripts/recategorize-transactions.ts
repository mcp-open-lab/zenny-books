/**
 * Re-categorize uncategorized bank statement transactions using AI
 * 
 * Usage:
 *   npx tsx scripts/recategorize-transactions.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { bankStatementTransactions, bankStatements, documents } from "@/lib/db/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { CategoryEngine } from "@/lib/categorization/engine";

async function recategorizeTransactions() {
  // Get uncategorized transactions with their user IDs
  console.log("Fetching uncategorized transactions...\n");
  
  const uncategorized = await db
    .select({
      id: bankStatementTransactions.id,
      description: bankStatementTransactions.description,
      merchantName: bankStatementTransactions.merchantName,
      amount: bankStatementTransactions.amount,
      userId: documents.userId,
    })
    .from(bankStatementTransactions)
    .innerJoin(bankStatements, eq(bankStatementTransactions.bankStatementId, bankStatements.id))
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .where(isNull(bankStatementTransactions.categoryId));
  
  console.log(`Found ${uncategorized.length} uncategorized transactions\n`);

  if (uncategorized.length === 0) {
    console.log("All transactions are already categorized!");
    return;
  }

  let categorizedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < uncategorized.length; i++) {
    const tx = uncategorized[i];
    
    try {
      const result = await CategoryEngine.categorizeWithAI(
        {
          merchantName: tx.merchantName,
          description: tx.description,
          amount: tx.amount,
        },
        {
          userId: tx.userId,
          includeAI: true,
          minConfidence: 0.5, // Lower threshold for batch processing
        }
      );

      if (result.categoryId) {
        await db
          .update(bankStatementTransactions)
          .set({ 
            categoryId: result.categoryId,
            category: result.categoryName,
          })
          .where(eq(bankStatementTransactions.id, tx.id));
        
        categorizedCount++;
        
        if (categorizedCount % 10 === 0) {
          console.log(`Progress: ${categorizedCount} categorized, ${skippedCount} skipped (${i + 1}/${uncategorized.length})`);
        }
      } else {
        skippedCount++;
      }
    } catch (error) {
      errorCount++;
      console.error(`Error categorizing tx ${tx.id}:`, error);
    }
    
    // Small delay to avoid rate limits
    if (i % 20 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Categorized: ${categorizedCount}`);
  console.log(`   Skipped (no match): ${skippedCount}`);
  console.log(`   Errors: ${errorCount}`);
  
  const remaining = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bankStatementTransactions)
    .where(isNull(bankStatementTransactions.categoryId));
  
  console.log(`   Still uncategorized: ${remaining[0].count}`);
}

recategorizeTransactions()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

