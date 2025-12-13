function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  return value ?? fallback;
}

export const appConfig = {
  ai: {
    model: getEnv("GEMINI_MODEL", "gemini-2.0-flash-exp") as string,
  },
  upload: {
    maxFileSizeMb: Number(getEnv("UPLOAD_MAX_FILE_SIZE_MB", "16")),
  },
};


