/**
 * Transaction Flags
 * Flexible JSONB flags for handling edge cases in transactions
 */

export type ExclusionReason =
  | "duplicate"
  | "internal_transfer"
  | "credit_card_payment"
  | "manual"
  | "bnpl_installment"
  | "installment_plan_credit";

export type TransactionFlags = {
  // Duplicate detection
  isDuplicate?: boolean;
  linkedTransactionId?: string;
  linkedTransactionType?: "receipt" | "bank_transaction";
  duplicateConfidence?: number; // 0.0 to 1.0

  // Internal transfers
  isInternalTransfer?: boolean;
  transferToAccountId?: string; // For future Plaid account linking

  // Budget/totals exclusion
  isExcludedFromTotals?: boolean;
  exclusionReason?: ExclusionReason;

  // Buy Now Pay Later (BNPL)
  isBnplPurchase?: boolean;
  bnplOriginalAmount?: string;
  bnplRemainingInstallments?: number;
  bnplProvider?: "affirm" | "klarna" | "afterpay" | "apple_pay_later" | "other";

  // Plaid integration
  isPlaidImported?: boolean;
  plaidTransactionId?: string;
  plaidAccountId?: string;
  plaidStatus?: "pending" | "posted"; // Plaid transaction status

  // User verification
  userVerified?: boolean; // User manually confirmed classification
  verifiedAt?: string; // ISO timestamp

  // System metadata
  autoDetected?: boolean; // Was this flag set by system vs user
  detectionMethod?: string; // e.g., "fuzzy_match", "rule_based", "user_manual"
  detectionConfidence?: number; // 0.0 to 1.0
};

// BNPL merchant patterns for detection
export const BNPL_MERCHANT_PATTERNS = [
  /affirm/i,
  /klarna/i,
  /afterpay/i,
  /apple\s*pay\s*later/i,
  /sezzle/i,
  /zip\s*pay/i,
  /quadpay/i,
  /splitit/i,
] as const;

// Internal transfer keywords for detection
export const INTERNAL_TRANSFER_KEYWORDS = [
  /^transfer\s*to/i,
  /^transfer\s*from/i,
  /^payment\s*to.*credit\s*card/i,
  /^e-transfer/i,
  /^interac\s*e-transfer/i,
  /^wire\s*transfer/i,
  /^ach\s*transfer/i,
  /^zelle/i,
] as const;

// Credit card payment patterns
export const CREDIT_CARD_PAYMENT_PATTERNS = [
  /credit\s*card\s*payment/i,
  /^payment.*thank\s*you/i,
  /^autopay/i,
  /^automatic\s*payment/i,
] as const;

// Installment plan credit patterns (Amex, etc.)
// These are credits when converting purchases to installment plans - not real income
export const INSTALLMENT_PLAN_CREDIT_PATTERNS = [
  /installment\s*plan/i,
  /plan\s*it/i,
  /pay\s*over\s*time/i,
] as const;

// Helper functions for detection
export function detectBnplMerchant(merchantName: string): boolean {
  if (!merchantName) return false;
  return BNPL_MERCHANT_PATTERNS.some((pattern) => pattern.test(merchantName));
}

export function detectInternalTransfer(description: string): boolean {
  if (!description) return false;
  return INTERNAL_TRANSFER_KEYWORDS.some((pattern) =>
    pattern.test(description)
  );
}

export function detectCreditCardPayment(description: string): boolean {
  if (!description) return false;
  return CREDIT_CARD_PAYMENT_PATTERNS.some((pattern) =>
    pattern.test(description)
  );
}

/**
 * Detect installment plan credits (e.g., Amex Plan It credits)
 * These are credits when converting purchases to installment plans - should be excluded from analytics
 */
export function detectInstallmentPlanCredit(
  merchantName: string | null,
  description: string | null,
  amount: number
): boolean {
  // Must be a positive amount (credit)
  if (amount <= 0) return false;

  const text = `${merchantName || ""} ${description || ""}`.toLowerCase();
  return INSTALLMENT_PLAN_CREDIT_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}

// Helper to check if transaction should be excluded from analytics
export function shouldExcludeFromTotals(
  flags?: TransactionFlags | null
): boolean {
  if (!flags) return false;

  // Explicit exclusion
  if (flags.isExcludedFromTotals === true) return true;

  // Auto-exclude certain types
  if (flags.isDuplicate === true) return true;
  if (flags.isInternalTransfer === true) return true;

  return false;
}

// Helper to get exclusion reason display text
export function getExclusionReasonText(reason?: ExclusionReason): string {
  switch (reason) {
    case "duplicate":
      return "Duplicate transaction";
    case "internal_transfer":
      return "Internal transfer";
    case "credit_card_payment":
      return "Credit card payment";
    case "bnpl_installment":
      return "BNPL installment";
    case "installment_plan_credit":
      return "Installment plan credit";
    case "manual":
      return "Manually excluded";
    default:
      return "Excluded from analytics";
  }
}

