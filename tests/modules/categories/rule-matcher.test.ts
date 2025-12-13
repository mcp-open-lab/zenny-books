import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RuleMatcher } from "@/lib/categorization/strategies/rule-matcher";
import { db } from "@/lib/db";
import { categories, categoryRules } from "@/lib/db/schema";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("RuleMatcher", () => {
  let matcher: RuleMatcher;

  beforeEach(() => {
    matcher = new RuleMatcher();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct name and priority", () => {
    expect(matcher.name).toBe("rule");
    expect(matcher.priority).toBe(1);
  });

  it("should match exact pattern", async () => {
    // Mock DB response
    const mockFrom = vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            rule: {
              field: "merchantName",
              value: "Starbucks",
              matchType: "exact",
            },
            category: {
              id: "cat-1",
              name: "Coffee & Tea",
            },
          },
        ]),
      }),
    });

    (db.select as any).mockReturnValue({
      from: mockFrom,
    });

    const result = await matcher.categorize(
      {
        merchantName: "Starbucks",
        description: null,
        amount: null,
      },
      {
        userId: "user-1",
      }
    );

    expect(result.categoryId).toBe("cat-1");
    expect(result.categoryName).toBe("Coffee & Tea");
    expect(result.confidence).toBe(1.0);
    expect(result.method).toBe("rule");
  });

  it("should match contains pattern", async () => {
    // Mock DB response
    const mockFrom = vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            rule: {
              field: "merchantName",
              value: "star",
              matchType: "contains",
            },
            category: {
              id: "cat-1",
              name: "Coffee & Tea",
            },
          },
        ]),
      }),
    });

    (db.select as any).mockReturnValue({
      from: mockFrom,
    });

    const result = await matcher.categorize(
      {
        merchantName: "Starbucks Coffee",
        description: null,
        amount: null,
      },
      {
        userId: "user-1",
      }
    );

    expect(result.categoryId).toBe("cat-1");
    expect(result.method).toBe("rule");
  });

  it("should return no match when no rules match", async () => {
    // Mock DB response with non-matching rule
    const mockFrom = vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            rule: {
              field: "merchantName",
              value: "Walmart",
              matchType: "exact",
            },
            category: {
              id: "cat-1",
              name: "Groceries",
            },
          },
        ]),
      }),
    });

    (db.select as any).mockReturnValue({
      from: mockFrom,
    });

    const result = await matcher.categorize(
      {
        merchantName: "Starbucks",
        description: null,
        amount: null,
      },
      {
        userId: "user-1",
      }
    );

    expect(result.categoryId).toBeNull();
    expect(result.method).toBe("none");
    expect(result.confidence).toBe(0);
  });

  it("should handle case insensitivity", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            rule: {
              field: "merchantName",
              value: "starbucks",
              matchType: "exact",
            },
            category: {
              id: "cat-1",
              name: "Coffee & Tea",
            },
          },
        ]),
      }),
    });

    (db.select as any).mockReturnValue({
      from: mockFrom,
    });

    const result = await matcher.categorize(
      {
        merchantName: "STARBUCKS",
        description: null,
        amount: null,
      },
      {
        userId: "user-1",
      }
    );

    expect(result.categoryId).toBe("cat-1");
    expect(result.method).toBe("rule");
  });
});

