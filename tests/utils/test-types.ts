/**
 * Test-specific types for mocking external dependencies
 * These types help avoid 'as any' in tests
 */

/**
 * Mock Clerk auth return type
 */
export interface MockAuthResult {
  userId: string | null;
  sessionId?: string | null;
  orgId?: string | null;
  orgRole?: string | null;
  orgSlug?: string | null;
}

/**
 * Helper to create a mock auth result
 */
export function createMockAuth(userId: string | null): MockAuthResult {
  return { userId };
}

