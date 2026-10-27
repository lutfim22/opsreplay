import { z } from "zod";

export const REDIS_TARGET_SHA = "6b3e5996f1aded1b07cf2043e58e5c8e1115e798";
export const REDIS_HTTP_LIMIT = 64;
export const REDIS_DEADLINE_MS = 90_000;
export const REDIS_CHECKS = ["concurrency_and_release", "client_minute", "client_day", "global_day", "expired_lease_pruning"] as const;
export const REDIS_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.upstash\.io$/;

export const redisSummarySchema = z.object({
  probe: z.literal("isolated_redis_quota"),
  targetSha: z.literal(REDIS_TARGET_SHA),
  controlSha: z.string().regex(/^[a-f0-9]{40}$/),
  outcome: z.enum(["success", "failure"]),
  category: z.enum(["success", "database_not_empty", "ownership_lost", "request_failed", "assertion_failed", "clock_boundary", "operation_limit", "cleanup_failed"]),
  checks: z.array(z.enum(REDIS_CHECKS)).max(REDIS_CHECKS.length),
  cleanup: z.enum(["passed", "failed", "not_started"]),
  httpRequests: z.number().int().min(0).max(REDIS_HTTP_LIMIT),
  applicationAttempts: z.number().int().min(0).max(16),
  durationMs: z.number().finite().nonnegative(),
}).strict();
export type RedisSummary = z.infer<typeof redisSummarySchema>;

/** No runtime/legacy credential fallback, arbitrary endpoints or implicit live permission. */
export function redisVerificationConfig(env: Record<string, string | undefined>) {
  const host = env.REDIS_DATABASE_HOST ?? "";
  const controlSha = env.CONTROL_SHA ?? "";
  const token = env.REDIS_VERIFICATION_REST_TOKEN ?? "";
  const url = env.REDIS_VERIFICATION_REST_URL ?? "";
  if (env.REDIS_VERIFICATION_AUTHORIZED !== "1" || env.TARGET_SHA !== REDIS_TARGET_SHA ||
      env.APPROVED_TARGET_SHA !== REDIS_TARGET_SHA || !/^[a-f0-9]{40}$/.test(controlSha) ||
      env.APPROVED_CONTROL_SHA !== controlSha || !/^[1-9][0-9]{0,9}$/.test(env.APPROVAL_ISSUE ?? "") ||
      env.REDIS_ISOLATED_DATABASE !== "1" || !REDIS_HOST_PATTERN.test(host) || env.APPROVED_REDIS_HOST !== host ||
      !token || token.trim() !== token) throw new Error("Redis verification configuration is incomplete.");
  let endpoint: URL;
  try { endpoint = new URL(url); } catch { throw new Error("Invalid verification endpoint."); }
  if (url !== `https://${host}` && url !== `https://${host}/`) throw new Error("Invalid verification endpoint.");
  if (endpoint.hostname !== host) throw new Error("Invalid verification endpoint.");
  return { url, token, controlSha };
}
