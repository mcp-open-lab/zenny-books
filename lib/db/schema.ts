import {
  pgTable,
  text,
  timestamp,
  decimal,
  integer,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// ============================================
// BASE DOCUMENT SYSTEM
// ============================================

export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),

  // Document identification
  documentType: text("document_type").notNull(), // 'receipt' | 'bank_statement' | 'invoice' | 'expense_report' | 'other'
  fileFormat: text("file_format").notNull(), // 'pdf' | 'csv' | 'xlsx' | 'xls' | 'jpg' | 'png' | 'webp' | 'gif'
  fileName: text("file_name"),
  fileUrl: text("file_url").notNull(), // UploadThing URL
  fileSizeBytes: integer("file_size_bytes"),
  mimeType: text("mime_type"),

  // Processing status
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'extracted' | 'needs_review' | 'completed' | 'failed'
  importBatchId: text("import_batch_id"), // FK to import_batches

  // Extraction metadata
  extractionMethod: text("extraction_method"), // 'ai_gemini' | 'ocr' | 'csv_parser' | 'excel_parser' | 'manual'
  extractionConfidence: decimal("extraction_confidence", {
    precision: 3,
    scale: 2,
  }), // 0.00 to 1.00
  extractedAt: timestamp("extracted_at"),
  extractionErrors: text("extraction_errors"), // JSON array of errors

  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// ============================================
// IMPORT BATCH SYSTEM
// ============================================

