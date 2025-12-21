/**
 * Receipt Extraction Prompt Builder
 * Centralized prompt management for receipt OCR extraction
 */

export interface ReceiptExtractionConfig {
  requiredFields: string[];
  preferredFields: string[];
  optionalFields: string[];
  country?: string | null;
  currency: string;
  jsonSchema: any;
}

export class ReceiptExtractionPrompt {
  static build(config: ReceiptExtractionConfig): string {
    const { requiredFields, preferredFields, optionalFields, jsonSchema } =
      config;

    const requiredSection = this.buildRequiredFields(requiredFields);
    const preferredSection = this.buildPreferredFields(preferredFields);
    const optionalSection = this.buildOptionalFields(optionalFields);

    return `Extract information from this receipt image.

CRITICAL: Read the ACTUAL merchant/business name printed on the receipt. Do NOT guess common names like "Starbucks", "Chipotle", "Target" unless that exact name appears on the receipt.

${requiredSection}${preferredSection}${optionalSection}

DIRECTION DETECTION (if direction field is requested):
- Set direction to "in" if this is a payment receipt showing money received (e.g., "Payment Received", "Invoice Paid", customer payment receipt)
- Set direction to "out" if this is an expense receipt showing money spent (e.g., purchase receipt, bill payment, typical store receipt)
- Default to "out" if uncertain

Return as JSON. Use null if a field is not found. Dates: YYYY-MM-DD format. Amounts: numbers.

JSON schema:
${JSON.stringify(jsonSchema, null, 2)}`;
  }

  private static buildRequiredFields(fields: string[]): string {
    if (fields.length === 0) return "";

    const fieldDescriptions = fields.map((f) => {
      if (f === "date") return "- date: Transaction date (format: YYYY-MM-DD)";
      if (f === "totalAmount")
        return "- totalAmount: Final total amount (number)";
      return `- ${f}`;
    });

    return `Required fields:
${fieldDescriptions.join("\n")}

`;
  }

  private static buildPreferredFields(fields: string[]): string {
    if (fields.length === 0) return "";

    const fieldDescriptions = fields.map((f) => {
      if (f === "merchantName")
        return "- merchantName: Business/merchant name shown on receipt";
      return `- ${f}`;
    });

    return `Preferred fields:
${fieldDescriptions.join("\n")}

`;
  }

  private static buildOptionalFields(fields: string[]): string {
    if (fields.length === 0) return "";

    const fieldDescriptions = fields.map((f) => {
      if (f === "direction")
        return "- direction: \"in\" if payment received (income), \"out\" if money spent (expense)";
      return `- ${f}`;
    });

    return `Optional fields:
${fieldDescriptions.join("\n")}

`;
  }
}
