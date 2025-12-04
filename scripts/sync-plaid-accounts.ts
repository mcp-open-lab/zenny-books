// Must load env BEFORE any imports that use it
import { config } from 'dotenv';
const result = config({ path: '.env.local' });
console.log('Dotenv loaded:', result.parsed ? Object.keys(result.parsed).filter(k => k.startsWith('PLAID')).join(', ') : 'failed');
console.log('PLAID_CLIENT_ID set:', !!process.env.PLAID_CLIENT_ID);
console.log('PLAID_SECRET set:', !!process.env.PLAID_SECRET);

// Now we can safely import modules that use these env vars
import { db } from '@/lib/db';
import { linkedBankAccounts } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

async function syncAllAccounts() {
  // Create a fresh Plaid client with the env vars now loaded
  const plaidClient = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    })
  );

  const accounts = await db.select().from(linkedBankAccounts).orderBy(desc(linkedBankAccounts.createdAt));
  
  console.log(`\nFound ${accounts.length} linked accounts to sync\n`);
  
  for (const account of accounts) {
    console.log(`Syncing: ${account.institutionName} - ${account.accountName} (****${account.accountMask})`);
    console.log(`  Access token: ${account.plaidAccessToken.substring(0, 20)}...`);
    
    try {
      let cursor = account.lastSyncCursor || undefined;
      let hasMore = true;
      let addedTransactions: any[] = [];

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: account.plaidAccessToken,
          cursor,
          count: 500,
        });

        addedTransactions = addedTransactions.concat(response.data.added);
        hasMore = response.data.has_more;
        cursor = response.data.next_cursor;
      }

      console.log(`  SUCCESS: Found ${addedTransactions.length} transactions`);
      
      // Show first 3 transactions
      for (const tx of addedTransactions.slice(0, 3)) {
        console.log(`    - ${tx.date}: ${tx.name} $${tx.amount}`);
      }
    } catch (error: any) {
      console.error(`  ERROR:`, error?.response?.data || error.message);
    }
    console.log('');
  }
}

syncAllAccounts().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
