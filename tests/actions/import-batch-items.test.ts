import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBatchItem,
  updateItemStatus,
  getFailedItems,
  retryBatchItem,
} from "@/app/actions/import-batch-items";
import { db } from "@/lib/db";
import { importBatchItems, importBatches } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import {
  createMockSelect,
  createMockSelectSequence,
  createMockInsert,
  createMockUpdate,
} from "../utils/db-mocks";
import { createMockAuth } from "../utils/test-types";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("createBatchItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createMockAuth("test-user-id"));
  });

  it("should create a batch item with valid input", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockItem = {
      id: "item-123",
      batchId: "batch-123",
      fileName: "receipt.jpg",
      fileUrl: "https://example.com/receipt.jpg",
      fileSizeBytes: 1024,
      order: 0,
      status: "pending",
      retryCount: 0,
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]));

    vi.mocked(db.insert).mockReturnValue(createMockInsert([mockItem]));

    const result = await createBatchItem({
      batchId: "batch-123",
      fileName: "receipt.jpg",
      fileUrl: "https://example.com/receipt.jpg",
      fileSizeBytes: 1024,
      order: 0,
    });

    expect(result.success).toBe(true);
    expect(result.itemId).toBe("item-123");
  });

  it("should reject if batch does not belong to user", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "other-user-id",
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]));

    await expect(
      createBatchItem({
        batchId: "batch-123",
        fileName: "receipt.jpg",
        order: 0,
      })
    ).rejects.toThrow("Batch not found or unauthorized");
  });

  it("should reject if batch not found", async () => {
    vi.mocked(db.select).mockReturnValue(createMockSelect([]));

    await expect(
      createBatchItem({
        batchId: "non-existent",
        fileName: "receipt.jpg",
        order: 0,
      })
    ).rejects.toThrow("Batch not found or unauthorized");
  });

  it("should require fileName", async () => {
    await expect(
      createBatchItem({
        batchId: "batch-123",
        fileName: "" as any,
        order: 0,
      })
    ).rejects.toThrow();
  });

  it("should handle optional fileUrl and fileSizeBytes", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockItem = {
      id: "item-123",
      batchId: "batch-123",
      fileName: "receipt.jpg",
      fileUrl: null,
      fileSizeBytes: null,
      order: 0,
      status: "pending",
      retryCount: 0,
    };

    vi.mocked(db.select).mockReturnValue(createMockSelect([mockBatch]));

    vi.mocked(db.insert).mockReturnValue(createMockInsert([mockItem]));

    const result = await createBatchItem({
      batchId: "batch-123",
      fileName: "receipt.jpg",
      order: 0,
    });

    expect(result.success).toBe(true);
  });
});

describe("updateItemStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createMockAuth("test-user-id"));
  });

  it("should update item status to completed", async () => {
    const mockItem = {
      id: "item-123",
      batchId: "batch-123",
      status: "processing",
    };

    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockUpdatedItem = {
      id: "item-123",
      status: "completed",
      documentId: "doc-123",
    };

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockItem], [mockBatch])
    );

    vi.mocked(db.update).mockReturnValue(createMockUpdate([mockUpdatedItem]));

    const result = await updateItemStatus({
      itemId: "item-123",
      status: "completed",
      documentId: "doc-123",
    });

    expect(result.success).toBe(true);
    expect(result.item.status).toBe("completed");
  });

  it("should update item with documentId", async () => {
    const mockItem = {
      id: "item-123",
      batchId: "batch-123",
    };

    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockUpdatedItem = {
      id: "item-123",
      documentId: "doc-123",
    };

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockItem], [mockBatch])
    );

    vi.mocked(db.update).mockReturnValue(createMockUpdate([mockUpdatedItem]));

    const result = await updateItemStatus({
      itemId: "item-123",
      documentId: "doc-123",
    });

    expect(result.success).toBe(true);
    expect(result.item.documentId).toBe("doc-123");
  });

  it("should handle duplicate detection", async () => {
    const mockItem = {
      id: "item-123",
      batchId: "batch-123",
    };

    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockUpdatedItem = {
      id: "item-123",
      status: "duplicate",
      duplicateOfDocumentId: "doc-456",
      duplicateMatchType: "exact_image",
    };

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockItem], [mockBatch])
    );

    vi.mocked(db.update).mockReturnValue(createMockUpdate([mockUpdatedItem]));

    const result = await updateItemStatus({
      itemId: "item-123",
      status: "duplicate",
      duplicateOfDocumentId: "doc-456",
      duplicateMatchType: "exact_image",
    });

    expect(result.success).toBe(true);
    expect(result.item.status).toBe("duplicate");
    expect(result.item.duplicateOfDocumentId).toBe("doc-456");
  });

  it("should throw error if item not found", async () => {
    vi.mocked(db.select).mockReturnValue(createMockSelect([]));

    await expect(
      updateItemStatus({
        itemId: "non-existent",
        status: "completed",
      })
    ).rejects.toThrow("Batch item not found");
  });

  it("should throw error if batch not found", async () => {
    const mockItem = {
      id: "item-123",
      batchId: "batch-123",
    };

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockItem], [])
    );

    await expect(
      updateItemStatus({
        itemId: "item-123",
        status: "completed",
      })
    ).rejects.toThrow("Batch not found or unauthorized");
  });
});

