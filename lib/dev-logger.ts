/**
 * Development Logger
 *
 * Full-featured logger for local development and debugging
 * - Uses TOON format for token efficiency (falls back to JSON for nested structures)
 * - Logs all levels (debug, info, warn, error)
 * - Includes full context (including PII for debugging)
 * - Includes stack traces
 *
 * Use this extensively in development for debugging
 */

import { encode } from "@toon-format/toon";
import { safeSerialize, shouldUseJsonFormat } from "./safe-serializer";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  userId?: string;
  action?: string;
  correlationId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

type LogLevelConfig = "debug" | "info" | "warn" | "error";

class DevLogger {
  private useToon: boolean;
  private isDevelopment: boolean;
  private logLevel: LogLevelConfig;

  constructor() {
    // Only log in development mode
    // Next.js automatically sets NODE_ENV:
    // - "development" when running `npm run dev`
    // - "production" when running `npm run build` or `npm run start`
    // Falls back to development if NODE_ENV is not set (local development)
    this.isDevelopment =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === undefined;
    // Use TOON format by default, can be overridden with LOG_FORMAT env var
    this.useToon =
      process.env.LOG_FORMAT === "toon" || process.env.LOG_FORMAT !== "json";
    // Support LOG_LEVEL env var (debug, info, warn, error)
    const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
    this.logLevel =
      envLogLevel && ["debug", "info", "warn", "error"].includes(envLogLevel)
        ? (envLogLevel as LogLevelConfig)
        : "debug";
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isDevelopment) {
      return false;
    }

    const levelPriority: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levelPriority[level] >= levelPriority[this.logLevel];
  }

  private formatLog(entry: LogEntry): string {
    if (this.useToon) {
      // Check if entry has nested structures that TOON struggles with
      const hasNestedStructures =
        shouldUseJsonFormat(entry.context) || shouldUseJsonFormat(entry.error);

      if (hasNestedStructures) {
        // Use JSON for nested structures
        return JSON.stringify(entry, null, 2);
      }

      try {
        return encode(entry);
      } catch (error) {
        // Fallback to JSON if TOON encoding fails
        return JSON.stringify(entry, null, 2);
      }
    }
    return JSON.stringify(entry, null, 2);
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      // Safely serialize context to handle non-serializable values
      entry.context = safeSerialize(context) as LogContext;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    // Check if we should log based on LOG_LEVEL and environment
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context, error);
    const formatted = this.formatLog(entry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.log("error", message, context, err);
  }

  // Convenience methods for common patterns
  action(action: string, context?: LogContext): void {
    this.info(`[Action] ${action}`, { ...context, action });
  }

  api(method: string, path: string, context?: LogContext): void {
    this.info(`[API] ${method} ${path}`, { ...context, method, path });
  }

  db(operation: string, context?: LogContext): void {
    this.debug(`[DB] ${operation}`, { ...context, operation });
  }

  receipt(receiptId: string, action: string, context?: LogContext): void {
    this.info(`[Receipt] ${action}`, { ...context, receiptId, action });
  }

  import(batchId: string, action: string, context?: LogContext): void {
    this.info(`[Import] ${action}`, { ...context, batchId, action });
  }
}

// Export singleton instance for development use
export const devLogger = new DevLogger();

// Export types
export type { LogContext, LogLevel };
