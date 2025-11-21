# Logging Architecture

## Overview

Turbo Invoice uses a **wrapper-first logging pattern** with automatic instrumentation for all server actions. This provides consistent, structured logging with minimal developer effort.

## Quick Start

### For Server Actions

**✅ Use the wrapper (recommended):**

```typescript
import { createSafeAction } from "@/lib/safe-action";

async function myActionHandler(param: string) {
  // Your logic here - logging is automatic!
  return { success: true };
}

export const myAction = createSafeAction("myAction", myActionHandler);
```

**❌ Don't import devLogger directly in actions:**

```typescript
// ❌ Avoid this in app/actions/* files
import { devLogger } from "@/lib/dev-logger";
```

The wrapper automatically logs:

- Action start (with args, userId, correlation ID)
- Action success (with result, duration)
- Action errors (with full context)

### For Domain-Specific Logging

If you need domain-specific logging (e.g., receipt scanning milestones), use helper utilities or create domain-specific logger methods in `dev-logger.ts`.

## Environment Variables

### `LOG_LEVEL` (Development)

Controls which log levels are output in development:

- `debug` (default) - All logs
- `info` - Info, warn, error only
- `warn` - Warn and error only
- `error` - Errors only

```env
LOG_LEVEL=info
```

### `LOG_FORMAT` (Development)

Controls log output format:

- `toon` (default) - TOON format for token efficiency
- `json` - Standard JSON format

Note: TOON format automatically falls back to JSON for nested structures.

```env
LOG_FORMAT=json
```

## Architecture

### Development Logger (`dev-logger.ts`)

- **Full logging** - All levels (debug, info, warn, error)
- **TOON format** - Token-efficient encoding (auto-falls back to JSON for nested structures)
- **Safe serialization** - Handles non-serializable values, circular refs, large objects
- **Environment-aware** - Automatically disabled in production

### Production Logger (`logger.ts`)

- **Error-only** - Logs errors only
- **JSON format** - Standard JSON output
- **No sanitization** - Logs data as-is for fast iteration

### Safe Action Wrapper (`safe-action.ts`)

- **Automatic logging** - Wraps server actions with start/success/error logs
- **Correlation IDs** - Generated per action for tracing
- **Safe serialization** - Args and results are safely serialized
- **Optional auth** - Can skip auth lookup for public actions

```typescript
// Skip auth lookup for public actions
export const publicAction = createSafeAction("publicAction", handler, {
  requireAuth: false,
});

// Provide custom userId getter
export const customAction = createSafeAction("customAction", handler, {
  getUserId: async () => "custom-user-id",
});
```

## Safe Serialization

The safe serializer handles:

- **Large objects** - Truncates strings/arrays
- **Non-serializable values** - Functions, symbols, Promises, etc.
- **Circular references** - Detects and marks circular refs
- **Blobs/Streams** - Replaces with type indicators
- **Deep nesting** - Limits depth to prevent stack overflow

## Correlation IDs

Every action gets a unique correlation ID that's included in all logs. This makes it easy to trace a single action across multiple log entries.

## Best Practices

1. **Use `createSafeAction` wrapper** - Don't manually log in actions
2. **Keep domain logging minimal** - Only add domain-specific logs when necessary
3. **Use correlation IDs** - They're automatically included, use them for debugging
4. **Respect LOG_LEVEL** - Don't log debug info if LOG_LEVEL is set higher

## Testing Logging

### Option 1: Test Script

Run the standalone test script to exercise all logging features:

```bash
npm run test:logging
```

Or directly:

```bash
npx tsx scripts/test-logging.ts
```

This tests:

- Dev logger (all levels)
- Production logger (errors only)
- Safe action wrapper
- Safe serializer
- TOON format detection
- Correlation IDs

### Option 2: Test Page in App

Visit `/app/test-logging` in your browser while running `npm run dev`.

This interactive page lets you:

- Test successful actions (see start/success logs)
- Test error actions (see error logs)
- Test public actions (no auth required)
- View logs in browser console and server terminal

### Option 3: Normal App Usage

Just use the app normally! All server actions are automatically logged. Check your:

- **Browser console** - Client-side logs
- **Server terminal** - Server action logs (start, success, errors)
- **Correlation IDs** - Match logs across multiple entries

### What to Look For

When testing, verify:

1. ✅ Action start logs include: action name, args, userId, correlation ID
2. ✅ Action success logs include: duration, result, correlation ID
3. ✅ Error logs include: full context, correlation ID (same as start)
4. ✅ TOON format for simple objects, JSON for nested structures
5. ✅ Safe serialization handles large/complex data without errors
6. ✅ Production mode disables dev logging completely

## Checking Logging Pattern

Run the check script to ensure actions follow the wrapper-first pattern:

```bash
npm run check-logging
```

This will flag any direct `devLogger` imports in `app/actions/*` files.

## Performance

See `docs/LOGGING_PERFORMANCE.md` for detailed performance analysis. In summary:

- **Zero overhead in production** - Dev logging is completely disabled
- **Minimal overhead in dev** - ~1ms per action (mostly auth caching)
- **Safe serialization** - Prevents logging from blocking development