describe("getFailedItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createMockAuth("test-user-id"));
  });

  it("should return failed items for a batch", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockFailedItems = [
      {
        id: "item-1",
        batchId: "batch-123",
        fileName: "receipt1.jpg",
        status: "failed",
        errorMessage: "Extraction failed",
        order: 0,
      },
      {
        id: "item-2",
        batchId: "batch-123",
        fileName: "receipt2.jpg",
        status: "failed",
        errorMessage: "Invalid format",
        order: 1,
      },
    ];

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockBatch], mockFailedItems)
    );

    const result = await getFailedItems({ batchId: "batch-123" });

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].status).toBe("failed");
  });

  it("should return empty array if no failed items", async () => {
    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockBatch], [])
    );

    const result = await getFailedItems({ batchId: "batch-123" });

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it("should throw error if batch not found", async () => {
    vi.mocked(db.select).mockReturnValue(createMockSelect([]));

    await expect(
      getFailedItems({ batchId: "non-existent" })
    ).rejects.toThrow("Batch not found or unauthorized");
  });
});

describe("retryBatchItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(createMockAuth("test-user-id"));
  });

  it("should retry failed item", async () => {
    const mockItem = {
      id: "item-123",
      batchId: "batch-123",
      status: "failed",
      retryCount: 1,
      errorMessage: "Previous error",
      errorCode: "ERR_001",
    };

    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    const mockUpdatedItem = {
      id: "item-123",
      status: "pending",
      retryCount: 2,
      errorMessage: null,
      errorCode: null,
    };

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockItem], [mockBatch])
    );

    vi.mocked(db.update).mockReturnValue(createMockUpdate([mockUpdatedItem]));

    const result = await retryBatchItem({ itemId: "item-123" });

    expect(result.success).toBe(true);
    expect(result.item.status).toBe("pending");
    expect(result.item.retryCount).toBe(2);
    expect(result.item.errorMessage).toBeNull();
  });

  it("should throw error if item not in failed status", async () => {
    const mockItem = {
      id: "item-123",
      batchId: "batch-123",
      status: "completed",
      retryCount: 0,
    };

    const mockBatch = {
      id: "batch-123",
      userId: "test-user-id",
    };

    vi.mocked(db.select).mockReturnValue(
      createMockSelectSequence([mockItem], [mockBatch])
    );

    await expect(
      retryBatchItem({ itemId: "item-123" })
    ).rejects.toThrow("Item is not in failed status");
  });

  it("should throw error if item not found", async () => {
    vi.mocked(db.select).mockReturnValue(createMockSelect([]));

    await expect(
      retryBatchItem({ itemId: "non-existent" })
    ).rejects.toThrow("Batch item not found");
  });
});
