export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_TIMEOUT_MS = 25_000;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 10;

export interface InvestigationConfig {
  /** Undefined when GEMINI_API_KEY is not set. */
  apiKey: string | undefined;
  model: string;
  timeoutMs: number;
  rateLimitPerMinute: number;
}

const MODEL_PATTERN = /^gemini-[a-z0-9][a-z0-9.-]{0,63}$/;

function positiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

/** Reads server-side configuration. A malformed model name falls back to the default. */
export function readConfig(env: Record<string, string | undefined> = process.env): InvestigationConfig {
  const model = env.GEMINI_MODEL?.trim();
  return {
    apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    model: model && MODEL_PATTERN.test(model) ? model : DEFAULT_GEMINI_MODEL,
    timeoutMs: positiveInt(env.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 55_000),
    rateLimitPerMinute: positiveInt(env.INVESTIGATE_RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT_PER_MINUTE, 600),
  };
}
