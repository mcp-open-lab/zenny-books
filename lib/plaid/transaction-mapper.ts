/**
 * Plaid Transaction Mapper
 * Maps Plaid transactions to our NormalizedTransaction format
 */

import type { Transaction as PlaidTransaction } from "plaid";
import type { NormalizedTransaction } from "@/lib/import/spreadsheet-parser";

export interface PlaidNormalizedTransaction extends NormalizedTransaction {
  currency: string;
}

/**
 * Map Plaid transactions to normalized format
 * Note: Plaid amounts are positive for debits (money out) and negative for credits (money in)
 * We flip this to match our convention: negative for debits, positive for credits
 */
export function mapPlaidTransactions(
  transactions: PlaidTransaction[],
  accountId: string
): PlaidNormalizedTransaction[] {
  return transactions
    .filter((tx) => tx.account_id === accountId)
    .map((tx) => {
      // Plaid: positive = money out (debit), negative = money in (credit)
      // Our convention: negative = debit (expense), positive = credit (income)
      const amount = tx.amount * -1;

      return {
        transactionDate: tx.date ? new Date(tx.date) : null,
        postedDate: tx.authorized_date ? new Date(tx.authorized_date) : null,
        description: tx.name || tx.original_description || "",
        merchantName: tx.merchant_name || extractMerchantFromName(tx.name || ""),
        amount,
        referenceNumber: tx.transaction_id,
        currency: tx.iso_currency_code || tx.unofficial_currency_code || "USD",
        raw: {
          plaid_transaction_id: tx.transaction_id,
          plaid_category: tx.personal_finance_category?.primary,
          plaid_category_detailed: tx.personal_finance_category?.detailed,
          payment_channel: tx.payment_channel,
          pending: tx.pending,
        },
      };
    });
}

/**
 * Extract merchant name from transaction name
 * Plaid's `name` field often contains extra info like location
 */
function extractMerchantFromName(name: string): string | undefined {
  if (!name) return undefined;

  // Remove common suffixes like "* 12345" or "#1234"
  let cleaned = name
    .replace(/\s*[*#]\s*\d+$/i, "")
    .replace(/\s+\d{4,}$/i, "")
    .trim();

  // Remove location info (often after a dash or in parentheses)
  cleaned = cleaned
    .replace(/\s*-\s*[A-Z]{2}\s*$/i, "") // " - CA"
    .replace(/\s+[A-Z]{2}\s*$/i, "") // " CA"
    .replace(/\s*\([^)]+\)\s*$/i, ""); // " (Location)"

  // Capitalize nicely
  return cleaned
    .split(" ")
    .map((word) =>
      word.length > 2
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toUpperCase()
    )
    .join(" ");
}

