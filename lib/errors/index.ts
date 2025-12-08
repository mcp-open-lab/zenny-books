export class DomainError extends Error {
  public readonly code: string;
  public readonly userMessage?: string;

  constructor(code: string, message: string, userMessage?: string) {
    super(message);
    this.code = code;
    this.userMessage = userMessage;
  }
}

export class DuplicateFileError extends DomainError {
  constructor(message = "Duplicate file detected", userMessage?: string) {
    super("DUPLICATE_FILE", message, userMessage);
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Validation failed", userMessage?: string) {
    super("VALIDATION_ERROR", message, userMessage);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized", userMessage?: string) {
    super("UNAUTHORIZED", message, userMessage);
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return error.userMessage ?? "Something went wrong. Please try again.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error. Please try again.";
}
