import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getBatchStatusSummary,
  getBatchProgress,
  calculateEstimatedCompletion,
  isBatchComplete,
  getBatchItemsStatus,
  hasRetryableItems,
} from "@/lib/import/batch-tracker";
import { db } from "@/lib/db";
import type { BatchStatusSummary } from "@/lib/import/batch-types";
import { createMockSelect, createMockSelectSequence } from "@/tests/utils/db-mocks";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("getBatchStatusSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate completion percentage correctly", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "processing",
      totalFiles: 5,
      processedFiles: 3,
      successfulFiles: 2,
      failedFiles: 1,
      duplicateFiles: 0,
      startedAt: new Date(),
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]) as any);

    const result = await getBatchStatusSummary("batch-123", "test-user-id");

    expect(result.completionPercentage).toBe(60);
    expect(result.totalFiles).toBe(5);
    expect(result.processedFiles).toBe(3);
    expect(result.remainingFiles).toBe(2);
  });

  it("should return 0% when no files processed", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "pending",
      totalFiles: 10,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      duplicateFiles: 0,
      startedAt: null,
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]) as any);

    const result = await getBatchStatusSummary("batch-123", "test-user-id");

    expect(result.completionPercentage).toBe(0);
    expect(result.remainingFiles).toBe(10);
  });

  it("should parse errors JSON array", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "failed",
      totalFiles: 5,
      processedFiles: 5,
      successfulFiles: 3,
      failedFiles: 2,
      duplicateFiles: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      estimatedCompletionAt: null,
      errors: JSON.stringify(["Error 1", "Error 2"]),
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]) as any);

    const result = await getBatchStatusSummary("batch-123", "test-user-id");

    expect(result.errors).toEqual(["Error 1", "Error 2"]);
  });

  it("should return null for errors when errors field is null", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "processing",
      totalFiles: 5,
      processedFiles: 3,
      successfulFiles: 3,
      failedFiles: 0,
      duplicateFiles: 0,
      startedAt: new Date(),
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]) as any);

    const result = await getBatchStatusSummary("batch-123", "test-user-id");

    expect(result.errors).toBeNull();
  });

  it("should throw error if batch not found", async () => {
    vi.mocked(db.select).mockReturnValue(createMockSelect([]) as any);

    await expect(
      getBatchStatusSummary("non-existent", "test-user-id")
    ).rejects.toThrow("Batch not found or unauthorized");
  });
});

describe("calculateEstimatedCompletion", () => {
  it("should calculate ETA based on processing rate", () => {
    const batch: BatchStatusSummary = {
      batchId: "batch-123",
      status: "processing",
      completionPercentage: 50,
      totalFiles: 10,
      processedFiles: 5,
      successfulFiles: 4,
      failedFiles: 1,
      duplicateFiles: 0,
      remainingFiles: 5,
      startedAt: new Date(Date.now() - 10000), // Started 10 seconds ago
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const estimated = calculateEstimatedCompletion(batch);

    expect(estimated).toBeInstanceOf(Date);
    expect(estimated!.getTime()).toBeGreaterThan(Date.now());
  });

  it("should return null if batch not started", () => {
    const batch: BatchStatusSummary = {
      batchId: "batch-123",
      status: "pending",
      completionPercentage: 0,
      totalFiles: 10,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      duplicateFiles: 0,
      remainingFiles: 10,
      startedAt: null,
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const estimated = calculateEstimatedCompletion(batch);

    expect(estimated).toBeNull();
  });

  it("should return null if no files processed yet", () => {
    const batch: BatchStatusSummary = {
      batchId: "batch-123",
      status: "processing",
      completionPercentage: 0,
      totalFiles: 10,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      duplicateFiles: 0,
      remainingFiles: 10,
      startedAt: new Date(),
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const estimated = calculateEstimatedCompletion(batch);

    expect(estimated).toBeNull();
  });
});

describe("isBatchComplete", () => {
  it("should return true when status is completed", () => {
    const batch: BatchStatusSummary = {
      batchId: "batch-123",
      status: "completed",
      completionPercentage: 100,
      totalFiles: 10,
      processedFiles: 10,
      successfulFiles: 8,
      failedFiles: 2,
      duplicateFiles: 0,
      remainingFiles: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(isBatchComplete(batch)).toBe(true);
  });

  it("should return true when all files processed", () => {
    const batch: BatchStatusSummary = {
      batchId: "batch-123",
      status: "processing",
      completionPercentage: 100,
      totalFiles: 10,
      processedFiles: 10,
      successfulFiles: 10,
      failedFiles: 0,
      duplicateFiles: 0,
      remainingFiles: 0,
      startedAt: new Date(),
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(isBatchComplete(batch)).toBe(true);
  });

  it("should return false when batch is still processing", () => {
    const batch: BatchStatusSummary = {
      batchId: "batch-123",
      status: "processing",
      completionPercentage: 50,
      totalFiles: 10,
      processedFiles: 5,
      successfulFiles: 4,
      failedFiles: 1,
      duplicateFiles: 0,
      remainingFiles: 5,
      startedAt: new Date(),
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(isBatchComplete(batch)).toBe(false);
  });
});

describe("getBatchItemsStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return batch items with status", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockItems = [
      {
        id: "item-1",
        fileName: "receipt1.jpg",
        status: "completed",
        errorMessage: null,
        retryCount: 0,
        order: 0,
      },
      {
        id: "item-2",
        fileName: "receipt2.jpg",
        status: "failed",
        errorMessage: "Extraction failed",
        retryCount: 1,
        order: 1,
      },
    ];

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockBatch], mockItems)
    );

    const result = await getBatchItemsStatus("batch-123", "test-user-id");

    expect(result).toHaveLength(2);
    expect(result[0].fileName).toBe("receipt1.jpg");
    expect(result[1].status).toBe("failed");
  });

  it("should throw error if batch not found", async () => {
    vi.mocked(db.select).mockReturnValue(createMockSelect([]) as any);

    await expect(
      getBatchItemsStatus("non-existent", "test-user-id")
    ).rejects.toThrow("Batch not found or unauthorized");
  });
});

