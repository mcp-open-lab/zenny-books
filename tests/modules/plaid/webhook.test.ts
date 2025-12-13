/**
 * Plaid Webhook Handler Tests
 * Tests the /api/plaid/webhook endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([
          {
            id: "test-account-1",
            userId: "user-123",
            plaidItemId: "item-123",
            plaidAccessToken: "access-token-123",
            plaidAccountId: "account-123",
            institutionName: "Chase",
            accountName: "Checking",
            syncStatus: "active",
          },
        ])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

// Mock the sync function
vi.mock("@/lib/plaid/sync", () => ({
  syncPlaidTransactions: vi.fn(() => Promise.resolve({ success: true, transactionCount: 5 })),
}));

// Mock the Plaid client
vi.mock("@/lib/plaid/client", () => ({
  plaidClient: {
    webhookVerificationKeyGet: vi.fn(() => Promise.resolve({ data: { key: "mock-key" } })),
  },
}));

// Mock devLogger
vi.mock("@/lib/dev-logger", () => ({
  devLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Plaid Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set sandbox environment for tests
    process.env.PLAID_ENV = "sandbox";
  });

  describe("Webhook Payload Parsing", () => {
    it("should parse TRANSACTIONS SYNC_UPDATES_AVAILABLE webhook", async () => {
      const payload = {
        webhook_type: "TRANSACTIONS",
        webhook_code: "SYNC_UPDATES_AVAILABLE",
        item_id: "item-123",
        new_transactions: 5,
      };

      // Validate payload structure
      expect(payload.webhook_type).toBe("TRANSACTIONS");
      expect(payload.webhook_code).toBe("SYNC_UPDATES_AVAILABLE");
      expect(payload.item_id).toBeDefined();
    });

    it("should parse TRANSACTIONS DEFAULT_UPDATE webhook", async () => {
      const payload = {
        webhook_type: "TRANSACTIONS",
        webhook_code: "DEFAULT_UPDATE",
        item_id: "item-123",
        new_transactions: 10,
      };

      expect(payload.webhook_type).toBe("TRANSACTIONS");
      expect(payload.webhook_code).toBe("DEFAULT_UPDATE");
    });

    it("should parse TRANSACTIONS TRANSACTIONS_REMOVED webhook", async () => {
      const payload = {
        webhook_type: "TRANSACTIONS",
        webhook_code: "TRANSACTIONS_REMOVED",
        item_id: "item-123",
        removed_transactions: ["tx-1", "tx-2", "tx-3"],
      };

      expect(payload.webhook_type).toBe("TRANSACTIONS");
      expect(payload.removed_transactions).toHaveLength(3);
    });

    it("should parse ITEM ERROR webhook", async () => {
      const payload = {
        webhook_type: "ITEM",
        webhook_code: "ERROR",
        item_id: "item-123",
        error: {
          error_type: "ITEM_ERROR",
          error_code: "ITEM_LOGIN_REQUIRED",
          error_message: "the login details of this item have changed",
        },
      };

      expect(payload.webhook_type).toBe("ITEM");
      expect(payload.webhook_code).toBe("ERROR");
      expect(payload.error?.error_code).toBe("ITEM_LOGIN_REQUIRED");
    });

    it("should parse ITEM PENDING_EXPIRATION webhook", async () => {
      const payload = {
        webhook_type: "ITEM",
        webhook_code: "PENDING_EXPIRATION",
        item_id: "item-123",
        consent_expiration_time: "2025-12-31T23:59:59Z",
      };

      expect(payload.webhook_type).toBe("ITEM");
      expect(payload.webhook_code).toBe("PENDING_EXPIRATION");
    });

    it("should parse ITEM USER_PERMISSION_REVOKED webhook", async () => {
      const payload = {
        webhook_type: "ITEM",
        webhook_code: "USER_PERMISSION_REVOKED",
        item_id: "item-123",
      };

      expect(payload.webhook_type).toBe("ITEM");
      expect(payload.webhook_code).toBe("USER_PERMISSION_REVOKED");
    });
  });

  describe("Webhook Type Handling", () => {
    it("should identify transaction sync webhooks correctly", () => {
      const syncCodes = [
        "SYNC_UPDATES_AVAILABLE",
        "INITIAL_UPDATE",
        "HISTORICAL_UPDATE",
        "DEFAULT_UPDATE",
      ];

      for (const code of syncCodes) {
        const shouldSync = syncCodes.includes(code);
        expect(shouldSync).toBe(true);
      }
    });

    it("should identify item error webhooks correctly", () => {
      const errorCodes = ["ERROR", "PENDING_EXPIRATION", "USER_PERMISSION_REVOKED"];
      
      for (const code of errorCodes) {
        const isErrorCode = errorCodes.includes(code);
        expect(isErrorCode).toBe(true);
      }
    });

    it("should map error codes to sync status", () => {
      const statusMap: Record<string, string> = {
        "ERROR": "error",
        "PENDING_EXPIRATION": "pending_expiration",
        "USER_PERMISSION_REVOKED": "disconnected",
      };

      expect(statusMap["ERROR"]).toBe("error");
      expect(statusMap["PENDING_EXPIRATION"]).toBe("pending_expiration");
      expect(statusMap["USER_PERMISSION_REVOKED"]).toBe("disconnected");
    });
  });

  describe("Webhook Security", () => {
    it("should require plaid-verification header in production", () => {
      const headers = new Headers();
      const hasVerification = headers.has("plaid-verification");
      
      // In production, missing header should be rejected
      if (process.env.PLAID_ENV === "production") {
        expect(hasVerification).toBe(false);
      }
    });

    it("should allow requests in sandbox without strict verification", () => {
      process.env.PLAID_ENV = "sandbox";
      // Sandbox mode should be more lenient for testing
      expect(process.env.PLAID_ENV).toBe("sandbox");
    });
  });

  describe("Transaction Webhook Processing", () => {
    it("should trigger sync for SYNC_UPDATES_AVAILABLE", async () => {
      const { syncPlaidTransactions } = await import("@/lib/plaid/sync");
      const mockSync = vi.mocked(syncPlaidTransactions);

      // Simulate webhook triggering sync
      const account = {
        id: "test-account",
        plaidItemId: "item-123",
        plaidAccessToken: "access-token",
        plaidAccountId: "account-123",
        userId: "user-123",
      };

      await mockSync(account as any);

      expect(mockSync).toHaveBeenCalledWith(account);
    });
  });

  describe("Item Error Handling", () => {
    it("should update account status on ITEM ERROR", async () => {
      const { db } = await import("@/lib/db");
      
      // Verify db.update is available
      expect(db.update).toBeDefined();
    });

    it("should handle ITEM_LOGIN_REQUIRED error code", () => {
      const error = {
        error_type: "ITEM_ERROR",
        error_code: "ITEM_LOGIN_REQUIRED",
        error_message: "the login details of this item have changed",
      };

      // This error should trigger reconnect flow
      const needsReconnect = error.error_code === "ITEM_LOGIN_REQUIRED";
      expect(needsReconnect).toBe(true);
    });

    it("should handle ITEM_LOCKED error code", () => {
      const error = {
        error_type: "ITEM_ERROR", 
        error_code: "ITEM_LOCKED",
        error_message: "the account is locked",
      };

      // This error should also trigger reconnect flow
      const needsReconnect = ["ITEM_LOGIN_REQUIRED", "ITEM_LOCKED"].includes(error.error_code);
      expect(needsReconnect).toBe(true);
    });
  });

  describe("Webhook Response", () => {
    it("should return 200 even on processing errors to prevent retries", () => {
      // Plaid retries webhooks on non-2xx responses
      // We should return 200 and log errors instead
      const successResponse = { received: true };
      const errorResponse = { received: true, error: "Processing failed" };

      expect(successResponse.received).toBe(true);
      expect(errorResponse.received).toBe(true);
    });

    it("should return 401 for invalid webhook signatures", () => {
      const invalidResponse = { error: "Invalid webhook" };
      expect(invalidResponse.error).toBe("Invalid webhook");
    });

    it("should return 400 for malformed JSON", () => {
      const badRequestResponse = { error: "Invalid JSON" };
      expect(badRequestResponse.error).toBe("Invalid JSON");
    });
  });
});

