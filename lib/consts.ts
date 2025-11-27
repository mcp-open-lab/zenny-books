import {
  US_STATES,
  CANADIAN_PROVINCES,
  PAYMENT_METHODS,
  type PaymentMethod,
  type UsageType,
} from "@/lib/constants";

export { US_STATES, CANADIAN_PROVINCES };

export const RECEIPT_CATEGORIES = [
  "Food",
  "Transport",
  "Utilities",
  "Supplies",
  "Other",
];

export const RECEIPT_STATUSES = ["needs_review", "approved"];

export { PAYMENT_METHODS };

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
  usageType: UsageType
): Record<string, boolean> {
  const baseFields = {
    taxAmount: true,
    category: true,
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
  usageType: UsageType
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
    // Field is visible if it's core OR explicitly set to true in visibleFields
    const isVisible = isCoreField || visibleFields[field] === true;

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

// Default values type
export type DefaultValues = {
  isBusinessExpense?: boolean | null;
  businessPurpose?: string | null;
  paymentMethod?: PaymentMethod | null;
};

// Get default default values (empty - user must set them)
export function getDefaultDefaultValues(): DefaultValues {
  return {
    isBusinessExpense: null,
    businessPurpose: null,
    paymentMethod: null,
  };
}
