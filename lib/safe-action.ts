import { auth } from "@clerk/nextjs/server";
import { devLogger } from "@/lib/dev-logger";
import { logger } from "@/lib/logger";
import { safeSerialize } from "@/lib/safe-serializer";
import { createId } from "@paralleldrive/cuid2";

type ActionHandler<TArgs extends any[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

type AuthenticatedHandler<TArgs extends any[], TResult> = (
  userId: string,
  ...args: TArgs
) => Promise<TResult>;

interface PublicActionOptions {
  /**
   * Whether to require authentication. If false, skips auth() call entirely.
   * Default: false (public action, no auth required)
   */
  requireAuth?: boolean;
  /**
   * Optional function to get userId. If provided, skips auth() call.
   * Useful for public actions that optionally log userId if available.
   */
  getUserId?: () => Promise<string | undefined>;
}

/**
 * Creates an authenticated server action that automatically handles auth and logging.
 * The handler receives userId as the first argument - no need to call auth() manually.
 *
 * @example
 * export const getReceipts = createAuthenticatedAction(
 *   "getReceipts",
 *   async (userId, filters: { limit?: number }) => {
 *     return db.select().from(receipts).where(eq(receipts.userId, userId));
 *   }
 * );
 */
export function createAuthenticatedAction<TArgs extends any[], TResult>(
  actionName: string,
  handler: AuthenticatedHandler<TArgs, TResult>
): ActionHandler<TArgs, TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const correlationId = createId();

    const { userId } = await auth();
    if (!userId) {
      logger.error(`Action unauthorized: ${actionName}`, null, {
        action: actionName,
        correlationId,
        statusCode: 401,
      });
      throw new Error("Unauthorized");
    }

    try {
      const serializedArgs = safeSerialize(args);

      devLogger.action(actionName, {
        userId,
        correlationId,
        status: "started",
        args: serializedArgs,
      });

      const startTime = Date.now();
      const result = await handler(userId, ...args);
      const duration = Date.now() - startTime;

      const serializedResult = safeSerialize(result);

      devLogger.action(actionName, {
        userId,
        correlationId,
        status: "completed",
        duration: `${duration}ms`,
        result: serializedResult,
      });

      return result;
    } catch (error) {
      const serializedArgs = safeSerialize(args);

      logger.error(`Action failed: ${actionName}`, error, {
        action: actionName,
        correlationId,
        statusCode: 500,
      });

      devLogger.error(`Action failed: ${actionName}`, error, {
        userId,
        correlationId,
        action: actionName,
        args: serializedArgs,
      });

      throw error;
    }
  };
}

/**
 * Creates a public server action that doesn't require authentication.
 * Use this for actions that should be accessible without login.
 *
 * @example
 * export const getPublicData = createPublicAction(
 *   "getPublicData",
 *   async () => {
 *     return { data: "public" };
 *   },
 *   { requireAuth: false }
 * );
 */
export function createPublicAction<TArgs extends any[], TResult>(
  actionName: string,
  handler: ActionHandler<TArgs, TResult>,
  options: PublicActionOptions = {}
): ActionHandler<TArgs, TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const correlationId = createId();
    let userId: string | undefined;

    try {
      if (options.getUserId) {
        userId = await options.getUserId();
      } else if (options.requireAuth !== false) {
        try {
          const authResult = await auth();
          userId = authResult.userId || undefined;
        } catch (_e) {
          // Ignore auth errors for logging context
        }
      }

      const serializedArgs = safeSerialize(args);

      devLogger.action(actionName, {
        userId,
        correlationId,
        status: "started",
        args: serializedArgs,
      });

      const startTime = Date.now();
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      const serializedResult = safeSerialize(result);

      devLogger.action(actionName, {
        userId,
        correlationId,
        status: "completed",
        duration: `${duration}ms`,
        result: serializedResult,
      });

      return result;
    } catch (error) {
      const serializedArgs = safeSerialize(args);

      logger.error(`Action failed: ${actionName}`, error, {
        action: actionName,
        correlationId,
        statusCode: 500,
      });

      devLogger.error(`Action failed: ${actionName}`, error, {
        userId,
        correlationId,
        action: actionName,
        args: serializedArgs,
      });

      throw error;
    }
  };
}
