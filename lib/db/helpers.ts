import { UnauthorizedError } from "@/lib/errors";

export function assertUserScope(userId?: string): string {
  if (!userId) {
    throw new UnauthorizedError("User scope is required");
  }
  return userId;
}
