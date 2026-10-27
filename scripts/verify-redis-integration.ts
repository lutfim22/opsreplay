import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { reserveQuota, RESERVE_SCRIPT } from "@/lib/investigation/quota";
import { InvestigationError } from "@/lib/investigation/errors";
import { REDIS_CHECKS, REDIS_DEADLINE_MS, REDIS_HTTP_LIMIT, REDIS_TARGET_SHA, redisVerificationConfig } from "@/scripts/redis-verification-contract";
import type { RedisSummary } from "@/scripts/redis-verification-contract";

const PREFIX = "opsreplay:investigate:v1:";
export const REDIS_LOCK = "opsreplay:redis-verification:lock";
export const REDIS_MANIFEST = "opsreplay:redis-verification:keys";

// Only an empty dedicated database may be claimed. Never flush or clear existing data.
export const CLAIM_SCRIPT = `
if redis.call('DBSIZE') ~= 0 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PX', 120000, 'NX')
return 1
`;

// Record only exact possible test keys, including the next 90 seconds of UTC buckets.
// Seed just below each limit instead of consuming a full day's allowance with traffic.
export const FIXTURE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return {-1} end
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local day = math.floor(now / 86400000)
local minute = math.floor(now / 60000)
for d = day, math.floor((now + 90000) / 86400000) do
  redis.call('SADD', KEYS[2], ARGV[2] .. 'global:' .. d, ARGV[3] .. 'day:' .. d)
end
for m = minute, math.floor((now + 90000) / 60000) do
  redis.call('SADD', KEYS[2], ARGV[3] .. 'minute:' .. m)
end
redis.call('SADD', KEYS[2], ARGV[2] .. 'active')
redis.call('PEXPIRE', KEYS[2], 120000)
if ARGV[4] == 'client_minute' then redis.call('SET', ARGV[3] .. 'minute:' .. minute, 4, 'PX', 120000) end
if ARGV[4] == 'client_day' then redis.call('SET', ARGV[3] .. 'day:' .. day, 14, 'PX', 120000) end
if ARGV[4] == 'global_day' then redis.call('SET', ARGV[2] .. 'global:' .. day, 99, 'PX', 120000) end
if ARGV[4] == 'expired_lease_pruning' then
  redis.call('ZADD', ARGV[2] .. 'active', now - 1, 'expired-1', now - 1, 'expired-2', now - 1, 'expired-3')
  redis.call('PEXPIRE', ARGV[2] .. 'active', 60000)
end
return {day, minute}
`;

export const INSPECT_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return {-1} end
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local day = math.floor(now / 86400000)
local minute = math.floor(now / 60000)
if day ~= tonumber(ARGV[4]) or minute ~= tonumber(ARGV[5]) then return {-2} end
return {1,
  tonumber(redis.call('GET', ARGV[2] .. 'global:' .. day) or '0'),
  tonumber(redis.call('GET', ARGV[3] .. 'minute:' .. minute) or '0'),
  tonumber(redis.call('GET', ARGV[3] .. 'day:' .. day) or '0'),
  redis.call('ZCARD', ARGV[2] .. 'active'), redis.call('PTTL', ARGV[2] .. 'active')}
`;

// Ownership and exact-key validation happen before deletion. Unexpected keys stay untouched.
export const CLEAN_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return -1 end
local keys = redis.call('SMEMBERS', KEYS[2])
if #keys > 16 then return -1 end
for _, key in ipairs(keys) do
  local suffix = string.sub(key, string.len(ARGV[3]) + 1)
  local client = string.sub(key, 1, string.len(ARGV[3])) == ARGV[3]
    and (string.match(suffix, '^minute:%d+$') or string.match(suffix, '^day:%d+$'))
  if key ~= ARGV[2] .. 'active' and not string.match(key, '^opsreplay:investigate:v1:global:%d+$') and not client then return -1 end
end
if #keys > 0 then redis.call('DEL', unpack(keys)) end
redis.call('DEL', KEYS[2])
if redis.call('DBSIZE') ~= 1 then return -1 end
if ARGV[4] == 'finish' then
  redis.call('DEL', KEYS[1])
  return redis.call('DBSIZE') == 0 and 1 or -1
