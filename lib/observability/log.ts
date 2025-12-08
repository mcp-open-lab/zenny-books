import { devLogger } from "@/lib/dev-logger";

type LogContext = Record<string, unknown>;

export function logInfo(message: string, context: LogContext = {}): void {
  if (devLogger?.info) {
    devLogger.info(message, context);
  } else {
    console.info(message, context);
  }
}

export function logError(
  message: string,
  error?: unknown,
  context: LogContext = {}
): void {
  if (error instanceof Error) {
    context = { ...context, error: error.message, stack: error.stack };
  } else if (error) {
    context = { ...context, error };
  }

  if (devLogger?.error) {
    devLogger.error(message, context);
  } else {
    console.error(message, context);
  }
}
