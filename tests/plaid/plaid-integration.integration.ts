/**
 * Plaid Integration Tests
 * Uses real Plaid sandbox API for testing
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  SandboxItemFireWebhookRequestWebhookCodeEnum,
} from "plaid";

// Skip DB-dependent tests if no real DB connection
const SKIP_DB_TESTS = true;

// Set longer timeout for API calls
const API_TIMEOUT = 30000;

// These tests require sandbox mode - skip if using development/production
const IS_SANDBOX = process.env.PLAID_ENV === "sandbox" || !process.env.PLAID_ENV;
const PLAID_SANDBOX_SECRET = process.env.PLAID_SANDBOX_SECRET || process.env.PLAID_SECRET;

describe("Plaid Sandbox Integration", () => {
  let plaidClient: PlaidApi;
  let accessToken: string | null = null;
  let itemId: string | null = null;

  beforeAll(() => {
    // Initialize Plaid client with sandbox credentials
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = PLAID_SANDBOX_SECRET;

    if (!clientId || !secret) {
      console.warn(
        "Skipping Plaid tests: PLAID_CLIENT_ID or PLAID_SANDBOX_SECRET not set"
      );
      return;
    }

    if (!IS_SANDBOX && !process.env.PLAID_SANDBOX_SECRET) {
      console.warn(
        "Skipping Plaid sandbox tests: PLAID_ENV is not sandbox and PLAID_SANDBOX_SECRET not set. " +
        "Set PLAID_SANDBOX_SECRET to your sandbox secret to run these tests."
      );
      // Don't initialize plaidClient - tests will skip
      return;
    }

    const configuration = new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    });

    plaidClient = new PlaidApi(configuration);
  });

  afterAll(async () => {
    // Clean up: remove the test item if created
    if (accessToken && plaidClient) {
      try {
        await plaidClient.itemRemove({ access_token: accessToken });
        console.log("Cleaned up test Plaid item");
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Link Token", () => {
    it(
      "should create a valid link token",
      async () => {
        if (!plaidClient) {
          console.log("Skipping: Plaid not configured");
          return;
        }

        const response = await plaidClient.linkTokenCreate({
          user: { client_user_id: "test-user-123" },
          client_name: "Turbo Invoice Test",
          products: [Products.Transactions],
          country_codes: [CountryCode.Us],
          language: "en",
        });

        expect(response.data.link_token).toBeDefined();
        expect(response.data.link_token).toMatch(/^link-sandbox-/);
        expect(response.data.expiration).toBeDefined();
      },
      API_TIMEOUT
    );
  });

  describe("Sandbox Public Token", () => {
    it(
      "should create a sandbox public token and exchange it",
      async () => {
        if (!plaidClient) {
          console.log("Skipping: Plaid not configured");
          return;
        }

        // Create a sandbox public token (simulates completing Plaid Link)
        const sandboxResponse = await plaidClient.sandboxPublicTokenCreate({
          institution_id: "ins_109508", // First Platypus Bank (sandbox institution)
          initial_products: [Products.Transactions],
        });

        expect(sandboxResponse.data.public_token).toBeDefined();
        expect(sandboxResponse.data.public_token).toMatch(/^public-sandbox-/);

        // Exchange the public token for an access token
        const exchangeResponse = await plaidClient.itemPublicTokenExchange({
          public_token: sandboxResponse.data.public_token,
        });

        expect(exchangeResponse.data.access_token).toBeDefined();
        expect(exchangeResponse.data.item_id).toBeDefined();

        // Save for subsequent tests
        accessToken = exchangeResponse.data.access_token;
        itemId = exchangeResponse.data.item_id;
      },
      API_TIMEOUT
    );
  });

  describe("Account Information", () => {
    it(
      "should fetch account information",
      async () => {
        if (!plaidClient || !accessToken) {
          console.log("Skipping: No access token available");
          return;
        }

        const response = await plaidClient.accountsGet({
          access_token: accessToken,
        });

        expect(response.data.accounts).toBeDefined();
        expect(response.data.accounts.length).toBeGreaterThan(0);

        const account = response.data.accounts[0];
        expect(account.account_id).toBeDefined();
        expect(account.name).toBeDefined();
        expect(account.type).toBeDefined();

        console.log(`Found ${response.data.accounts.length} accounts:`);
        response.data.accounts.forEach((acc) => {
          console.log(
            `  - ${acc.name} (${acc.type}/${acc.subtype}) ****${acc.mask}`
          );
        });
      },
      API_TIMEOUT
    );

    it(
      "should fetch institution information",
      async () => {
        if (!plaidClient || !accessToken) {
          console.log("Skipping: No access token available");
          return;
        }

        const itemResponse = await plaidClient.itemGet({
          access_token: accessToken,
        });

        expect(itemResponse.data.item).toBeDefined();
        expect(itemResponse.data.item.institution_id).toBeDefined();

        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: itemResponse.data.item.institution_id!,
          country_codes: [CountryCode.Us],
        });

        expect(institutionResponse.data.institution.name).toBeDefined();
        console.log(
          `Institution: ${institutionResponse.data.institution.name}`
        );
      },
      API_TIMEOUT
    );
  });

  describe("Transaction Sync", () => {
    it(
      "should sync transactions using transactionsSync",
      async () => {
        if (!plaidClient || !accessToken) {
          console.log("Skipping: No access token available");
          return;
        }

        // Fire the SYNC_UPDATES_AVAILABLE webhook to populate transactions
        // This is required for sandbox with transactionsSync endpoint
        try {
          await plaidClient.sandboxItemFireWebhook({
            access_token: accessToken,
            webhook_code:
              SandboxItemFireWebhookRequestWebhookCodeEnum.SyncUpdatesAvailable,
          });
          // Wait for transactions to populate
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (e) {
          console.log("Note: Could not fire webhook, trying sync anyway");
        }

        let cursor: string | undefined = undefined;
        let allTransactions: any[] = [];
        let hasMore = true;

        while (hasMore) {
          const response = await plaidClient.transactionsSync({
            access_token: accessToken,
            cursor,
            count: 100,
          });

          allTransactions = allTransactions.concat(response.data.added);
          hasMore = response.data.has_more;
          cursor = response.data.next_cursor;
        }

        // Log results
        console.log(`Synced ${allTransactions.length} transactions`);

        // Sandbox may not have immediate transactions - verify sync worked
        // by checking cursor was returned (indicates successful sync)
        expect(cursor).toBeDefined();

        if (allTransactions.length > 0) {
          // Log first few transactions
          allTransactions.slice(0, 5).forEach((tx) => {
            console.log(`  - ${tx.date}: ${tx.name} $${tx.amount}`);
          });

          // Verify transaction structure
          const firstTx = allTransactions[0];
          expect(firstTx.transaction_id).toBeDefined();
          expect(firstTx.date).toBeDefined();
          expect(firstTx.amount).toBeDefined();
          expect(typeof firstTx.amount).toBe("number");
        } else {
          console.log(
            "No transactions returned (expected for fresh sandbox item)"
          );
        }
      },
      API_TIMEOUT
    );
  });

  describe("Transaction Mapper", () => {
    it("should map Plaid transactions to normalized format", async () => {
      // Import the mapper
      const { mapPlaidTransactions } = await import(
        "@/lib/plaid/transaction-mapper"
      );

      // Create mock Plaid transactions
      const mockPlaidTransactions = [
        {
          account_id: "test-account",
          transaction_id: "tx-001",
          date: "2025-01-15",
          authorized_date: "2025-01-14",
          name: "AMAZON MARKETPLACE",
          merchant_name: "Amazon",
          amount: 49.99, // Plaid: positive = debit
          iso_currency_code: "USD",
          personal_finance_category: {
            primary: "SHOPPING",
            detailed: "SHOPPING_GENERAL",
          },
          payment_channel: "online",
          pending: false,
        },
        {
          account_id: "test-account",
          transaction_id: "tx-002",
          date: "2025-01-14",
          authorized_date: null,
          name: "PAYROLL DEPOSIT",
          merchant_name: null,
          amount: -2500.0, // Plaid: negative = credit
          iso_currency_code: "USD",
          personal_finance_category: {
            primary: "INCOME",
            detailed: "INCOME_WAGES",
          },
          payment_channel: "other",
          pending: false,
        },
      ] as any;

      const normalized = mapPlaidTransactions(
        mockPlaidTransactions,
        "test-account"
      );

      expect(normalized).toHaveLength(2);

      // First transaction (debit)
      expect(normalized[0].amount).toBe(-49.99); // Flipped: negative = expense
      expect(normalized[0].merchantName).toBe("Amazon");
      expect(normalized[0].description).toBe("AMAZON MARKETPLACE");
      expect(normalized[0].currency).toBe("USD");
      expect(normalized[0].referenceNumber).toBe("tx-001");

      // Second transaction (credit)
      expect(normalized[1].amount).toBe(2500.0); // Flipped: positive = income
      expect(normalized[1].description).toBe("PAYROLL DEPOSIT");
    });

    it("should extract merchant name from transaction name", async () => {
      const { mapPlaidTransactions } = await import(
        "@/lib/plaid/transaction-mapper"
      );

      const mockTransactions = [
        {
          account_id: "test",
          transaction_id: "tx-003",
          date: "2025-01-15",
          name: "STARBUCKS #12345 - CA",
          merchant_name: null,
          amount: 5.75,
          iso_currency_code: "USD",
        },
      ] as any;

      const normalized = mapPlaidTransactions(mockTransactions, "test");

      // Should clean up the name and extract merchant
      expect(normalized[0].merchantName).toBeDefined();
      expect(normalized[0].merchantName?.toLowerCase()).toContain("starbucks");
    });
  });
});
