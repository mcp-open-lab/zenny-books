/**
 * TOON (Token-Oriented Object Notation) Utilities
 * Reduces token usage by 30-60% for flat data structures sent to LLMs
 * 
 * Format:
 *   header1, header2, header3
 *   value1, value2, value3
 *   value4, value5, value6
 */

/**
 * Convert an array of objects to TOON format
 * @param data Array of objects with consistent keys
 * @param keys Optional specific keys to include (in order)
 * @returns TOON formatted string
 */
export function toTOON<T extends Record<string, unknown>>(
  data: T[],
  keys?: (keyof T)[]
): string {
  if (data.length === 0) return "";

  // Get keys from first object or use provided keys
  const headers = keys || (Object.keys(data[0]) as (keyof T)[]);
  
  // Build header row
  const headerRow = headers.join(", ");
  
  // Build data rows
  const dataRows = data.map(item => 
    headers.map(key => formatValue(item[key])).join(", ")
  );
  
  return [headerRow, ...dataRows].join("\n");
}

/**
 * Format a single value for TOON output
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    // Escape commas in strings
    if (value.includes(",")) return `"${value}"`;
    return value;
  }
  return String(value);
}

/**
 * Convert categories to TOON format for AI prompts
 */
export function categoriesToTOON(
  categories: Array<{ id: string; name: string; type?: string }>
): string {
  if (categories.length === 0) return "No categories available";
  
  // If all categories have type, include it
  const hasType = categories.some(c => c.type);
  
  if (hasType) {
    return toTOON(categories, ["name", "type"]);
  }
  
  // Simple format: just names
  return toTOON(categories, ["name"]);
}

/**
 * Convert businesses to TOON format for AI prompts
 */
export function businessesToTOON(
  businesses: Array<{ id: string; name: string }>
): string {
  if (businesses.length === 0) return "";
  return toTOON(businesses, ["id", "name"]);
}

