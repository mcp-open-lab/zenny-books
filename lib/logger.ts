/**
 * Production Logger
 *
 * Safe for production use - only logs errors
 * Use this logger in production code paths
 */

type LogLevel = "error";

interface LogContext {
  action?: string;
  endpoint?: string;
  statusCode?: number;
  errorCode?: string;
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
  };
}

class ProductionLogger {
  private createLogEntry(
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
      };
    }

    return entry;
  }

  /**
   * Log an error in production
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : new Error(String(error));
    const entry = this.createLogEntry(message, context, err);
    console.error(JSON.stringify(entry, null, 2));
  }
}

// Export singleton instance for production use
export const logger = new ProductionLogger();

// Export types
export type { LogContext };
