/**
 * Logger Utilities
 *
 * Helper to get the appropriate logger based on environment
 * In development, returns devLogger (full logging, TOON format)
 * In production, returns logger (errors only)
 */

import { logger } from "@/lib/logger";
import { devLogger } from "@/lib/dev-logger";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Get the appropriate logger for the current environment
 * - Development: Returns devLogger (full logging, TOON format)
 * - Production: Returns logger (errors only)
 */
export function getLogger() {
  return isDevelopment ? devLogger : logger;
}

/**
 * Type-safe logger that adapts to environment
 */
export const adaptiveLogger = isDevelopment ? devLogger : logger;
