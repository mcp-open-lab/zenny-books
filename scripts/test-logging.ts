#!/usr/bin/env tsx

/**
 * Test script for logging architecture
 *
 * Run with: npm run test:logging
 * Or: npx tsx scripts/test-logging.ts
 *
 * Tests:
 * - Dev logger (all levels)
 * - Production logger (errors only)
 * - Safe action wrapper
 * - Safe serializer
 * - TOON format vs JSON fallback
 * - LOG_LEVEL filtering
 */

import { devLogger } from "@/lib/dev-logger";
import { logger } from "@/lib/logger";
import { createSafeAction } from "@/lib/safe-action";
import { safeSerialize, shouldUseJsonFormat } from "@/lib/safe-serializer";

console.log("=".repeat(60));
console.log("Testing Logging Architecture");
console.log("=".repeat(60));
console.log(`NODE_ENV: ${process.env.NODE_ENV || "undefined"}`);
console.log(`LOG_LEVEL: ${process.env.LOG_LEVEL || "debug (default)"}`);
console.log(`LOG_FORMAT: ${process.env.LOG_FORMAT || "toon (default)"}`);
console.log("=".repeat(60));
console.log();

// Test 1: Dev Logger - All Levels
console.log("Test 1: Dev Logger - All Levels");
console.log("-".repeat(60));
devLogger.debug("Debug message", { test: "debug", userId: "test-user" });
devLogger.info("Info message", { test: "info", userId: "test-user" });
devLogger.warn("Warning message", { test: "warn", userId: "test-user" });
devLogger.error("Error message", new Error("Test error"), {
  test: "error",
  userId: "test-user",
});
console.log();

// Test 2: Dev Logger - Convenience Methods
console.log("Test 2: Dev Logger - Convenience Methods");
console.log("-".repeat(60));
devLogger.action("testAction", { userId: "test-user", status: "testing" });
devLogger.api("GET", "/api/test", { userId: "test-user", statusCode: 200 });
devLogger.db("SELECT * FROM receipts", { userId: "test-user", queryTime: "10ms" });
devLogger.receipt("receipt-123", "scanned", { userId: "test-user" });
devLogger.import("batch-456", "started", { userId: "test-user" });
console.log();

// Test 3: Production Logger - Errors Only
console.log("Test 3: Production Logger - Errors Only");
console.log("-".repeat(60));
logger.error("Production error", new Error("Test production error"), {
  action: "testAction",
  correlationId: "test-correlation-id",
  statusCode: 500,
});
console.log();

// Test 4: Safe Serializer
console.log("Test 4: Safe Serializer");
console.log("-".repeat(60));

const testData = {
  string: "normal string",
  longString: "a".repeat(2000),
  number: 42,
  array: Array.from({ length: 100 }, (_, i) => i),
  nested: {
    level1: {
      level2: {
        level3: {
          level4: { deep: "value" },
        },
      },
    },
  },
  circular: {} as any,
  function: () => "test",
  symbol: Symbol("test"),
  date: new Date(),
  error: new Error("test error"),
};

testData.circular.self = testData.circular;

const serialized = safeSerialize(testData);
console.log("Serialized data (truncated):", JSON.stringify(serialized, null, 2).substring(0, 500));
console.log();

// Test 5: TOON Format Detection
console.log("Test 5: TOON Format Detection");
console.log("-".repeat(60));
const simple = { userId: "user-123", action: "test" };
const nested = {
  user: {
    profile: {
      settings: {
        theme: "dark",
      },
    },
  },
};

console.log("Simple object (should use TOON):", shouldUseJsonFormat(simple));
console.log("Nested object (should use JSON):", shouldUseJsonFormat(nested));
console.log();

// Test 6: Safe Action Wrapper
console.log("Test 6: Safe Action Wrapper");
console.log("-".repeat(60));

async function testActionHandler(param1: string, param2: number) {
  devLogger.debug("Inside action handler", { param1, param2 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { success: true, param1, param2 };
}

async function failingActionHandler() {
  throw new Error("Test action error");
}

const testAction = createSafeAction("testAction", testActionHandler);
const failingAction = createSafeAction("failingAction", failingActionHandler);

async function runAsyncTests() {
  // Test successful action
  console.log("Testing successful action...");
  try {
    await testAction("test-param", 42);
  } catch (e) {
    console.error("Unexpected error:", e);
  }

  console.log();
  console.log("Testing failing action...");
  try {
    await failingAction();
  } catch (e) {
    // Expected error
  }

  console.log();

  // Test 7: Public Action (no auth)
  console.log("Test 7: Public Action (no auth)");
  console.log("-".repeat(60));

  const publicAction = createSafeAction(
    "publicAction",
    async () => ({ public: true }),
    { requireAuth: false }
  );

  await publicAction();

  console.log();
  console.log("=".repeat(60));
  console.log("Testing Complete!");
  console.log("=".repeat(60));
  console.log();
  console.log("Check the logs above to verify:");
  console.log("1. Dev logger outputs all levels");
  console.log("2. Production logger only outputs errors");
  console.log("3. Safe action wrapper logs start/success/error");
  console.log("4. Safe serializer handles complex data");
  console.log("5. TOON format detection works");
  console.log("6. Correlation IDs are included in logs");
}

// Run async tests
runAsyncTests().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});

