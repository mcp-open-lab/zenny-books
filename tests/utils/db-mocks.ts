import { vi } from "vitest";
import type {
  PgSelectBuilder,
  PgInsertBuilder,
  PgUpdateBuilder,
} from "drizzle-orm/pg-core";

/**
 * Type-safe Drizzle ORM mock utilities
 * Uses Partial<> to match Drizzle's types without requiring full implementation
 */

/**
 * Mock select builder - partial type that satisfies Drizzle's PgSelectBuilder
 */
export type MockSelectBuilder = Partial<PgSelectBuilder<any, "db">> & {
  from: ReturnType<typeof vi.fn>;
};

/**
 * Mock from builder - returned by select().from()
 */
export interface MockFromBuilder {
  where: ReturnType<typeof vi.fn>;
}

/**
 * Mock where builder - returned by from().where()
 * Includes Promise methods for direct await
 */
export interface MockWhereBuilder {
  limit: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  then?: <TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: unknown) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined
  ) => Promise<TResult1 | TResult2>;
  catch?: <TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined
  ) => Promise<unknown | TResult>;
  finally?: (onfinally?: (() => void) | null | undefined) => Promise<unknown>;
  [Symbol.toStringTag]?: string;
}

/**
 * Mock insert builder - partial type that satisfies Drizzle's PgInsertBuilder
 */
export type MockInsertBuilder = Partial<PgInsertBuilder<any, any, false>> & {
  values: ReturnType<typeof vi.fn>;
};

/**
 * Mock values builder - returned by insert().values()
 */
export interface MockValuesBuilder {
  returning: ReturnType<typeof vi.fn>;
}

/**
 * Mock update builder - partial type that satisfies Drizzle's PgUpdateBuilder
 */
export type MockUpdateBuilder = Partial<PgUpdateBuilder<any, any>> & {
  set: ReturnType<typeof vi.fn>;
};

/**
 * Mock set builder - returned by update().set()
 */
export interface MockSetBuilder {
  where: ReturnType<typeof vi.fn>;
}

/**
 * Mock update where builder - returned by set().where()
 */
export interface MockUpdateWhereBuilder {
  returning: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock Drizzle select query builder
 * @param mockData - Array of mock data or function returning array
 */
export function createMockSelect<T = unknown>(
  mockData: T[] | (() => T[])
): MockSelectBuilder {
  const data = typeof mockData === "function" ? mockData() : mockData;
  const promise = Promise.resolve(data);

  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(data),
        orderBy: vi.fn().mockResolvedValue(data),
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        finally: promise.finally.bind(promise),
        [Symbol.toStringTag]: "Promise",
      } as MockWhereBuilder),
    } as MockFromBuilder),
  };
}

/**
 * Creates a mock Drizzle select query builder that returns different data on each call
 * @param mockDataArrays - Arrays of mock data, one per query call
 */
export function createMockSelectSequence(
  ...mockDataArrays: unknown[][]
): MockSelectBuilder {
  let callIndex = 0;

  const getNextData = () => {
    const data = mockDataArrays[callIndex] || [];
    callIndex++;
    return data;
  };

  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        const data = getNextData();
        const promise = Promise.resolve(data);
        return {
          limit: vi.fn().mockResolvedValue(data),
          orderBy: vi.fn().mockResolvedValue(data),
          then: promise.then.bind(promise),
          catch: promise.catch.bind(promise),
          finally: promise.finally.bind(promise),
          [Symbol.toStringTag]: "Promise",
        } as MockWhereBuilder;
      }),
    } as MockFromBuilder),
  };
}

/**
 * Creates a mock Drizzle insert query builder
 * @param mockReturn - Array of mock return data
 */
export function createMockInsert(mockReturn: unknown[]): MockInsertBuilder {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(mockReturn),
    } as MockValuesBuilder),
  };
}

/**
 * Creates a mock Drizzle update query builder
 * @param mockReturn - Array of mock return data
 */
export function createMockUpdate(mockReturn: unknown[]): MockUpdateBuilder {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(mockReturn),
      } as MockUpdateWhereBuilder),
    } as MockSetBuilder),
  };
}

/**
 * Creates a mock Drizzle update query builder that returns different data on each call
 * @param mockReturnArrays - Arrays of mock return data, one per update call
 */
export function createMockUpdateSequence(
  ...mockReturnArrays: unknown[][]
): MockUpdateBuilder {
  let callIndex = 0;

  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          const data = mockReturnArrays[callIndex] || [];
          callIndex++;
          return Promise.resolve(data);
        }),
      } as MockUpdateWhereBuilder),
    } as MockSetBuilder),
  };
}
