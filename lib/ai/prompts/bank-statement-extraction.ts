/**
 * Bank Statement Extraction Prompt Builder
 * Centralized prompt management for bank statement PDF extraction
 */

export interface BankStatementExtractionConfig {
  statementType?: "bank_account" | "credit_card";
  currency?: string;
  country?: string;
}

export class BankStatementExtractionPrompt {
  static build(config: BankStatementExtractionConfig = {}): string {
    const { statementType, currency = "USD", country = "US" } = config;

    const typeInstructions = this.getTypeInstructions(statementType);

    return `You are a financial document extraction expert. Extract all transaction data from this bank statement.

${typeInstructions}

## Extraction Instructions

1. **Account Information** (if visible):
   - Bank name
   - Account number (mask all but last 4 digits for security)
   - Account holder name (if shown)
   - Account type (checking, savings, credit card)

2. **Statement Period**:
   - Statement start date
   - Statement end date
   - Statement date (date statement was generated)

3. **Balances**:
   - Opening balance (beginning balance)
   - Closing balance (ending balance)

4. **Transactions** - Extract ALL transactions with:
   - Date (transaction date, not posted date if both shown)
   - Description (full transaction description as shown)
   - Amount (numeric value)
   - Balance after transaction (if shown)

## Amount Sign Convention

CRITICAL: Follow these sign conventions for the amount field:
- **Debits/Withdrawals/Purchases** → NEGATIVE numbers (e.g., -50.00)
- **Credits/Deposits/Payments received** → POSITIVE numbers (e.g., +100.00)

For credit cards specifically:
- Purchases/charges → NEGATIVE (money you owe)
- Payments/credits → POSITIVE (reduces what you owe)

## Output Format

Return ONLY valid JSON matching this schema:

{
  "accountInfo": {
    "bankName": string | null,
    "accountNumber": string | null,  // Last 4 digits only, e.g., "****1234"
    "accountHolderName": string | null,
    "accountType": "checking" | "savings" | "credit" | "other" | null
  },
  "statementPeriod": {
    "startDate": string | null,  // YYYY-MM-DD format
    "endDate": string | null,    // YYYY-MM-DD format
    "statementDate": string | null
  },
  "balances": {
    "openingBalance": number | null,
    "closingBalance": number | null
  },
  "currency": "${currency}",
  "transactions": [
    {
      "date": string,           // YYYY-MM-DD format
      "description": string,    // Full description text
      "amount": number,         // Negative for debits, positive for credits
      "balance": number | null, // Running balance if shown
      "category": string | null // Suggested category if obvious
    }
  ],
  "extractionConfidence": number  // 0.0 to 1.0 confidence score
}

## Important Notes

- Extract dates in YYYY-MM-DD format
- For amounts, use plain numbers without currency symbols (e.g., -50.00 not -$50.00)
- If a field is not visible or cannot be determined, use null
- Preserve the original transaction order (earliest first)
- Include ALL transactions, even if they appear on multiple pages
- The extractionConfidence should reflect how complete and accurate the extraction is`;
  }

  private static getTypeInstructions(
    statementType?: "bank_account" | "credit_card"
  ): string {
    if (statementType === "credit_card") {
      return `## Statement Type: CREDIT CARD

This is a credit card statement. Key characteristics:
- Purchases and charges are DEBITS (negative amounts)
- Payments to the card are CREDITS (positive amounts)
- Look for: new balance, minimum payment due, payment due date
- Interest charges and fees are also debits`;
    }

    if (statementType === "bank_account") {
      return `## Statement Type: BANK ACCOUNT

This is a bank account statement (checking/savings). Key characteristics:
- Withdrawals, payments, and transfers out are DEBITS (negative amounts)
- Deposits and transfers in are CREDITS (positive amounts)
- Look for: beginning balance, ending balance, available balance`;
    }

    return `## Statement Type: UNKNOWN

Analyze the document to determine if this is a bank account or credit card statement.
Apply appropriate sign conventions based on what you detect.`;
  }

  /**
   * Build prompt for vision-based extraction (when text extraction fails)
   */
  static buildVisionPrompt(config: BankStatementExtractionConfig = {}): string {
    return `${this.build(config)}

## Vision Extraction Mode

You are analyzing an IMAGE of a bank statement. The text may not be perfectly clear.
- Read carefully and extract what you can see
- If text is blurry or unclear, make your best interpretation
- Note any uncertainties in a lower extractionConfidence score
- Focus on the transaction table - this is the most important data`;
  }
}
