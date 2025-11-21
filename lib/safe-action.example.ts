/**
 * Safe Action Wrapper - Usage Examples
 *
 * This wrapper automatically adds logging to all server actions without
 * requiring manual logging calls in each action.
 */

import { createSafeAction } from "@/lib/safe-action";

// Example 1: Simple action with one parameter
async function updateReceiptHandler(
  receiptId: string,
  data: { merchantName: string }
) {
  // Your action logic here
  // No need to add logging - it's automatic!
  return { success: true };
}

export const updateReceipt = createSafeAction(
  "updateReceipt",
  updateReceiptHandler
);

// Example 2: Action with multiple parameters
async function bulkUpdateHandler(
  receiptIds: string[],
  updates: Record<string, unknown>
) {
  // Your action logic here
  return { updated: receiptIds.length };
}

export const bulkUpdate = createSafeAction("bulkUpdate", bulkUpdateHandler);

// Example 3: Action that returns data
async function getReceiptsHandler(filters: { category?: string }) {
  // Your action logic here
  return [{ id: "1", merchantName: "Starbucks" }];
}

export const getReceipts = createSafeAction("getReceipts", getReceiptsHandler);

// Example 4: Public action (skip auth lookup)
async function publicHandler() {
  // Public action - no auth required
  return { data: "public" };
}

export const publicAction = createSafeAction("publicAction", publicHandler, {
  requireAuth: false,
});

// Example 5: Custom userId getter
async function customAuthHandler() {
  return { success: true };
}

export const customAction = createSafeAction(
  "customAction",
  customAuthHandler,
  {
    getUserId: async () => {
      // Custom logic to get userId
      return "custom-user-id";
    },
  }
);

/**
 * What gets logged automatically:
 *
 * 1. Action start (dev only):
 *    - Action name
 *    - Correlation ID (for tracing)
 *    - User ID (if authenticated)
 *    - All arguments (safely serialized)
 *
 * 2. Action success (dev only):
 *    - Action name
 *    - Correlation ID
 *    - Duration
 *    - Result (safely serialized)
 *
 * 3. Action error (both dev and prod):
 *    - Dev: Full context including arguments, correlation ID, and user ID
 *    - Prod: Full context (errors only)
 *
 * Features:
 * - Safe serialization handles non-serializable values, circular refs, large objects
 * - Correlation IDs enable tracing across logs
 * - Optional auth for public actions
 * - TOON format with automatic JSON fallback for nested structures
 */
