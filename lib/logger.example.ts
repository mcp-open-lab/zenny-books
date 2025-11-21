/**
 * Logger Usage Examples
 *
 * This file demonstrates how to use the loggers throughout the application.
 * - Use `devLogger` for development (full logging, TOON format)
 * - Use `logger` for production (errors only)
 */

import { logger } from "@/lib/logger";
import { devLogger } from "@/lib/dev-logger";

// ============================================
// DEVELOPMENT LOGGING (use devLogger)
// ============================================

// Basic logging - use devLogger in development
devLogger.info("Application started");
devLogger.warn("Deprecated API endpoint used");
devLogger.error(
  "Failed to connect to database",
  new Error("Connection timeout")
);

// With context - full PII for debugging
devLogger.info("User logged in", {
  userId: "user_123",
  email: "user@example.com",
});

// Action logging (common pattern)
devLogger.action("scanReceipt", {
  userId: "user_123",
  imageUrl: "https://...",
});

// API logging
devLogger.api("POST", "/api/receipts", {
  userId: "user_123",
  statusCode: 200,
});

// Database operations
devLogger.db("SELECT receipts WHERE userId = ?", {
  userId: "user_123",
  queryTime: "45ms",
});

// Receipt-specific logging
devLogger.receipt("receipt_456", "created", {
  userId: "user_123",
  merchantName: "Starbucks",
  totalAmount: "5.99",
});

// Import batch logging
devLogger.import("batch_789", "processing_started", {
  userId: "user_123",
  totalFiles: 50,
});

// Debug logging (only in development)
devLogger.debug("Cache hit", {
  key: "receipt:123",
  ttl: 3600,
});

// ============================================
// PRODUCTION LOGGING (use logger)
// ============================================

// Production errors only
try {
  // await processReceipt();
  throw new Error("Example error");
} catch (error) {
  // Production logger - only errors
  logger.error("Failed to process receipt", error, {
    action: "processReceipt",
    statusCode: 500,
  });

  // Dev logger - full context for debugging
  devLogger.error("Failed to process receipt", error, {
    userId: "user_123",
    receiptId: "receipt_456",
    action: "processReceipt",
  });
}

/**
 * Example TOON output in development:
 *
 * timestamp,level,message,context{userId,action}:
 *   2025-01-28T10:30:00.000Z,info,User logged in,user_123,login
 *
 * Example JSON output in production:
 *
 * {
 *   "timestamp": "2025-01-28T10:30:00.000Z",
 *   "level": "info",
 *   "message": "User logged in",
 *   "context": {
 *     "userId": "user_123",
 *     "action": "login"
 *   }
 * }
 */
