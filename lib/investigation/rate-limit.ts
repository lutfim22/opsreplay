export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const MAX_TRACKED_CLIENTS = 5000;

/**
 * Fixed-window in-memory limiter. It is best-effort: each serverless instance keeps its own
 * counters, so the effective limit scales with the number of warm instances. Use a shared store
 * (and an edge/WAF rule) if stricter guarantees are needed.
 */
export function createRateLimiter(limit: number, windowMs = 60_000, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();

  function prune(time: number) {
    for (const [key, entry] of windows) if (time - entry.start >= windowMs) windows.delete(key);
    // Still full of live windows: evict the oldest so memory stays bounded.
    while (windows.size >= MAX_TRACKED_CLIENTS) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) break;
      windows.delete(oldest);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const time = now();
      let entry = windows.get(key);
      if (!entry || time - entry.start >= windowMs) {
        if (!entry && windows.size >= MAX_TRACKED_CLIENTS) prune(time);
        entry = { start: time, count: 0 };
        windows.set(key, entry);
      }
      entry.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.start + windowMs - time) / 1000));
      return { allowed: entry.count <= limit, retryAfterSeconds };
    },
  };
}

/**
 * Client key from proxy headers. On Vercel x-forwarded-for / x-real-ip are set by the platform;
 * elsewhere they can be spoofed unless a trusted proxy overwrites them.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || headers.get("x-real-ip")?.trim() || "unknown").slice(0, 100);
}
