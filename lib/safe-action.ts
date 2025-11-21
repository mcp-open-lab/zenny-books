import { auth } from "@clerk/nextjs/server";
import { devLogger } from "@/lib/dev-logger";
import { logger } from "@/lib/logger";
import { safeSerialize } from "@/lib/safe-serializer";
import { createId } from "@paralleldrive/cuid2";

type ActionHandler<TArgs extends any[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

interface SafeActionOptions {
  /**
   * Whether to require authentication. If false, skips auth() call entirely.
   * Default: true (tries auth but doesn't fail if it throws)
   */
  requireAuth?: boolean;
  /**
   * Optional function to get userId. If provided, skips auth() call.
   * Useful for public actions or when userId is already available.
   */
  getUserId?: () => Promise<string | undefined>;
}

/**
 * Wraps a server action with automatic logging and error handling
 *
 * Features:
 * - Logs action start with arguments (dev only, safely serialized)
 * - Logs action success with result (dev only, safely serialized)
 * - Logs errors to both dev (full context) and prod loggers
 * - Automatically captures userId if authenticated (optional)
 * - Generates correlation ID for tracing across logs
 *
 * @param actionName Name of the action for logging context
 * @param handler The server action function implementation
 * @param options Optional configuration for auth behavior
 */
export function createSafeAction<TArgs extends any[], TResult>(
  actionName: string,
  handler: ActionHandler<TArgs, TResult>,
  options: SafeActionOptions = {}
): ActionHandler<TArgs, TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const correlationId = createId();
    let userId: string | undefined;

    try {
      // Get userId based on options
      if (options.getUserId) {
        userId = await options.getUserId();
      } else if (options.requireAuth !== false) {
        // Try to get userId for context, but don't fail if auth throws or returns null
        // (some actions might be public)
        try {
          const authResult = await auth();
          userId = authResult.userId || undefined;
        } catch (e) {
          // Ignore auth errors here, let the handler handle auth requirements
        }
      }

      // Safely serialize args for logging
      const serializedArgs = safeSerialize(args);

      // Log start (dev only - devLogger checks NODE_ENV internally)
      devLogger.action(actionName, {
        userId,
        correlationId,
        status: "started",
        args: serializedArgs,
      });

      const startTime = Date.now();
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      // Safely serialize result for logging
      const serializedResult = safeSerialize(result);

      // Log success (dev only - devLogger checks NODE_ENV internally)
      devLogger.action(actionName, {
        userId,
        correlationId,
        status: "completed",
        duration: `${duration}ms`,
        result: serializedResult,
      });

      return result;
    } catch (error) {
      // Safely serialize args for error logging
      const serializedArgs = safeSerialize(args);

      // Log error to production logger
      logger.error(`Action failed: ${actionName}`, error, {
        action: actionName,
        correlationId,
        statusCode: 500,
      });

      // Log error to dev logger (dev only - devLogger checks NODE_ENV internally)
      devLogger.error(`Action failed: ${actionName}`, error, {
        userId,
        correlationId,
        action: actionName,
        args: serializedArgs,
      });

      // Re-throw the error so the client can handle it
      throw error;
    }
  };
}
