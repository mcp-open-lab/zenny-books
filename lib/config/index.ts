const FIVE_MINUTES_MS = 5 * 60 * 1000;

function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  return value ?? fallback;
}

export const appConfig = {
  db: {
    timeoutMs: Number(getEnv("DB_TIMEOUT_MS", String(FIVE_MINUTES_MS))),
  },
  ai: {
    model: getEnv("GEMINI_MODEL", "gemini-2.0-flash-exp") as string,
  },
  upload: {
    maxFileSizeMb: Number(getEnv("UPLOAD_MAX_FILE_SIZE_MB", "16")),
  },
};


