import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assessExtractionQuality,
  isPdfFile,
  type PdfExtractionResult,
} from "@/lib/import/pdf-extractor";

// Mock dev-logger
vi.mock("@/lib/dev-logger", () => ({
  devLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("isPdfFile", () => {
  it("should return true for .pdf extension", () => {
    expect(isPdfFile("statement.pdf")).toBe(true);
    expect(isPdfFile("STATEMENT.PDF")).toBe(true);
    expect(isPdfFile("my-bank-statement.pdf")).toBe(true);
  });

  it("should return false for non-PDF extensions", () => {
    expect(isPdfFile("statement.csv")).toBe(false);
    expect(isPdfFile("statement.xlsx")).toBe(false);
    expect(isPdfFile("receipt.jpg")).toBe(false);
    expect(isPdfFile("document.doc")).toBe(false);
  });

  it("should handle files without extensions", () => {
    expect(isPdfFile("noextension")).toBe(false);
  });
});

describe("assessExtractionQuality", () => {
  it("should return low quality for scanned PDFs", () => {
    const result: PdfExtractionResult = {
      text: "",
      pages: [],
      pageCount: 5,
      metadata: {},
      isScanned: true,
    };

    expect(assessExtractionQuality(result)).toBe(0.1);
  });

  it("should return higher quality for text with bank statement patterns", () => {
    const result: PdfExtractionResult = {
      text: `
        Bank Statement
        Account: ****1234
        Date: 01/15/2025
        Transaction: Coffee Shop $5.50
        Balance: $1,234.56
      `,
      pages: [],
      pageCount: 1,
      metadata: {},
      isScanned: false,
    };

    const quality = assessExtractionQuality(result);
    expect(quality).toBeGreaterThanOrEqual(0.8);
  });

  it("should return medium quality for text with some patterns", () => {
    const result: PdfExtractionResult = {
      text: `
        Document with date 01/15/2025
        Some text here
      `,
      pages: [],
      pageCount: 1,
      metadata: {},
      isScanned: false,
    };

    const quality = assessExtractionQuality(result);
    expect(quality).toBeGreaterThanOrEqual(0.5);
    expect(quality).toBeLessThan(1);
  });

  it("should return base quality for plain text without patterns", () => {
    const result: PdfExtractionResult = {
      text: "Just some regular text without any financial data",
      pages: [],
      pageCount: 1,
      metadata: {},
      isScanned: false,
    };

    const quality = assessExtractionQuality(result);
    expect(quality).toBe(0.5);
  });
});

// Note: extractPdfText tests require integration testing with real PDF files
// or more complex mocking of the pdf-parse library which uses a class constructor.
// For unit testing, we focus on the pure functions (isPdfFile, assessExtractionQuality).
// Integration tests should use actual PDF fixtures.
describe("extractPdfText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip("should extract text from PDF buffer - requires integration test", async () => {
    // This test requires real PDF parsing which is complex to mock
    // Use integration tests with actual PDF fixtures instead
  });

  it.skip("should detect scanned PDFs - requires integration test", async () => {
    // This test requires real PDF parsing
  });
});
