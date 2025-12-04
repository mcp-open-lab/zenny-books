/**
 * Update webhook URLs for all existing Plaid items
 * Run this after deploying to set webhooks for already-linked accounts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '@/lib/db';
import { linkedBankAccounts } from '@/lib/db/schema';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const WEBHOOK_URL = process.env.PLAID_WEBHOOK_URL 
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/plaid/webhook` : null)
  || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook` : null);

async function updateAllWebhooks() {
  if (!WEBHOOK_URL) {
    console.error('No webhook URL configured. Set PLAID_WEBHOOK_URL, VERCEL_URL, or NEXT_PUBLIC_APP_URL');
    process.exit(1);
  }

  console.log(`Webhook URL: ${WEBHOOK_URL}\n`);

  const plaidClient = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments || 'sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    })
  );

  // Get unique items (one per plaidItemId)
  const accounts = await db.select().from(linkedBankAccounts);
  const uniqueItems = new Map<string, typeof accounts[0]>();
  
  for (const account of accounts) {
    if (!uniqueItems.has(account.plaidItemId)) {
      uniqueItems.set(account.plaidItemId, account);
    }
  }

  console.log(`Found ${uniqueItems.size} unique Plaid items to update\n`);

  for (const [itemId, account] of uniqueItems) {
    console.log(`Updating: ${account.institutionName} (item: ${itemId.substring(0, 20)}...)`);
    
    try {
      await plaidClient.itemWebhookUpdate({
        access_token: account.plaidAccessToken,
        webhook: WEBHOOK_URL,
      });
      console.log(`  ✓ Webhook updated successfully\n`);
    } catch (error: any) {
      console.error(`  ✗ Failed:`, error?.response?.data?.error_message || error.message, '\n');
    }
  }

  console.log('Done!');
}

updateAllWebhooks().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
