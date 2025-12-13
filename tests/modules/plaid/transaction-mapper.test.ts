import { describe, it, expect } from "vitest";
import type { Transaction as PlaidTransaction } from "plaid";
import { mapPlaidTransactions } from "@/lib/plaid/transaction-mapper";

function tx(overrides: Partial<PlaidTransaction>): PlaidTransaction {
  return {
    account_id: "acct_1",
    amount: 10,
    iso_currency_code: "CAD",
    unofficial_currency_code: null,
    date: "2025-12-01",
    authorized_date: "2025-12-01",
    name: "Test",
    original_description: null,
    merchant_name: null,
    pending: false,
    transaction_id: "tx_1",
    payment_channel: "online",
    personal_finance_category: null,
    ...overrides,
  } as unknown as PlaidTransaction;
}

describe("mapPlaidTransactions", () => {
  it("flags credit card payments as excluded from totals", () => {
    const transactions = [
      tx({
        amount: -1914.96, // Plaid credit (money in) on credit card account
        name: "Payment Received - Thank You",
        personal_finance_category: {
          primary: "LOAN_PAYMENTS",
          detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
        } as any,
      }),
    ];

    const [mapped] = mapPlaidTransactions(transactions, "acct_1");
    expect(mapped.amount).toBeCloseTo(1914.96);
    expect(mapped.flags?.isExcludedFromTotals).toBe(true);
    expect(mapped.flags?.isInternalTransfer).toBe(true);
    expect(mapped.flags?.exclusionReason).toBe("credit_card_payment");
  });

  it("does not flag regular expenses as transfers", () => {
    const transactions = [
      tx({
        amount: 43.64, // Plaid debit (money out) becomes negative expense
        name: "BRIDGE BREWING - PEMBERT",
        personal_finance_category: {
          primary: "FOOD_AND_DRINK",
          detailed: "FOOD_AND_DRINK_RESTAURANTS",
        } as any,
      }),
    ];

    const [mapped] = mapPlaidTransactions(transactions, "acct_1");
    expect(mapped.amount).toBeCloseTo(-43.64);
    expect(mapped.flags?.isExcludedFromTotals).not.toBe(true);
    expect(mapped.flags?.isInternalTransfer).not.toBe(true);
  });
});


