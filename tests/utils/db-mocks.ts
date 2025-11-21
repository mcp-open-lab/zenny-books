import { vi } from "vitest";

/**
 * Type-safe Drizzle ORM mock utilities
 * These match the Drizzle fluent API structure without requiring 'as any'
 */

export interface MockSelectBuilder {
  from: ReturnType<typeof vi.fn>;
}

export interface MockFromBuilder {
  where: ReturnType<typeof vi.fn>;
}

export interface MockWhereBuilder {
  limit: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
}

export interface MockInsertBuilder {
  values: ReturnType<typeof vi.fn>;
}

export interface MockValuesBuilder {
  returning: ReturnType<typeof vi.fn>;
}

export interface MockUpdateBuilder {
  set: ReturnType<typeof vi.fn>;
}

export interface MockSetBuilder {
  where: ReturnType<typeof vi.fn>;
}

export interface MockUpdateWhereBuilder {
  returning: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock Drizzle select query builder
 */
export function createMockSelect<T = unknown>(
  mockData: T[] | (() => T[])
): MockSelectBuilder {
  const data = typeof mockData === "function" ? mockData() : mockData;

  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(data),
        orderBy: vi.fn().mockResolvedValue(data),
      } as MockWhereBuilder),
    } as MockFromBuilder),
  };
}

/**
 * Creates a mock Drizzle select query builder that returns different data on each call
 */
export function createMockSelectSequence<T = unknown>(
  ...mockDataArrays: T[][]
): MockSelectBuilder {
  let callIndex = 0;

  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockImplementation(() => {
          const data = mockDataArrays[callIndex] || [];
          callIndex++;
          return Promise.resolve(data);
        }),
        orderBy: vi.fn().mockImplementation(() => {
          const data = mockDataArrays[callIndex] || [];
          callIndex++;
          return Promise.resolve(data);
        }),
      } as MockWhereBuilder),
    } as MockFromBuilder),
  };
}

/**
 * Creates a mock Drizzle insert query builder
 */
export function createMockInsert<T = unknown>(
  mockReturn: T[]
): MockInsertBuilder {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(mockReturn),
    } as MockValuesBuilder),
  };
}

/**
 * Creates a mock Drizzle update query builder
 */
export function createMockUpdate<T = unknown>(
  mockReturn: T[]
): MockUpdateBuilder {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(mockReturn),
      } as MockUpdateWhereBuilder),
    } as MockSetBuilder),
  };
}
