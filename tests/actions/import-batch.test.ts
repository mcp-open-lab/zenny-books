import { describe, it, expect, vi, beforeEach } from "vitest";
import { createImportBatch, updateBatchStatus, getBatchStatus, completeBatch } from "@/app/actions/import-batch";
import { db } from "@/lib/db";
import { importBatches } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { getBatchStatusSummary } from "@/lib/import/batch-tracker";
import { createMockInsert, createMockUpdate } from "@/tests/utils/db-mocks";
import { createMockAuth } from "@/tests/utils/test-types";
import type { BatchStatusSummary } from "@/lib/import/batch-types";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/import/batch-tracker", () => ({
  getBatchStatusSummary: vi.fn(),
}));

describe("createImportBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createMockAuth("test-user-id"));
  });

  it("should create a batch with valid input", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      importType: "receipts",
      sourceFormat: "images",
      totalFiles: 5,
      status: "pending",
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      duplicateFiles: 0,
    };

    vi.mocked(db.insert).mockReturnValue(createMockInsert([mockBatch]));

    const result = await createImportBatch({
      importType: "receipts",
      sourceFormat: "images",
      totalFiles: 5,
    });

    expect(result.success).toBe(true);
    expect(result.batchId).toBe("batch-123");
    expect(db.insert).toHaveBeenCalledWith(importBatches);
  });

  it("should reject invalid importType", async () => {
    await expect(
      createImportBatch({
        importType: "invalid" as any,
        totalFiles: 5,
      })
    ).rejects.toThrow();
  });

  it("should reject invalid totalFiles (negative)", async () => {
    await expect(
      createImportBatch({
        importType: "receipts",
        totalFiles: -1,
      })
    ).rejects.toThrow();
  });

  it("should reject invalid totalFiles (zero)", async () => {
    await expect(
      createImportBatch({
        importType: "receipts",
        totalFiles: 0,
      })
    ).rejects.toThrow();
  });

  it("should require authentication", async () => {
    vi.mocked(auth).mockResolvedValue(createMockAuth(null));

    await expect(
      createImportBatch({
        importType: "receipts",
        totalFiles: 5,
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("should handle optional sourceFormat", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
      importType: "receipts",
      sourceFormat: null,
      totalFiles: 5,
      status: "pending",
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      duplicateFiles: 0,
    };

    vi.mocked(db.insert).mockReturnValue(createMockInsert([mockBatch]));

    const result = await createImportBatch({
      importType: "receipts",
      totalFiles: 5,
    });

    expect(result.success).toBe(true);
  });
});

describe("updateBatchStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createMockAuth("test-user-id"));
  });

  it("should update batch status", async () => {
    const mockUpdatedBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "processing",
      processedFiles: 2,
      successfulFiles: 1,
      failedFiles: 1,
    };

    vi.mocked(db.update).mockReturnValue(createMockUpdate([mockUpdatedBatch]) as any);

    const result = await updateBatchStatus({
      batchId: "batch-123",
      status: "processing",
      processedFiles: 2,
      successfulFiles: 1,
      failedFiles: 1,
    });

    expect(result.success).toBe(true);
    expect(result.batch.status).toBe("processing");
  });

  it("should update batch with errors array", async () => {
    const mockUpdatedBatch = {
      id: "batch-123",
      userId: "test-user-id",
      errors: JSON.stringify(["Error 1", "Error 2"]),
    };

    vi.mocked(db.update).mockReturnValue(createMockUpdate([mockUpdatedBatch]) as any);

    const result = await updateBatchStatus({
      batchId: "batch-123",
      errors: ["Error 1", "Error 2"],
    });

    expect(result.success).toBe(true);
  });

  it("should throw error if batch not found", async () => {
    vi.mocked(db.update).mockReturnValue(createMockUpdate([]) as any);

    await expect(
      updateBatchStatus({
        batchId: "non-existent",
        status: "processing",
      })
    ).rejects.toThrow("Batch not found or unauthorized");
  });
});

describe("getBatchStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createMockAuth("test-user-id"));
  });

  it("should return batch status summary", async () => {
    const mockBatchSummary: BatchStatusSummary = {
      batchId: "batch-123",
      status: "processing",
      completionPercentage: 60,
      totalFiles: 5,
      processedFiles: 3,
      successfulFiles: 2,
      failedFiles: 1,
      duplicateFiles: 0,
      remainingFiles: 2,
      startedAt: new Date(),
      completedAt: null,
      estimatedCompletionAt: null,
      errors: null,
      importType: "receipts",
      sourceFormat: "images",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(getBatchStatusSummary).mockResolvedValue(mockBatchSummary);

    const result = await getBatchStatus({ batchId: "batch-123" });

    expect(result.success).toBe(true);
    expect(result.batch).toEqual(mockBatchSummary);
    expect(getBatchStatusSummary).toHaveBeenCalledWith("batch-123", "test-user-id");
  });
});

describe("completeBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createMockAuth("test-user-id"));
  });

  it("should mark batch as completed", async () => {
    const mockCompletedBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "completed",
      completedAt: new Date(),
    };

    vi.mocked(db.update).mockReturnValue(createMockUpdate([mockCompletedBatch]) as any);

    const result = await completeBatch({
      batchId: "batch-123",
      status: "completed",
    });

    expect(result.success).toBe(true);
    expect(result.batch.status).toBe("completed");
  });

  it("should mark batch as failed with errors", async () => {
    const mockFailedBatch = {
      id: "batch-123",
      userId: "test-user-id",
      status: "failed",
      completedAt: new Date(),
      errors: JSON.stringify(["Processing failed"]),
    };

    vi.mocked(db.update).mockReturnValue(createMockUpdate([mockFailedBatch]) as any);

    const result = await completeBatch({
      batchId: "batch-123",
      status: "failed",
      errors: ["Processing failed"],
    });

    expect(result.success).toBe(true);
    expect(result.batch.status).toBe("failed");
  });

  it("should throw error if batch not found", async () => {
    vi.mocked(db.update).mockReturnValue(createMockUpdate([]) as any);

    await expect(
      completeBatch({
        batchId: "non-existent",
        status: "completed",
      })
    ).rejects.toThrow("Batch not found or unauthorized");
  });
});
