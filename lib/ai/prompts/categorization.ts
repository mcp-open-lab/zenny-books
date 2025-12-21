/**
 * Categorization Prompt Builder
 * Centralized prompt management for transaction categorization
 * Uses TOON format for token efficiency
 */

import { categoriesToTOON, businessesToTOON } from "../toon";

export interface CategorizationConfig {
  merchantName: string | null;
  description: string | null;
  amount: string | null;
  availableCategories: Array<{ id: string; name: string; type?: string }>;
  userPreferences?: {
    country?: string | null;
    usageType?: string | null;
  };
  userBusinesses?: Array<{ id: string; name: string }>; // User's businesses for classification
  statementType?: "credit_card" | "bank_account" | null;
  transactionType?: "income" | "expense"; // Explicit transaction type context
}

export class CategorizationPrompt {
  static build(config: CategorizationConfig): string {
    const {
      merchantName,
      description,
      amount,
      availableCategories,
      userPreferences,
      userBusinesses,
      statementType,
      transactionType,
    } = config;

    // Use TOON format for categories (30-60% token savings)
    const categoryTOON = categoriesToTOON(availableCategories);

    const userContext = this.buildUserContext(userPreferences, userBusinesses);
    const statementContext = this.buildStatementContext(statementType);
    const transactionTypeContext = transactionType
      ? `- Transaction Type: ${transactionType.toUpperCase()}\n  CRITICAL: This is a ${transactionType === "expense" ? "spending/expense" : "income"} transaction. Only select categories that match this type.`
      : "";

    return `You are a financial categorization assistant. Categorize the following transaction into one of the available categories.

Transaction Details:
- Merchant: ${merchantName || "Unknown"}
- Description: ${description || "N/A"}
- Amount: ${amount || "N/A"}
${transactionTypeContext}${statementContext}

Available Categories (TOON format - header row, then values):
${categoryTOON}

${userContext}

Important Context:
- "FINANCIAL", "FINANCE", "LOAN", "CREDIT", "PAYMENT PLAN", "INSTALLMENT" in merchant/description typically indicate loan/debt payments, not software subscriptions
- "DELL FINANCIAL", "APPLE FINANCIAL", etc. are financing/loan services, not product purchases
- "BILL PYMT", "PAYMENT", "AUTO PAY" often indicate bill payments or debt servicing
- Look for financial service keywords: "FINANCIAL", "CREDIT", "LOAN", "FINANCING", "PAYMENT PLAN"
- "PAYMENT RECEIVED", "PAYMENT - THANK YOU", "PYMT RECEIVED" on credit card statements = "Credit Card Payment" (NOT Deposits/Income - this is the user paying their credit card bill)

Instructions:
1. Select the BEST matching category from the available list.
2. If none of the categories fit well, suggest a new category name and set isNewCategory to true.
3. Provide a confidence score (0.0 to 1.0).
4. Determine if this is a personal or business expense.
5. If business expense, match to the most appropriate business from the user's list (if available).

Return your response as JSON matching this schema:
{
  "categoryName": "string",
  "confidence": number,
  "isNewCategory": boolean,
  "isBusinessExpense": boolean,
  "businessId": "string | null",
  "businessName": "string | null"
}`;
  }

  private static buildUserContext(
    userPreferences?: CategorizationConfig["userPreferences"],
    userBusinesses?: Array<{ id: string; name: string }>
  ): string {
    const parts: string[] = [];

    if (userPreferences?.country) {
      parts.push(`User Location: ${userPreferences.country}`);
    }

    if (userPreferences?.usageType) {
      const usageTypeContext = this.getUsageTypeContext(userPreferences.usageType);
      parts.push(`Usage Type: ${userPreferences.usageType}${usageTypeContext}`);
    }

    if (userBusinesses && userBusinesses.length > 0) {
      // Use TOON format for businesses
      const businessTOON = businessesToTOON(userBusinesses);
      parts.push(`User's Businesses (TOON format):\n${businessTOON}`);
      parts.push(`When identifying a business expense, match it to the most appropriate business by ID.`);
    }

    return parts.length > 0 ? parts.join("\n") + "\n" : "";
  }

  private static getUsageTypeContext(usageType: string): string {
    switch (usageType) {
      case "business":
        return " (Focus on business-related categories like Business Services, Office Supplies, Client Entertainment)";
      case "personal":
        return " (Focus on personal categories like Groceries, Personal Care, Home Expenses)";
      case "mixed":
        return " (User tracks both personal and business expenses - consider context)";
      default:
        return "";
    }
  }

  private static buildStatementContext(statementType?: "credit_card" | "bank_account" | null): string {
    if (!statementType) return "";

    if (statementType === "credit_card") {
      return `- Statement Type: CREDIT CARD
  CRITICAL: On credit card statements, "PAYMENT RECEIVED", "PAYMENT - THANK YOU", "PYMT RECEIVED" means the user PAID their credit card bill. This is "Credit Card Payment", NOT income or deposits.`;
    }

    if (statementType === "bank_account") {
      return `- Statement Type: BANK ACCOUNT (Checking/Savings)
  Note: On bank statements, deposits and transfers in are actual income. Withdrawals and payments out are expenses.`;
    }

    return "";
  }
}