export const importBatches = pgTable("import_batches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),

  // Batch metadata
  importType: text("import_type").notNull(), // 'receipts' | 'bank_statements' | 'invoices' | 'mixed'
  sourceFormat: text("source_format"), // 'pdf' | 'csv' | 'xlsx' | 'images'

  // Status tracking
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

  // Counts
  totalFiles: integer("total_files").notNull(),
  processedFiles: integer("processed_files").notNull().default(0),
  successfulFiles: integer("successful_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  duplicateFiles: integer("duplicate_files").notNull().default(0),

  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedCompletionAt: timestamp("estimated_completion_at"),

  // Error tracking
  errors: text("errors"), // JSON array of batch-level errors

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const importBatchItems = pgTable("import_batch_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  batchId: text("batch_id").notNull(), // FK to import_batches
  documentId: text("document_id"), // FK to documents (null if failed)

  // File information
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  fileSizeBytes: integer("file_size_bytes"),

  // Status
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed' | 'duplicate' | 'skipped'
  order: integer("order").notNull(), // Processing order

  // Error tracking
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  retryCount: integer("retry_count").notNull().default(0),

  // Duplicate detection
  duplicateOfDocumentId: text("duplicate_of_document_id"), // FK to documents
  duplicateMatchType: text("duplicate_match_type"), // 'exact_image' | 'merchant_date_amount' | 'manual'

  // Processing metadata
  processedAt: timestamp("processed_at"),
  processingDurationMs: integer("processing_duration_ms"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// EXTRACTION & METADATA
// ============================================

export const documentExtractions = pgTable("document_extractions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  documentId: text("document_id").notNull().unique(), // FK to documents

  // Extraction method
  extractionMethod: text("extraction_method").notNull(), // 'ai_gemini' | 'ocr' | 'csv_parser' | 'excel_parser'
  extractionVersion: text("extraction_version"), // Version of extraction model/parser

  // Confidence scores
  overallConfidence: decimal("overall_confidence", { precision: 3, scale: 2 }), // 0.00 to 1.00
  fieldConfidences: text("field_confidences"), // JSON object: { "merchantName": 0.95, "totalAmount": 0.98 }

  // Raw extraction data
  rawExtractionData: text("raw_extraction_data"), // JSON - raw AI/parser output
  extractedFields: text("extracted_fields"), // JSON - normalized extracted fields

  // Processing metadata
  processingTimeMs: integer("processing_time_ms"),
  extractionErrors: text("extraction_errors"), // JSON array

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentMetadata = pgTable("document_metadata", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  documentId: text("document_id").notNull(), // FK to documents

  // Key-value pairs for flexible metadata
  key: text("key").notNull(),
  value: text("value"), // JSON or text
  valueType: text("value_type"), // 'string' | 'number' | 'boolean' | 'json' | 'date'

  // Categorization
  category: text("category"), // 'format_specific' | 'extraction' | 'user_added' | 'system'

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// RECEIPTS (Specialized Table)
// ============================================

export const receipts = pgTable("receipts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  documentId: text("document_id").notNull(), // FK to documents
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
  category: text("category"), // Denormalized for display/fallback
  categoryId: text("category_id"), // FK to categories
  description: text("description"),
  businessPurpose: text("business_purpose"), // Why this expense (for tax deductions)
  isBusinessExpense: text("is_business_expense").default("true"), // 'true' | 'false'
  paymentMethod: text("payment_method"), // 'cash' | 'card' | 'check' | 'other'

  status: text("status").default("needs_review"),
  type: text("type").default("receipt"), // 'receipt' | 'invoice'
  direction: text("direction").default("out"), // 'in' | 'out'

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// BANK STATEMENTS
// ============================================

export const bankStatements = pgTable("bank_statements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  documentId: text("document_id").notNull().unique(), // FK to documents

  // Account information
  accountNumber: text("account_number"), // Masked/partial for privacy
  accountHolderName: text("account_holder_name"),
  bankName: text("bank_name"),
  accountType: text("account_type"), // 'checking' | 'savings' | 'credit' | 'other'

  // Statement period
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  statementDate: timestamp("statement_date"),

  // Balances
  openingBalance: decimal("opening_balance", { precision: 15, scale: 2 }),
  closingBalance: decimal("closing_balance", { precision: 15, scale: 2 }),
  currency: text("currency"),

  // Processing metadata
  transactionCount: integer("transaction_count"),
  processedTransactionCount: integer("processed_transaction_count"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bankStatementTransactions = pgTable(
  "bank_statement_transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    bankStatementId: text("bank_statement_id").notNull(), // FK to bank_statements

    // Transaction details
    transactionDate: timestamp("transaction_date"),
    postedDate: timestamp("posted_date"),
    description: text("description"),
    merchantName: text("merchant_name"), // Extracted from description
    referenceNumber: text("reference_number"),

    // Amounts
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // Negative for debits, positive for credits
    currency: text("currency"),

    // Classification
    category: text("category"), // Denormalized for display/fallback
    categoryId: text("category_id"), // FK to categories
    isBusinessExpense: text("is_business_expense"), // 'true' | 'false'
    businessPurpose: text("business_purpose"),

    // Matching
    matchedReceiptId: text("matched_receipt_id"), // FK to receipts
    matchingConfidence: decimal("matching_confidence", {
      precision: 3,
      scale: 2,
    }),

    // Ordering
    lineNumber: integer("line_number"), // Original line number in statement
    order: integer("order").notNull(), // Display order

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

// ============================================
// INVOICES
// ============================================

export const invoices = pgTable("invoices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  documentId: text("document_id").notNull().unique(), // FK to documents

  // Invoice identification
  invoiceNumber: text("invoice_number"),
  poNumber: text("po_number"), // Purchase order number

  // Parties
  vendorName: text("vendor_name"),
  vendorAddress: text("vendor_address"),
  vendorTaxId: text("vendor_tax_id"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),

  // Dates
  invoiceDate: timestamp("invoice_date"),
  dueDate: timestamp("due_date"),

  // Amounts
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }),
  amountDue: decimal("amount_due", { precision: 12, scale: 2 }),
  currency: text("currency"),

  // Status
  status: text("status"), // 'draft' | 'sent' | 'paid' | 'overdue'
  paymentTerms: text("payment_terms"), // 'net_30', 'due_on_receipt', etc.

  // Direction
  direction: text("direction"), // 'in' (received) | 'out' (sent)

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// CATEGORIES & RULES
// ============================================

export const categories = pgTable("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'system' | 'user'
  userId: text("user_id"), // null for system categories, populated for user categories
  parentId: text("parent_id"), // For future hierarchical categories
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categoryRules = pgTable("category_rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  categoryId: text("category_id").notNull(), // FK to categories
  userId: text("user_id").notNull(), // FK to users
  matchType: text("match_type").notNull(), // 'exact' | 'contains' | 'regex'
  field: text("field").notNull(), // 'merchantName' | 'description'
  value: text("value").notNull(), // The pattern to match
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// USER SETTINGS
// ============================================

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  usageType: text("usage_type").default("personal"), // 'personal' | 'business' | 'mixed'
  country: text("country"), // 'US' | 'CA'
  province: text("province"), // State/Province code
  currency: text("currency").default("USD"), // 'USD' | 'CAD'
  
  // Legacy fields (for backward compatibility)
  visibleFields: text("visible_fields"), // JSON string of field visibility preferences
  requiredFields: text("required_fields"), // JSON string of required field preferences
  defaultValues: text("default_values"), // JSON string of default field values (isBusinessExpense, businessPurpose, paymentMethod)
  
  // Document-type-specific settings
  receiptSettings: text("receipt_settings"), // JSON: { visibleFields, requiredFields, defaultValues }
  bankStatementSettings: text("bank_statement_settings"), // JSON: { autoCategorize, matchingRules }
  invoiceSettings: text("invoice_settings"), // JSON: future invoice-specific settings
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