end
return 1
`;

class ProbeError extends Error {
  constructor(readonly category: Exclude<RedisSummary["category"], "success">) { super(category); }
}
function assert(condition: unknown): asserts condition {
  if (!condition) throw new ProbeError("assertion_failed");
}

/** Injectable transport for offline tests. Importing this module never contacts a service. */
export async function runRedisVerification(
  config: ReturnType<typeof redisVerificationConfig>,
  fetcher: typeof fetch = fetch,
): Promise<RedisSummary> {
  const startedAt = performance.now();
  const runId = randomUUID();
  const client = `redis-check-${runId}`;
  const clientPrefix = `${PREFIX}client:${client}:`;
  let httpRequests = 0;
  let applicationAttempts = 0;
  let acquired = false;
  let transportFailed = false;
  const checks: RedisSummary["checks"] = [];
  let cleanup: RedisSummary["cleanup"] = "not_started";
  let category: RedisSummary["category"] = "success";

  async function command(args: unknown[], finalCleanup = false, parentSignal?: AbortSignal | null): Promise<unknown> {
    // Reserve the final HTTP slot for cleanup, even if the main budget is exhausted.
    if (httpRequests >= REDIS_HTTP_LIMIT - (finalCleanup ? 0 : 1)) throw new ProbeError("operation_limit");
    if (!finalCleanup && (transportFailed || performance.now() - startedAt >= REDIS_DEADLINE_MS)) throw new ProbeError("request_failed");
    httpRequests += 1;
    const controller = new AbortController();
    const abort = () => controller.abort();
    parentSignal?.addEventListener("abort", abort, { once: true });
    if (parentSignal?.aborted) abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const requestTimeout = finalCleanup ? 2000 : Math.min(2000, Math.max(1, REDIS_DEADLINE_MS - (performance.now() - startedAt)));
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ProbeError("request_failed")); }, requestTimeout);
    });
    try {
      const response = await Promise.race([
        fetcher(config.url, { method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
          headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }),
        deadline,
      ]);
      if (!response.ok) throw new ProbeError("request_failed");
      const body: unknown = await Promise.race([response.json(), deadline]);
      if (!body || typeof body !== "object" || !("result" in body) || "error" in body) throw new ProbeError("request_failed");
      return body.result;
    } catch {
      transportFailed = true;
      throw new ProbeError("request_failed");
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", abort);
    }
  }

  const evalOwned = (script: string, args: unknown[], finish = false) =>
    command(["EVAL", script, 2, REDIS_LOCK, REDIS_MANIFEST, runId, ...args], finish);
  const clear = async (finish = false) => {
    const result = await evalOwned(CLEAN_SCRIPT, [PREFIX, clientPrefix, finish ? "finish" : "reset"], finish);
    if (result !== 1) throw new ProbeError("ownership_lost");
  };
  const fixture = async (name: typeof REDIS_CHECKS[number]) => {
    const result = await evalOwned(FIXTURE_SCRIPT, [PREFIX, clientPrefix, name]);
    if (Array.isArray(result) && result[0] === -1) throw new ProbeError("ownership_lost");
    assert(Array.isArray(result) && result.length === 2 && result.every(Number.isInteger));
    return result as number[];
  };
  const inspect = async (bucket: number[]) => {
    const result = await evalOwned(INSPECT_SCRIPT, [PREFIX, clientPrefix, ...bucket]);
    if (Array.isArray(result) && result[0] === -1) throw new ProbeError("ownership_lost");
    if (Array.isArray(result) && result[0] === -2) throw new ProbeError("clock_boundary");
    assert(Array.isArray(result) && result.length === 6 && result[0] === 1 && result.every(Number.isInteger));
    return result as number[];
  };
  const appFetch = (async (url: unknown, init: RequestInit = {}) => {
    assert(url === config.url && init.method === "POST");
    const args: unknown = JSON.parse(String(init.body));
    assert(Array.isArray(args));
    if (args[0] === "EVAL") {
      assert(args.length === 8 && args[1] === RESERVE_SCRIPT && args[2] === 4 &&
        args[3] === `${PREFIX}global:` && args[4] === `${clientPrefix}minute:` &&
        args[5] === `${clientPrefix}day:` && args[6] === `${PREFIX}active` && typeof args[7] === "string");
      // reserveQuota supplies four keys followed by one UUID argument (index 7).
    } else assert(args.length === 3 && args[0] === "ZREM" && args[1] === `${PREFIX}active`);
    const result = await command(args, false, init.signal);
    return new Response(JSON.stringify({ result }), { status: 200 });
  }) as typeof fetch;
  const reserve = async () => {
    assert(applicationAttempts < 16);
    applicationAttempts += 1;
    return reserveQuota(config, client, appFetch);
  };
  const deny = async (maxWait: number) => {
    let error: unknown;
    try { const release = await reserve(); await release(); } catch (caught) { error = caught; }
    assert(error instanceof InvestigationError && error.kind === "rate_limited" &&
      Number.isInteger(error.retryAfterSeconds) && error.retryAfterSeconds! >= 1 && error.retryAfterSeconds! <= maxWait);
  };

  try {
    const claimed = await command(["EVAL", CLAIM_SCRIPT, 1, REDIS_LOCK, runId]);
    if (claimed === 0) throw new ProbeError("database_not_empty");
    assert(claimed === 1);
    acquired = true;

    let bucket = await fixture(REDIS_CHECKS[0]);
    const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => reserve()));
    const releases: Array<() => Promise<void>> = [];
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") releases.push(outcome.value);
      else assert(outcome.reason instanceof InvestigationError && outcome.reason.kind === "rate_limited" && outcome.reason.retryAfterSeconds === 1);
    }
    assert(releases.length === 3);
    let state = await inspect(bucket);
    assert(state[1] === 3 && state[2] === 3 && state[3] === 3 && state[4] === 3 && state[5]! > 0 && state[5]! <= 60_000);
    await Promise.all(releases.map((release) => release()));
    state = await inspect(bucket);
    assert(state[4] === 0);
    await (await reserve())();
    state = await inspect(bucket);
    assert(state[1] === 4 && state[2] === 4 && state[3] === 4 && state[4] === 0);
    checks.push(REDIS_CHECKS[0]);

    for (const [name, maxWait, expected] of [
      [REDIS_CHECKS[1], 60, [1, 5, 1]],
      [REDIS_CHECKS[2], 86400, [1, 1, 15]],
      [REDIS_CHECKS[3], 86400, [100, 1, 1]],
    ] as const) {
      await clear();
      bucket = await fixture(name);
      await (await reserve())();
      await deny(maxWait);
      state = await inspect(bucket);
      assert(expected.every((count, index) => state[index + 1] === count) && state[4] === 0);
      checks.push(name);
    }

    await clear();
    bucket = await fixture(REDIS_CHECKS[4]);
    const release = await reserve();
    state = await inspect(bucket);
    assert(state[4] === 1 && state[5]! > 0 && state[5]! <= 60_000);
    await release();
    assert((await inspect(bucket))[4] === 0);
    checks.push(REDIS_CHECKS[4]);
  } catch (error) {
    category = transportFailed ? "request_failed" : error instanceof ProbeError ? error.category : "assertion_failed";
  } finally {
    if (acquired) {
      try { await clear(true); cleanup = "passed"; }
      catch { cleanup = "failed"; if (category === "success") category = "cleanup_failed"; }
    }
  }
  return { probe: "isolated_redis_quota", targetSha: REDIS_TARGET_SHA, controlSha: config.controlSha,
    outcome: category === "success" ? "success" : "failure", category, checks, cleanup, httpRequests,
    applicationAttempts, durationMs: performance.now() - startedAt };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    const summary = await runRedisVerification(redisVerificationConfig(process.env));
    console.log(JSON.stringify(summary));
    if (summary.outcome !== "success") process.exitCode = 1;
  })().catch(() => {
    console.error("Redis verification stopped; private details withheld.");
    process.exitCode = 1;
  });
}
