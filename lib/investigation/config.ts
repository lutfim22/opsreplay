export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_TIMEOUT_MS = 25_000;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 10;

export interface InvestigationConfig {
  /** Explicit server-side opt-in; credentials alone never enable investigation. */
  enabled: boolean;
  /** Undefined when GEMINI_API_KEY is not set. */
  apiKey: string | undefined;
  model: string;
  timeoutMs: number;
  rateLimitPerMinute: number;
  quota: { url: string; token: string } | undefined;
  localBypass: boolean;
  vercel: boolean;
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
    enabled: env.INVESTIGATE_ENABLED === "1",
    apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    model: model && MODEL_PATTERN.test(model) ? model : DEFAULT_GEMINI_MODEL,
    timeoutMs: positiveInt(env.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 55_000),
    rateLimitPerMinute: positiveInt(env.INVESTIGATE_RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT_PER_MINUTE, 600),
    quota: env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN && /^https:\/\/[^/]+\/?$/.test(env.UPSTASH_REDIS_REST_URL)
      ? { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN } : undefined,
    localBypass: env.NODE_ENV !== "production" && env.INVESTIGATE_LOCAL_DEV_BYPASS === "1",
    vercel: env.VERCEL === "1",
  };
}
