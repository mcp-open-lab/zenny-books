import { pgTable, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const receipts = pgTable("receipts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),

  imageUrl: text("image_url").notNull(),
  fileName: text("file_name"),

  merchantName: text("merchant_name"),
  merchantAddress: text("merchant_address"),
  receiptNumber: text("receipt_number"), // Invoice/receipt number from vendor
  taxId: text("tax_id"), // GST/HST registration number (Canada) or EIN (US)

  // Amounts
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }), // Amount before tax
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),

  // Tax breakdown (Canada)
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }), // GST amount
  hstAmount: decimal("hst_amount", { precision: 10, scale: 2 }), // HST amount (includes GST+PST)
  pstAmount: decimal("pst_amount", { precision: 10, scale: 2 }), // PST amount (provincial)

  // Tax breakdown (US)
  salesTaxAmount: decimal("sales_tax_amount", { precision: 10, scale: 2 }), // State sales tax

  // Legacy field for backward compatibility
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }), // Total tax (sum of all taxes)

  // Other amounts
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),

  // Location & Currency
  country: text("country"), // 'US' | 'CA'
  province: text("province"), // Province/state code
  currency: text("currency").default("USD"), // 'USD' | 'CAD'

  // Classification
  date: timestamp("date"),
  category: text("category"),
  description: text("description"),
  businessPurpose: text("business_purpose"), // Why this expense (for tax deductions)
  isBusinessExpense: text("is_business_expense").default("true"), // 'true' | 'false'
  paymentMethod: text("payment_method"), // 'cash' | 'card' | 'check' | 'other'

  status: text("status").default("needs_review"),
  type: text("type").default("receipt"), // 'receipt' | 'invoice'
  direction: text("direction").default("out"), // 'in' | 'out'

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  usageType: text("usage_type").default("personal"), // 'personal' | 'business' | 'mixed'
  country: text("country"), // 'US' | 'CA'
  province: text("province"), // State/Province code
  currency: text("currency").default("USD"), // 'USD' | 'CAD'
  visibleFields: text("visible_fields"), // JSON string of field visibility preferences
  requiredFields: text("required_fields"), // JSON string of required field preferences
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
