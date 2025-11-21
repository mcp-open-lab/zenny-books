import { z } from "zod";
import { DEFAULT_REQUIRED_FIELDS, type DefaultValues } from "@/lib/consts";

// Create dynamic schema based on required fields
export function createEditReceiptSchema(
  requiredFields: Record<string, boolean> = DEFAULT_REQUIRED_FIELDS
) {
  return z.object({
    id: z.string(),
    merchantName: requiredFields.merchantName
      ? z.string().min(1, "Merchant name is required").nullable()
      : z.string().optional().nullable(),
    date: requiredFields.date
      ? z.string().min(1, "Date is required").nullable()
      : z.string().optional().nullable(),
    totalAmount: requiredFields.totalAmount
      ? z.string().min(1, "Total amount is required").nullable()
      : z.string().optional().nullable(),
    taxAmount: requiredFields.taxAmount
      ? z.string().min(1, "Tax amount is required").nullable()
      : z.string().optional().nullable(),
    description: requiredFields.description
      ? z.string().min(1, "Description is required").nullable()
      : z.string().optional().nullable(),
    paymentMethod: requiredFields.paymentMethod
      ? z.string().min(1, "Payment method is required").nullable()
      : z.string().optional().nullable(),
    tipAmount: requiredFields.tipAmount
      ? z.string().min(1, "Tip amount is required").nullable()
      : z.string().optional().nullable(),
    discountAmount: requiredFields.discountAmount
      ? z.string().min(1, "Discount amount is required").nullable()
      : z.string().optional().nullable(),
    category: requiredFields.category
      ? z.string().min(1, "Category is required").nullable()
      : z.string().optional().nullable(),
    status: z.enum(["needs_review", "approved"]),
  });
}

// Default schema (for backwards compatibility)
export const EditReceiptSchema = createEditReceiptSchema();

export const SettingsSchema = z.object({
  usageType: z.enum(["personal", "business", "mixed"]),
  country: z.enum(["US", "CA"]),
  province: z.string().min(1, "Province/State is required"),
  currency: z.string().min(1, "Currency is required"),
  // visibleFields and requiredFields are Records of booleans.
  // We use optional() + transform() because RHF may yield 'undefined' for untouched fields,
  // but our application logic and DB expect strict booleans (false instead of undefined).
  visibleFields: z
    .record(z.boolean().optional())
    .default({})
    .transform((val) => {
      const result: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(val)) {
        result[key] = value ?? false;
      }
      return result;
    }),
  requiredFields: z
    .record(z.boolean().optional())
    .default({})
    .transform((val) => {
      const result: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(val)) {
        result[key] = value ?? false;
      }
      return result;
    }),
  // Default values for fields that make sense to have defaults
  defaultValues: z
    .object({
      isBusinessExpense: z.boolean().nullable().optional(),
      businessPurpose: z.string().nullable().optional(),
      paymentMethod: z
        .enum(["cash", "card", "check", "other"])
        .nullable()
        .optional(),
    })
    .optional()
    .default({}),
});

export const OnboardingSchema = z.object({
  usageType: z.enum(["personal", "business", "mixed"]),
  country: z.enum(["US", "CA"]),
  province: z.string().min(1, "Province/State is required"),
});

// Types
export type EditReceiptFormValues = z.infer<
  ReturnType<typeof createEditReceiptSchema>
>;
export type SettingsFormValues = z.infer<typeof SettingsSchema>;
export type OnboardingFormValues = z.infer<typeof OnboardingSchema>;
