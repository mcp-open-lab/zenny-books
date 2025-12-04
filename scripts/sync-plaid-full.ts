// Must load env BEFORE any imports that use it
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/lib/db';
import { linkedBankAccounts } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { documents, bankStatements, bankStatementTransactions } from '@/lib/db/schema';
import { mapPlaidTransactions } from '@/lib/plaid/transaction-mapper';

async function syncAllAccountsFull() {
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
  
  console.log(`Found ${accounts.length} linked accounts to sync\n`);
  
  for (const account of accounts) {
    console.log(`Syncing: ${account.institutionName} - ${account.accountName} (****${account.accountMask})`);
    
    try {
      // Update sync status
      await db.update(linkedBankAccounts)
        .set({ syncStatus: 'syncing', syncErrorMessage: null })
        .where(eq(linkedBankAccounts.id, account.id));

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

      console.log(`  Found ${addedTransactions.length} total transactions from Plaid`);
      
      // Filter to only this account's transactions
      const accountTransactions = addedTransactions.filter(tx => tx.account_id === account.plaidAccountId);
      console.log(`  Filtered to ${accountTransactions.length} transactions for this account`);
      
      if (accountTransactions.length === 0) {
        await db.update(linkedBankAccounts)
          .set({ 
            lastSyncedAt: new Date(), 
            lastSyncCursor: cursor, 
            syncStatus: 'active' 
          })
          .where(eq(linkedBankAccounts.id, account.id));
        console.log('  No transactions to import\n');
        continue;
      }

      // Create a document record for this sync
      const documentId = createId();
      await db.insert(documents).values({
        id: documentId,
        userId: account.userId,
        documentType: 'bank_statement',
        fileFormat: 'plaid_sync',
        fileName: `${account.institutionName || 'Bank'} - ${account.accountName || 'Account'} Sync`,
        fileUrl: `plaid://${account.plaidItemId}/${account.plaidAccountId}`,
        status: 'completed',
        extractionMethod: 'plaid_sync',
        extractionConfidence: '1.00',
        extractedAt: new Date(),
        processedAt: new Date(),
      });

      // Create a bank statement record
      const bankStatementId = createId();
      await db.insert(bankStatements).values({
        id: bankStatementId,
        documentId,
        bankName: account.institutionName,
        accountType: account.accountType,
        accountNumber: account.accountMask ? `****${account.accountMask}` : undefined,
        transactionCount: accountTransactions.length,
        processedTransactionCount: accountTransactions.length,
      });

      // Map and insert transactions
      const normalizedTransactions = mapPlaidTransactions(accountTransactions, account.plaidAccountId);

      let order = 0;
      for (const tx of normalizedTransactions) {
        await db.insert(bankStatementTransactions).values({
          id: createId(),
          bankStatementId,
          transactionDate: tx.transactionDate,
          postedDate: tx.postedDate,
          description: tx.description,
          merchantName: tx.merchantName,
          referenceNumber: tx.referenceNumber,
          amount: (tx.amount ?? 0).toString(),
          currency: tx.currency,
          order: order++,
        });
      }

      // Update the account with sync results
      await db.update(linkedBankAccounts)
        .set({
          lastSyncedAt: new Date(),
          lastSyncCursor: cursor,
          syncStatus: 'active',
          syncErrorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(linkedBankAccounts.id, account.id));

      console.log(`  SUCCESS: Imported ${accountTransactions.length} transactions\n`);
      
    } catch (error: any) {
      console.error(`  ERROR:`, error?.response?.data || error.message);
      
      await db.update(linkedBankAccounts)
        .set({
          syncStatus: 'error',
          syncErrorMessage: error?.response?.data?.error_message || error.message || 'Sync failed',
          updatedAt: new Date(),
        })
        .where(eq(linkedBankAccounts.id, account.id));
    }
  }
}

syncAllAccountsFull().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
