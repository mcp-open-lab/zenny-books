import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/lib/db';
import { linkedBankAccounts, bankStatements, bankStatementTransactions, documents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function checkPlaidData() {
  // Get all linked accounts
  const accounts = await db.select().from(linkedBankAccounts).orderBy(desc(linkedBankAccounts.createdAt));
  console.log('=== LINKED BANK ACCOUNTS ===');
  console.log('Count:', accounts.length);
  for (const acc of accounts) {
    console.log(`- ${acc.institutionName} | ${acc.accountName} (****${acc.accountMask}) | Type: ${acc.accountType}/${acc.accountSubtype} | Status: ${acc.syncStatus} | Last sync: ${acc.lastSyncedAt || 'never'}`);
  }
  
  // Get Plaid-related documents
  const plaidDocs = await db.select()
    .from(documents)
    .where(eq(documents.extractionMethod, 'plaid_sync'))
    .orderBy(desc(documents.createdAt));
  console.log('\n=== PLAID SYNC DOCUMENTS ===');
  console.log('Count:', plaidDocs.length);
  
  // Get recent bank statements
  const statements = await db.select()
    .from(bankStatements)
    .orderBy(desc(bankStatements.createdAt))
    .limit(10);
  console.log('\n=== RECENT BANK STATEMENTS ===');
  for (const stmt of statements) {
    console.log(`- ${stmt.bankName || 'Unknown'} | Txn count: ${stmt.transactionCount} | Created: ${stmt.createdAt}`);
    
    // Get sample transactions
    const txns = await db.select()
      .from(bankStatementTransactions)
      .where(eq(bankStatementTransactions.bankStatementId, stmt.id))
      .limit(3);
    for (const tx of txns) {
      console.log(`    ${tx.transactionDate?.toISOString().split('T')[0] || 'no date'} | ${tx.merchantName || tx.description} | $${tx.amount}`);
    }
  }
}

checkPlaidData().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
