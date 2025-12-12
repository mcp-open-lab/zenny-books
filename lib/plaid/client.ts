/**
 * Plaid API Client
 * Initializes and exports the Plaid client for server-side use
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;

// Log environment for debugging (only in non-production to avoid noise)
if (process.env.NODE_ENV !== "production") {
  console.log("[Plaid Client] Environment:", PLAID_ENV);
  console.log("[Plaid Client] PLAID_ENV from env:", process.env.PLAID_ENV || "not set (defaulting to sandbox)");
}

if (!PLAID_CLIENT_ID) {
  console.warn("PLAID_CLIENT_ID is not set");
}

if (!PLAID_SECRET) {
  console.warn("PLAID_SECRET is not set");
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export const PLAID_PRODUCTS = ["transactions"] as const;
export const PLAID_COUNTRY_CODES = ["US", "CA"] as const;

export function isPlaidConfigured(): boolean {
  return Boolean(PLAID_CLIENT_ID && PLAID_SECRET);
}

