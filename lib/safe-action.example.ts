/**
 * Safe Action Wrapper - Usage Examples
 *
 * Use createAuthenticatedAction for actions that require auth (most actions).
 * Use createSafeAction for public actions that don't require auth.
 */

import { createAuthenticatedAction, createSafeAction } from "@/lib/safe-action";

// ============================================================================
// RECOMMENDED: createAuthenticatedAction
// - Automatically handles auth and throws "Unauthorized" if not logged in
// - Passes userId as the first argument to your handler
// - No need to call auth() manually!
// ============================================================================

// Example 1: Simple authenticated action
export const getReceipts = createAuthenticatedAction(
  "getReceipts",
  async (userId, filters: { category?: string; limit?: number }) => {
    // userId is automatically available - no auth() call needed!
    // return db.select().from(receipts).where(eq(receipts.userId, userId));
    return [{ id: "1", merchantName: "Starbucks" }];
  }
);

// Example 2: Action with no additional parameters
export const getUserSettings = createAuthenticatedAction(
  "getUserSettings",
  async (userId) => {
    // return db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return { theme: "dark", currency: "USD" };
  }
);

// Example 3: Action with multiple parameters
export const updateReceipt = createAuthenticatedAction(
  "updateReceipt",
  async (userId, receiptId: string, data: { merchantName: string }) => {
    // return db.update(receipts)
    //   .set(data)
    //   .where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId)));
    return { success: true };
  }
);

// Example 4: Bulk operations
export const bulkUpdate = createAuthenticatedAction(
  "bulkUpdate",
  async (userId, receiptIds: string[], updates: Record<string, unknown>) => {
    // Your bulk update logic using userId for ownership checks
    return { updated: receiptIds.length };
  }
);

// ============================================================================
// LEGACY: createSafeAction (for public actions only)
// - Use when you need a public action that doesn't require authentication
// ============================================================================

// Example: Public action (no auth required)
export const publicAction = createSafeAction(
  "publicAction",
  async () => {
    return { data: "public" };
  },
  { requireAuth: false }
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
 * - createAuthenticatedAction enforces auth and provides userId automatically
 */
