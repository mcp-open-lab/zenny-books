export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

export const CANADIAN_PROVINCES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
];

export const RECEIPT_CATEGORIES = [
  "Food",
  "Transport",
  "Utilities",
  "Supplies",
  "Other",
];

export const RECEIPT_STATUSES = ["needs_review", "approved"];

export const PAYMENT_METHODS = ["cash", "card", "check", "other"];

// Default required fields - minimal critical info
export const DEFAULT_REQUIRED_FIELDS = {
  merchantName: true,
  date: true,
  totalAmount: true,
  // All others default to optional
  taxAmount: false,
  category: false,
  description: false,
  paymentMethod: false,
  tipAmount: false,
  discountAmount: false,
};

// Get default visible fields based on usage type
export function getDefaultVisibleFields(
  usageType: "personal" | "business" | "mixed"
): Record<string, boolean> {
  const baseFields = {
    tipAmount: true,
    discountAmount: true,
    description: true,
    paymentMethod: true,
  };

  if (usageType === "business" || usageType === "mixed") {
    return {
      ...baseFields,
      businessPurpose: true,
      isBusinessExpense: true,
    };
  }

  return {
    ...baseFields,
    businessPurpose: false,
    isBusinessExpense: false,
  };
}

// Get default required fields based on usage type
export function getDefaultRequiredFields(
  usageType: "personal" | "business" | "mixed"
): Record<string, boolean> {
  const baseFields = {
    merchantName: true,
    date: true,
    totalAmount: true,
    taxAmount: false,
    category: usageType === "business" || usageType === "mixed",
    description: false,
    paymentMethod: false,
    tipAmount: false,
    discountAmount: false,
  };

  if (usageType === "business" || usageType === "mixed") {
    return {
      ...baseFields,
      businessPurpose: false,
      isBusinessExpense: false,
    };
  }

  return baseFields;
}

// Sync required fields with visible fields - remove required if not visible
export function syncRequiredWithVisible(
  visibleFields: Record<string, boolean>,
  requiredFields: Record<string, boolean>
): Record<string, boolean> {
  const synced: Record<string, boolean> = {};

  for (const [field, isRequired] of Object.entries(requiredFields)) {
    // Only keep required if field is visible (or if it's a core field that's always visible)
    const isCoreField = ["merchantName", "date", "totalAmount"].includes(field);
    const isVisible = visibleFields[field] !== false || isCoreField;

    if (isVisible) {
      synced[field] = isRequired;
    } else {
      // Field is hidden, can't be required
      synced[field] = false;
    }
  }

  return synced;
}

// All fields that can be made required/optional
export const RECEIPT_FIELDS = [
  { key: "merchantName", label: "Merchant Name" },
  { key: "date", label: "Date" },
  { key: "totalAmount", label: "Total Amount" },
  { key: "taxAmount", label: "Tax Amount" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "paymentMethod", label: "Payment Method" },
  { key: "tipAmount", label: "Tip Amount" },
  { key: "discountAmount", label: "Discount Amount" },
  { key: "businessPurpose", label: "Business Purpose" },
  { key: "isBusinessExpense", label: "Is Business Expense" },
] as const;
