"use server";

import { createSafeAction } from "@/lib/safe-action";
import { devLogger } from "@/lib/dev-logger";

async function testLoggingHandler(param1: string, param2: number) {
  // Domain-specific logging - test milestone
  devLogger.debug("Inside test action handler", {
    param1,
    param2,
    timestamp: Date.now(),
  });

  // Simulate some work
  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    success: true,
    param1,
    param2,
    result: param1 + param2,
  };
}

async function testErrorHandler() {
  // Domain-specific logging - error scenario
  devLogger.warn("About to throw test error");

  throw new Error("Test error for logging demonstration");
}

async function testPublicHandler() {
  return {
    public: true,
    message: "This action doesn't require auth",
  };
}

export const testLoggingAction = createSafeAction(
  "testLogging",
  testLoggingHandler
);

export const testErrorAction = createSafeAction("testError", testErrorHandler);

export const testPublicAction = createSafeAction("testPublic", testPublicHandler, {
  requireAuth: false,
});

