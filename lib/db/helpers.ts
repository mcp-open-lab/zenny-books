import { appConfig } from "@/lib/config";
import { UnauthorizedError } from "@/lib/errors";

const DEFAULT_TIMEOUT_MS = appConfig.db.timeoutMs;

export async function withDbTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("Database operation timed out"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

export function assertUserScope(userId?: string): string {
  if (!userId) {
    throw new UnauthorizedError("User scope is required");
  }
  return userId;
}


