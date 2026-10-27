import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { InvestigationError } from "@/lib/investigation/errors";

export interface QuotaConfig { url: string; token: string }

// Redis TIME supplies UTC boundaries; every check, increment and lease is atomic.
export const RESERVE_SCRIPT = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local day = math.floor(now / 86400000)
local minute = math.floor(now / 60000)
local de = (day + 1) * 86400000
local me = (minute + 1) * 60000
local g = KEYS[1] .. day
local m = KEYS[2] .. minute
local d = KEYS[3] .. day
local a = KEYS[4]
redis.call('ZREMRANGEBYSCORE', a, '-inf', now)
if tonumber(redis.call('GET', g) or '0') >= 100 then return {0, math.ceil((de-now)/1000)} end
if tonumber(redis.call('GET', m) or '0') >= 5 then return {0, math.ceil((me-now)/1000)} end
if tonumber(redis.call('GET', d) or '0') >= 15 then return {0, math.ceil((de-now)/1000)} end
if redis.call('ZCARD', a) >= 3 then return {0, 1} end
redis.call('INCR', g)
redis.call('PEXPIREAT', g, de)
redis.call('INCR', m)
redis.call('PEXPIREAT', m, me)
redis.call('INCR', d)
redis.call('PEXPIREAT', d, de)
redis.call('ZADD', a, now + 60000, ARGV[1])
redis.call('PEXPIRE', a, 60000)
return {1, 0}
`;

/** Use the proxy-provided address only on the direct Vercel deployment boundary. */
export function vercelClientKey(headers: Headers, vercel: boolean): string {
  if (!vercel) return "anonymous";
  const ip = headers.get("x-forwarded-for")?.trim();
  if (!ip || ip.includes(",") || !isIP(ip)) return "anonymous";
  return createHash("sha256").update(ip).digest("hex");
}

async function command(config: QuotaConfig, args: unknown[], fetcher: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetcher(config.url, { method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" }, body: JSON.stringify(args), signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("quota service error");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("result" in body)) throw new Error("quota service response error");
    return body.result;
  } finally { clearTimeout(timer); }
}

/** The allowance stays spent if Gemini fails; retries can still incur provider usage. */
export async function reserveQuota(config: QuotaConfig, client: string, fetcher: typeof fetch = fetch): Promise<() => Promise<void>> {
  const lease = randomUUID();
  const prefix = "opsreplay:investigate:v1:";
  const active = `${prefix}active`;
  try {
    const result = await command(config, ["EVAL", RESERVE_SCRIPT, 4, `${prefix}global:`, `${prefix}client:${client}:minute:`, `${prefix}client:${client}:day:`, active, lease], fetcher);
    if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0]) || !Number.isInteger(result[1])) throw new Error("invalid quota result");
    if (result[0] === 0) throw new InvestigationError("rate_limited", { retryAfterSeconds: Math.max(1, result[1]) });
    return async () => { try { await command(config, ["ZREM", active, lease], fetcher); } catch { /* lease expires in 60 seconds */ } };
  } catch (error) {
    if (error instanceof InvestigationError) throw error;
    throw new InvestigationError("quota_unavailable");
  }
}
