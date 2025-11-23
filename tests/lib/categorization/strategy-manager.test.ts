import { describe, it, expect, vi } from "vitest";
import { CategoryStrategyManager } from "@/lib/categorization/strategy-manager";
import type {
  CategorizationStrategy,
  CategorizationInput,
  CategorizationContext,
} from "@/lib/categorization/strategies/base-strategy";

// Mock strategy classes
class MockHighPriorityStrategy implements CategorizationStrategy {
  name = "high-priority";
  priority = 1;

  async categorize(
    input: CategorizationInput,
    context: CategorizationContext
  ) {
    if (input.merchantName === "HighPriority") {
      return {
        categoryId: "cat-1",
        categoryName: "High Priority Category",
        confidence: 1.0,
        method: "rule" as const,
      };
    }
    return {
      categoryId: null,
      categoryName: null,
      confidence: 0,
      method: "none" as const,
    };
  }
}

class MockLowPriorityStrategy implements CategorizationStrategy {
  name = "low-priority";
  priority = 100;

  async categorize(
    input: CategorizationInput,
    context: CategorizationContext
  ) {
    return {
      categoryId: "cat-2",
      categoryName: "Low Priority Category",
      confidence: 0.8,
      method: "ai" as const,
    };
  }
}

describe("CategoryStrategyManager", () => {
  it("should sort strategies by priority", () => {
    const lowPriority = new MockLowPriorityStrategy();
    const highPriority = new MockHighPriorityStrategy();

    const manager = new CategoryStrategyManager([lowPriority, highPriority]);

    const names = manager.getStrategyNames();
    expect(names).toEqual(["high-priority", "low-priority"]);
  });

  it("should stop at first successful strategy", async () => {
    const highPriority = new MockHighPriorityStrategy();
    const lowPriority = new MockLowPriorityStrategy();
    const lowPrioritySpy = vi.spyOn(lowPriority, "categorize");

    const manager = new CategoryStrategyManager([highPriority, lowPriority]);

    const result = await manager.categorize(
      {
        merchantName: "HighPriority",
        description: null,
        amount: null,
      },
      {
        userId: "user-1",
        minConfidence: 0.7,
      }
    );

    expect(result.categoryId).toBe("cat-1");
    expect(result.categoryName).toBe("High Priority Category");
    expect(lowPrioritySpy).not.toHaveBeenCalled(); // Should not reach low priority
  });

  it("should try next strategy if first fails", async () => {
    const highPriority = new MockHighPriorityStrategy();
    const lowPriority = new MockLowPriorityStrategy();

    const manager = new CategoryStrategyManager([highPriority, lowPriority]);

    const result = await manager.categorize(
      {
        merchantName: "Unknown", // Won't match high priority
        description: null,
        amount: null,
      },
      {
        userId: "user-1",
        minConfidence: 0.7,
      }
    );

    expect(result.categoryId).toBe("cat-2");
    expect(result.categoryName).toBe("Low Priority Category");
  });

  it("should respect minConfidence threshold", async () => {
    const lowPriority = new MockLowPriorityStrategy();

    const manager = new CategoryStrategyManager([lowPriority]);

    // Low priority returns 0.8 confidence, but we require 0.9
    const result = await manager.categorize(
      {
        merchantName: "Test",
        description: null,
        amount: null,
      },
      {
        userId: "user-1",
        minConfidence: 0.9, // Higher than what the strategy returns
      }
    );

    // Should return no match due to confidence threshold
    expect(result.categoryId).toBeNull();
    expect(result.method).toBe("none");
  });

  it("should add and remove strategies dynamically", () => {
    const highPriority = new MockHighPriorityStrategy();
    const manager = new CategoryStrategyManager([highPriority]);

    expect(manager.getStrategyNames()).toEqual(["high-priority"]);

    const lowPriority = new MockLowPriorityStrategy();
    manager.addStrategy(lowPriority);

    expect(manager.getStrategyNames()).toEqual([
      "high-priority",
      "low-priority",
    ]);

    manager.removeStrategy("high-priority");

    expect(manager.getStrategyNames()).toEqual(["low-priority"]);
  });
});

