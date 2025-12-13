# Testing Setup

This project uses **Vitest** for unit/integration testing and **Playwright** for E2E testing.

## Vitest (Unit/Integration Tests)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- `tests/modules/` - Module-aligned tests (mirrors `lib/modules/*`)
- `tests/lib/` - Cross-cutting library tests (not tied to a single module)
- `tests/setup.ts` - Test setup and mocks

### Writing Tests

Example test structure:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { yourAction } from "@/lib/modules/<domain>/actions";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe("yourAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should do something", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});
```

### Mocking Guidelines

- **Drizzle ORM**: Mock `@/lib/db` exports
- **Clerk Auth**: Mock `@clerk/nextjs/server` and `@clerk/nextjs`
- **Next.js**: Mock `next/navigation` and `next/cache` (already in setup.ts)

## Playwright (E2E Tests)

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

### First Time Setup

Install Playwright browsers (requires sudo):

```bash
npx playwright install --with-deps chromium
```

### Test Structure

- `e2e/` - End-to-end test specs
- Tests are currently stubs with TODOs

### Writing E2E Tests

Example test structure:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test("should do something", async ({ page }) => {
    // TODO: Implement E2E test
    test.skip("Not implemented yet");
  });
});
```

## Current Test Status

### ✅ Setup Complete

- Vitest configured
- Playwright configured
- Test structure created
- Mock setup in place

### 📝 TODO: Implement Tests

- Unit tests for batch actions
- Unit tests for batch tracker utilities
- Unit tests for safe-action wrapper
- E2E tests for batch import flow
- E2E tests for receipt upload flow

## Best Practices

1. **Mock Everything**: Isolate tests by mocking dependencies
2. **Test Validation**: Ensure Zod schemas reject invalid inputs
3. **Cover Auth Scenarios**: Test both authenticated and unauthenticated flows
4. **Use E2E for Critical Flows**: Validate full user journeys
5. **Keep Tests Fast**: Use mocks instead of real database/auth in unit tests
