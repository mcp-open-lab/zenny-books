import { describe, it, expect, vi, beforeEach } from "vitest";
import { BankStatementPdfProcessor } from "@/lib/import/processors/bank-statement-pdf-processor";

// Mock dependencies
vi.mock("@/lib/import/pdf-extractor", () => ({
  extractPdfText: vi.fn(),
  assessExtractionQuality: vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
  generateObjectForExtraction: vi.fn(),
}));

vi.mock("@/lib/categorization/engine", () => ({
  CategoryEngine: {
    categorizeWithAI: vi.fn().mockResolvedValue({
      categoryId: null,
      categoryName: null,
      businessId: null,
    }),
  },
}));

vi.mock("@/lib/import/transaction-detection", () => ({
  detectPaymentMethod: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/dev-logger", () => ({
  devLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("BankStatementPdfProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor and metadata", () => {
    it("should create processor with default values", () => {
      const processor = new BankStatementPdfProcessor("user-123");
      
      expect(processor.getStatementType()).toBe("bank_account");
      expect(processor.getDescription()).toContain("Bank Account PDF Statement");
    });

    it("should create credit card processor when specified", () => {
      const processor = new BankStatementPdfProcessor(
        "user-123",
        "USD",
        "credit_card"
      );
      
      expect(processor.getStatementType()).toBe("credit_card");
      expect(processor.getDescription()).toContain("Credit Card PDF Statement");
    });
  });

  describe("processPdf", () => {
    it("should use text extraction for high quality PDFs", async () => {
      const { extractPdfText, assessExtractionQuality } = await import(
        "@/lib/import/pdf-extractor"
      );
      const { generateObjectForExtraction } = await import("@/lib/ai/client");

      vi.mocked(extractPdfText).mockResolvedValue({
        text: "Bank Statement\nDate: 01/15/2025\nTransaction: Coffee $5.00",
        pages: ["Bank Statement\nDate: 01/15/2025\nTransaction: Coffee $5.00"],
        pageCount: 1,
        metadata: { title: "Bank Statement" },
        isScanned: false,
      });

      vi.mocked(assessExtractionQuality).mockReturnValue(0.8);

      vi.mocked(generateObjectForExtraction).mockResolvedValue({
        success: true,
        provider: "openai",
        data: {
          accountInfo: {
            bankName: "Test Bank",
            accountNumber: "****1234",
            accountHolderName: "John Doe",
            accountType: "checking",
          },
          statementPeriod: {
            startDate: "2025-01-01",
            endDate: "2025-01-31",
            statementDate: "2025-02-01",
          },
          balances: {
            openingBalance: 1000.0,
            closingBalance: 950.0,
          },
          currency: "USD",
          transactions: [
            {
              date: "2025-01-15",
              description: "Coffee Shop",
              amount: -5.0,
              balance: 995.0,
              category: "Food & Dining",
            },
          ],
          extractionConfidence: 0.9,
        },
      });

      const processor = new BankStatementPdfProcessor("user-123");
      const buffer = Buffer.from("mock pdf");
      
      const result = await processor.processPdf(buffer, "statement.pdf");

      expect(result.success).toBe(true);
      expect(result.method).toBe("text");
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe("Coffee Shop");
      expect(result.transactions[0].amount).toBe("-5");
      expect(result.confidence).toBe(0.9);
    });

    it("should fall back to vision for scanned PDFs", async () => {
      const { extractPdfText, assessExtractionQuality } = await import(
        "@/lib/import/pdf-extractor"
      );
      const { generateObjectForExtraction } = await import("@/lib/ai/client");

      vi.mocked(extractPdfText).mockResolvedValue({
        text: "",
        pages: [],
        pageCount: 1,
        metadata: {},
        isScanned: true,
      });

      vi.mocked(assessExtractionQuality).mockReturnValue(0.1);

      vi.mocked(generateObjectForExtraction).mockResolvedValue({
        success: true,
        provider: "openai",
        data: {
          accountInfo: {
            bankName: "Test Bank",
            accountNumber: null,
            accountHolderName: null,
            accountType: null,
          },
          statementPeriod: {
            startDate: null,
            endDate: null,
            statementDate: null,
          },
          balances: {
            openingBalance: null,
            closingBalance: null,
          },
          currency: "USD",
          transactions: [
            {
              date: "2025-01-20",
              description: "Grocery Store",
              amount: -75.5,
              balance: null,
              category: null,
            },
          ],
          extractionConfidence: 0.7,
        },
      });

      const processor = new BankStatementPdfProcessor("user-123");
      const buffer = Buffer.from("mock scanned pdf");
      
      const result = await processor.processPdf(buffer, "scanned.pdf");

      expect(result.success).toBe(true);
      expect(result.method).toBe("vision");
      expect(result.transactions).toHaveLength(1);
    });

    it("should return error when extraction fails", async () => {
      const { extractPdfText } = await import("@/lib/import/pdf-extractor");

      vi.mocked(extractPdfText).mockRejectedValue(new Error("PDF corrupted"));

      const processor = new BankStatementPdfProcessor("user-123");
      const buffer = Buffer.from("corrupted pdf");
      
      const result = await processor.processPdf(buffer, "bad.pdf");

      expect(result.success).toBe(false);
      expect(result.error).toContain("PDF corrupted");
      expect(result.transactions).toHaveLength(0);
    });

    it("should return error when LLM extraction fails", async () => {
      const { extractPdfText, assessExtractionQuality } = await import(
        "@/lib/import/pdf-extractor"
      );
      const { generateObjectForExtraction } = await import("@/lib/ai/client");

      vi.mocked(extractPdfText).mockResolvedValue({
        text: "Some text",
        pages: ["Some text"],
        pageCount: 1,
        metadata: {},
        isScanned: false,
      });

      vi.mocked(assessExtractionQuality).mockReturnValue(0.8);

      vi.mocked(generateObjectForExtraction).mockResolvedValue({
        success: false,
        provider: "openai",
        error: "Rate limit exceeded",
      });

      const processor = new BankStatementPdfProcessor("user-123");
      const buffer = Buffer.from("mock pdf");
      
      const result = await processor.processPdf(buffer, "statement.pdf");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate limit exceeded");
    });
  });

  describe("processTransactions", () => {
    it("should throw error when called directly", async () => {
      const processor = new BankStatementPdfProcessor("user-123");
      
      await expect(
        processor.processTransactions([], "USD")
      ).rejects.toThrow("Use processPdf() method for PDF processing");
    });
  });
});