describe("getBatchProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return progress summary with all stats", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "processing",
      totalFiles: 10,
      processedFiles: 6,
      successfulFiles: 5,
      failedFiles: 1,
      duplicateFiles: 0,
      startedAt: new Date(Date.now() - 10000),
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]) as any);

    const result = await getBatchProgress("batch-123", "test-user-id");

    expect(result.percentage).toBe(60);
    expect(result.status).toBe("processing");
    expect(result.processed).toBe(6);
    expect(result.total).toBe(10);
    expect(result.successful).toBe(5);
    expect(result.failed).toBe(1);
    expect(result.duplicates).toBe(0);
    expect(result.remaining).toBe(4);
    expect(result.isComplete).toBe(false);
  });

  it("should include estimated completion time", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "processing",
      totalFiles: 10,
      processedFiles: 5,
      successfulFiles: 5,
      failedFiles: 0,
      duplicateFiles: 0,
      startedAt: new Date(Date.now() - 10000),
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]) as any);

    const result = await getBatchProgress("batch-123", "test-user-id");

    expect(result.estimatedCompletion).toBeInstanceOf(Date);
  });

  it("should mark as complete when all files processed", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "completed",
      totalFiles: 10,
      processedFiles: 10,
      successfulFiles: 10,
      failedFiles: 0,
      duplicateFiles: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]) as any);

    const result = await getBatchProgress("batch-123", "test-user-id");

    expect(result.isComplete).toBe(true);
    expect(result.percentage).toBe(100);
  });
});

describe("hasRetryableItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true if batch has retryable failed items", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockItems = [
      {
        id: "item-1",
        fileName: "receipt1.jpg",
        status: "failed",
        errorMessage: "Error",
        retryCount: 1,
        order: 0,
      },
    ];

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockBatch], mockItems)
    );

    const result = await hasRetryableItems("batch-123", "test-user-id");

    expect(result).toBe(true);
  });

  it("should return false if failed items have exceeded retry limit", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockItems = [
      {
        id: "item-1",
        fileName: "receipt1.jpg",
        status: "failed",
        errorMessage: "Error",
        retryCount: 3,
        order: 0,
      },
    ];

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockBatch], mockItems)
    );

    const result = await hasRetryableItems("batch-123", "test-user-id");

    expect(result).toBe(false);
  });

  it("should return false if no failed items", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockItems = [
      {
        id: "item-1",
        fileName: "receipt1.jpg",
        status: "completed",
        errorMessage: null,
        retryCount: 0,
        order: 0,
      },
    ];

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockBatch], mockItems)
    );

    const result = await hasRetryableItems("batch-123", "test-user-id");

    expect(result).toBe(false);
  });
});
