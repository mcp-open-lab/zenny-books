/**
 * Safe Serializer for Logging
 *
 * Safely serializes objects for logging, handling:
 * - Large objects (truncation)
 * - Non-serializable values (functions, symbols, etc.)
 * - Circular references
 * - Blobs/Streams
 */

const MAX_STRING_LENGTH = 1000;
const MAX_DEPTH = 5;
const MAX_ARRAY_LENGTH = 50;

function isNestedObject(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "object" && item !== null);
  }
  return Object.values(value).some((v) => typeof v === "object" && v !== null);
}

function hasDeepNesting(obj: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) {
    return true;
  }
  if (obj === null || typeof obj !== "object") {
    return false;
  }
  if (Array.isArray(obj)) {
    return obj.some((item) => hasDeepNesting(item, depth + 1));
  }
  return Object.values(obj).some((v) => hasDeepNesting(v, depth + 1));
}

export function safeSerialize(
  value: unknown,
  options: {
    maxDepth?: number;
    maxStringLength?: number;
    maxArrayLength?: number;
  } = {}
): unknown {
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const maxStringLength = options.maxStringLength ?? MAX_STRING_LENGTH;
  const maxArrayLength = options.maxArrayLength ?? MAX_ARRAY_LENGTH;

  const seen = new WeakSet();

  function serialize(val: unknown, depth = 0): unknown {
    if (depth > maxDepth) {
      return "[Max Depth Reached]";
    }

    if (val === null || val === undefined) {
      return val;
    }

    if (typeof val === "string") {
      if (val.length > maxStringLength) {
        return (
          val.substring(0, maxStringLength) +
          `...[truncated ${val.length - maxStringLength} chars]`
        );
      }
      return val;
    }

    if (typeof val === "number" || typeof val === "boolean") {
      return val;
    }

    if (typeof val === "function") {
      return `[Function: ${val.name || "anonymous"}]`;
    }

    if (typeof val === "symbol") {
      return `[Symbol: ${val.toString()}]`;
    }

    if (val instanceof Error) {
      return {
        name: val.name,
        message: val.message,
        stack: val.stack?.substring(0, maxStringLength),
      };
    }

    if (val instanceof Date) {
      return val.toISOString();
    }

    if (val instanceof RegExp) {
      return val.toString();
    }

    if (val instanceof Promise) {
      return "[Promise]";
    }

    if (val instanceof Map) {
      return Object.fromEntries(
        Array.from(val.entries())
          .slice(0, maxArrayLength)
          .map(([k, v]) => [serialize(k, depth + 1), serialize(v, depth + 1)])
      );
    }

    if (val instanceof Set) {
      return Array.from(val)
        .slice(0, maxArrayLength)
        .map((v) => serialize(v, depth + 1));
    }

    if (typeof val === "object") {
      if (seen.has(val)) {
        return "[Circular Reference]";
      }

      if (val instanceof ArrayBuffer || val instanceof Blob) {
        return `[${val.constructor.name}]`;
      }

      if (Array.isArray(val)) {
        seen.add(val);
        const truncated = val.slice(0, maxArrayLength);
        const result = truncated.map((item) => serialize(item, depth + 1));
        if (val.length > maxArrayLength) {
          result.push(`...[${val.length - maxArrayLength} more items]`);
        }
        seen.delete(val);
        return result;
      }

      seen.add(val);
      const result: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(val)) {
        try {
          result[key] = serialize(v, depth + 1);
        } catch (e) {
          result[key] = `[Serialization Error: ${
            e instanceof Error ? e.message : String(e)
          }]`;
        }
      }
      seen.delete(val);
      return result;
    }

    return String(val);
  }

  try {
    return serialize(value);
  } catch (error) {
    return `[Serialization Failed: ${
      error instanceof Error ? error.message : String(error)
    }]`;
  }
}

/**
 * Check if an object has nested structures that TOON format struggles with
 */
export function shouldUseJsonFormat(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }

  if (hasDeepNesting(value)) {
    return true;
  }

  if (isNestedObject(value)) {
    return true;
  }

  return false;
}
