/**
 * Categorization Prompt Builder
 * Centralized prompt management for transaction categorization
 */

export interface CategorizationConfig {
  merchantName: string | null;
  description: string | null;
  amount: string | null;
  availableCategories: Array<{ id: string; name: string }>;
  userPreferences?: {
    country?: string | null;
    usageType?: string | null;
  };
}

export class CategorizationPrompt {
  static build(config: CategorizationConfig): string {
    const {
      merchantName,
      description,
      amount,
      availableCategories,
      userPreferences,
    } = config;

    const categoryList = availableCategories.map((c) => c.name).join(", ");

    const userContext = this.buildUserContext(userPreferences);

    return `You are a financial categorization assistant. Categorize the following transaction into one of the available categories.

Transaction Details:
- Merchant: ${merchantName || "Unknown"}
- Description: ${description || "N/A"}
- Amount: ${amount || "N/A"}

Available Categories: ${categoryList}

${userContext}

Important Context:
- "FINANCIAL", "FINANCE", "LOAN", "CREDIT", "PAYMENT PLAN", "INSTALLMENT" in merchant/description typically indicate loan/debt payments, not software subscriptions
- "DELL FINANCIAL", "APPLE FINANCIAL", etc. are financing/loan services, not product purchases
- "BILL PYMT", "PAYMENT", "AUTO PAY" often indicate bill payments or debt servicing
- Look for financial service keywords: "FINANCIAL", "CREDIT", "LOAN", "FINANCING", "PAYMENT PLAN"

Instructions:
1. Select the BEST matching category from the available list.
2. If none of the categories fit well, suggest a new category name and set isNewCategory to true.
3. Provide a confidence score (0.0 to 1.0).

Return your response as JSON matching this schema:
{
  "categoryName": "string",
  "confidence": number,
  "isNewCategory": boolean
}`;
  }

  private static buildUserContext(
    userPreferences?: CategorizationConfig["userPreferences"]
  ): string {
    if (!userPreferences) return "";

    const parts: string[] = [];

    if (userPreferences.country) {
      parts.push(`User Location: ${userPreferences.country}`);
    }

    if (userPreferences.usageType) {
      parts.push(`Usage Type: ${userPreferences.usageType}`);
    }

    return parts.length > 0 ? parts.join("\n") + "\n" : "";
  }
}

