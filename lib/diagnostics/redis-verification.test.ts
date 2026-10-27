import { describe, expect, it, vi } from "vitest";
import { RESERVE_SCRIPT } from "@/lib/investigation/quota";
import { checkRedisResult } from "@/scripts/check-redis-result";
import { REDIS_CHECKS, REDIS_HTTP_LIMIT, REDIS_TARGET_SHA, redisVerificationConfig } from "@/scripts/redis-verification-contract";
import { CLAIM_SCRIPT, CLEAN_SCRIPT, FIXTURE_SCRIPT, INSPECT_SCRIPT, REDIS_LOCK, REDIS_MANIFEST, runRedisVerification } from "@/scripts/verify-redis-integration";

const controlSha = "a".repeat(40);
const environment = {
  REDIS_VERIFICATION_AUTHORIZED: "1", TARGET_SHA: REDIS_TARGET_SHA, APPROVED_TARGET_SHA: REDIS_TARGET_SHA,
  CONTROL_SHA: controlSha, APPROVED_CONTROL_SHA: controlSha, APPROVAL_ISSUE: "14",
  REDIS_DATABASE_HOST: "offline-fixture.upstash.io", APPROVED_REDIS_HOST: "offline-fixture.upstash.io",
  REDIS_ISOLATED_DATABASE: "1", REDIS_VERIFICATION_REST_URL: "https://offline-fixture.upstash.io",
  REDIS_VERIFICATION_REST_TOKEN: "PRIVATE_TEST_TOKEN",
};

/** In-memory REST/Redis model for orchestration assertions, NOT a Lua interpreter or live evidence. */
function fixture(options: { nonempty?: boolean; lostLock?: boolean; skipRelease?: boolean; boundary?: boolean; brokenConcurrency?: boolean; cleanupFails?: boolean; finalCleanupFails?: boolean } = {}) {
  const state = { claimed: false, global: 0, minute: 0, day: 0, active: new Set<string>(), expired: false, mode: "", cleaned: false };
  const calls: unknown[][] = [];
  const fetcher = vi.fn(async (url: unknown, init: RequestInit = {}) => {
    expect(url).toBe(environment.REDIS_VERIFICATION_REST_URL);
    expect(init.redirect).toBe("error");
    expect(init.headers).toMatchObject({ Authorization: "Bearer PRIVATE_TEST_TOKEN" });
    const args = JSON.parse(String(init.body)) as unknown[];
    calls.push(args);
    let result: unknown;
    if (args[0] === "EVAL" && args[1] === CLAIM_SCRIPT) {
      state.claimed = !options.nonempty;
      result = state.claimed ? 1 : 0;
    } else if (args[0] === "EVAL" && args[1] === CLEAN_SCRIPT) {
      if (options.cleanupFails || (options.finalCleanupFails && args.at(-1) === "finish")) result = -1;
      else { state.active.clear(); state.global = 0; state.minute = 0; state.day = 0; state.expired = false;
        state.cleaned = args.at(-1) === "finish"; result = 1; }
    } else if (args[0] === "EVAL" && args[1] === FIXTURE_SCRIPT) {
      state.mode = String(args.at(-1));
      if (options.lostLock) result = [-1];
      else {
        state.minute = state.mode === "client_minute" ? 4 : 0;
        state.day = state.mode === "client_day" ? 14 : 0;
        state.global = state.mode === "global_day" ? 99 : 0;
        state.expired = state.mode === "expired_lease_pruning";
        if (state.expired) state.active = new Set(["expired-1", "expired-2", "expired-3"]);
        result = [123, 456];
      }
    } else if (args[0] === "EVAL" && args[1] === INSPECT_SCRIPT) {
      result = options.boundary ? [-2] : [1, state.global, state.minute, state.day, state.active.size, state.active.size ? 59_000 : -2];
    } else if (args[0] === "EVAL" && args[1] === RESERVE_SCRIPT) {
      expect(args).toHaveLength(8);
      if (state.expired) { state.active.clear(); state.expired = false; }
      if (state.global >= 100) result = [0, 3600];
      else if (state.minute >= 5) result = [0, 30];
      else if (state.day >= 15) result = [0, 3600];
      else if (state.active.size >= 3 && !options.brokenConcurrency) result = [0, 1];
      else { state.global += 1; state.minute += 1; state.day += 1; state.active.add(String(args[7])); result = [1, 0]; }
    } else if (args[0] === "ZREM") {
      result = options.skipRelease ? 0 : Number(state.active.delete(String(args[2])));
    } else throw new Error("Unexpected offline command.");
    return new Response(JSON.stringify({ result }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetcher, calls, state };
}

describe("isolated Redis verification preparation", () => {
  it("exercises the real reservation/release adapter and all bounded scenarios through an injected transport", async () => {
    const fake = fixture();
    const summary = await runRedisVerification(redisVerificationConfig(environment), fake.fetcher);
    expect(summary).toMatchObject({ outcome: "success", category: "success", checks: [...REDIS_CHECKS],
      cleanup: "passed", applicationAttempts: 16, httpRequests: 43 });
    expect(fake.state.cleaned).toBe(true);
    expect(fake.calls.filter((args) => args[0] === "EVAL" && args[1] === RESERVE_SCRIPT)).toHaveLength(16);
    expect(fake.calls.filter((args) => args[0] === "ZREM")).toHaveLength(8);
    expect(fake.calls.length).toBeLessThanOrEqual(REDIS_HTTP_LIMIT);
    expect(checkRedisResult(JSON.stringify(summary), controlSha)).toEqual(summary);
    expect(JSON.stringify(summary)).not.toMatch(/PRIVATE_TEST_TOKEN|upstash\.io|redis-check-|expired-/);
  });

  it("does not mutate or clean a nonempty database", async () => {
    const fake = fixture({ nonempty: true });
    const summary = await runRedisVerification(redisVerificationConfig(environment), fake.fetcher);
    expect(summary).toMatchObject({ outcome: "failure", category: "database_not_empty", cleanup: "not_started", httpRequests: 1, applicationAttempts: 0, checks: [] });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.[1]).toBe(CLAIM_SCRIPT);
    expect(CLAIM_SCRIPT.indexOf("DBSIZE")).toBeLessThan(CLAIM_SCRIPT.indexOf("'SET'"));
    expect(checkRedisResult(JSON.stringify(summary), controlSha)).toEqual(summary);
  });

  it.each([
    ["lost ownership", { lostLock: true }, "ownership_lost"],
    ["swallowed release error", { skipRelease: true }, "assertion_failed"],
    ["UTC bucket changed", { boundary: true }, "clock_boundary"],
    ["broken concurrency cap", { brokenConcurrency: true }, "assertion_failed"],
    ["cleanup ownership failure", { cleanupFails: true }, "ownership_lost"],
  ] as const)("stops on %s and never reports success", async (_name, options, category) => {
    const fake = fixture(options);
    const summary = await runRedisVerification(redisVerificationConfig(environment), fake.fetcher);
    expect(summary.outcome).toBe("failure");
    expect(summary.category).toBe(category);
    expect(summary.checks.length).toBeLessThan(REDIS_CHECKS.length);
    expect(fake.calls.at(-1)?.[1]).toBe(CLEAN_SCRIPT);
    expect(fake.calls.length).toBeLessThanOrEqual(REDIS_HTTP_LIMIT);
  });

  it("settles parallel requests before cleanup and stops new scenario traffic after a transport error", async () => {
    const fake = fixture();
    let pending = 0;
    const fetcher = vi.fn(async (url: unknown, init: RequestInit = {}) => {
      const args = JSON.parse(String(init.body)) as unknown[];
      if (args[1] === RESERVE_SCRIPT) {
        pending += 1;
        await Promise.resolve();
        pending -= 1;
        return new Response("PRIVATE_TEST_TOKEN", { status: 503 });
      }
      if (args[1] === CLEAN_SCRIPT) expect(pending).toBe(0);
      return fake.fetcher(url as string, init);
    }) as unknown as typeof fetch;
    const summary = await runRedisVerification(redisVerificationConfig(environment), fetcher);
    expect(summary).toMatchObject({ outcome: "failure", category: "request_failed", checks: [], cleanup: "passed", applicationAttempts: 8 });
    expect(fake.calls.filter((args) => args[1] === FIXTURE_SCRIPT)).toHaveLength(1);
    expect(JSON.stringify(summary)).not.toContain("PRIVATE_TEST_TOKEN");
  });

  it("does not report a successful run if final cleanup fails after all checks passed", async () => {
    const fake = fixture({ finalCleanupFails: true });
    const summary = await runRedisVerification(redisVerificationConfig(environment), fake.fetcher);
    expect(summary).toMatchObject({ outcome: "failure", category: "cleanup_failed", checks: [...REDIS_CHECKS], cleanup: "failed" });
    expect(checkRedisResult(JSON.stringify(summary), controlSha)).toEqual(summary);
  });

  it("enforces a two-second request deadline without retries even when a transport ignores abort", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn(() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;
      const pending = runRedisVerification(redisVerificationConfig(environment), fetcher);
      await vi.advanceTimersByTimeAsync(2001);
      expect(await pending).toMatchObject({ outcome: "failure", category: "request_failed", httpRequests: 1, applicationAttempts: 0, cleanup: "not_started" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it("rejects REST errors or malformed replies without leaking their content", async () => {
    for (const response of [new Response("PRIVATE_TEST_TOKEN", { status: 401 }),
      new Response("not-json"), new Response(JSON.stringify({ error: "PRIVATE_TEST_TOKEN" })),
      new Response(JSON.stringify({ result: 1, error: "PRIVATE_TEST_TOKEN" }))]) {
      const fetcher = vi.fn(async () => response) as unknown as typeof fetch;
      const summary = await runRedisVerification(redisVerificationConfig(environment), fetcher);
      expect(summary).toMatchObject({ outcome: "failure", category: "request_failed", cleanup: "not_started", httpRequests: 1 });
      expect(JSON.stringify(summary)).not.toContain("PRIVATE_TEST_TOKEN");
    }
  });

  it("only claims/cleans owned, registered keys and keeps cleanup loops bounded", () => {
    expect(CLEAN_SCRIPT.indexOf("redis.call('GET', KEYS[1])")).toBeLessThan(CLEAN_SCRIPT.indexOf("redis.call('DEL'"));
    expect(CLEAN_SCRIPT).toContain("#keys > 16");
    expect(CLEAN_SCRIPT).toContain("redis.call('DEL', unpack(keys))");
    expect(CLEAN_SCRIPT).toContain("redis.call('DBSIZE') ~= 1");
    expect(CLEAN_SCRIPT).not.toMatch(/FLUSH|SCAN|KEYS\(/);
    expect(REDIS_LOCK).not.toContain("investigate:v1");
    expect(REDIS_MANIFEST).not.toContain("investigate:v1");
  });

  it.each([
    { REDIS_VERIFICATION_AUTHORIZED: "" }, { TARGET_SHA: "main" }, { APPROVED_TARGET_SHA: "" },
    { CONTROL_SHA: "main", APPROVED_CONTROL_SHA: "main" }, { APPROVED_CONTROL_SHA: "b".repeat(40) },
    { REDIS_ISOLATED_DATABASE: "0" }, { APPROVED_REDIS_HOST: "another.upstash.io" },
    { REDIS_DATABASE_HOST: "evil.example", APPROVED_REDIS_HOST: "evil.example" },
    { REDIS_VERIFICATION_REST_URL: "http://offline-fixture.upstash.io" },
    { REDIS_VERIFICATION_REST_URL: "https://offline-fixture.upstash.io/path" },
    { REDIS_VERIFICATION_REST_URL: "https://offline-fixture.upstash.io/?token=secret" },
    { REDIS_VERIFICATION_REST_URL: "https://user:secret@offline-fixture.upstash.io" },
    { REDIS_VERIFICATION_REST_URL: "https://offline-fixture.upstash.io:443" },
    { REDIS_VERIFICATION_REST_URL: "https://other.upstash.io" },
    { REDIS_VERIFICATION_REST_TOKEN: "", UPSTASH_REDIS_REST_TOKEN: "legacy" },
    { REDIS_VERIFICATION_REST_TOKEN: " PRIVATE_TEST_TOKEN" }, { APPROVAL_ISSUE: "0" },
  ])("rejects invalid live configuration before any transport is constructed: %j", (override) => {
    expect(() => redisVerificationConfig({ ...environment, ...override })).toThrow();
  });

  it("strictly validates summaries rather than trusting process success or unrecognized output", async () => {
    const fake = fixture();
    const summary = await runRedisVerification(redisVerificationConfig(environment), fake.fetcher);
    for (const override of [
      { leakedToken: "PRIVATE_TEST_TOKEN" }, { targetSha: "b".repeat(40) }, { controlSha: "b".repeat(40) },
      { checks: [] }, { checks: [...REDIS_CHECKS].reverse() }, { cleanup: "failed" }, { httpRequests: 65 },
      { httpRequests: 0 }, { httpRequests: 42 }, { applicationAttempts: 15 }, { outcome: "failure", category: "success" },
    ]) expect(() => checkRedisResult(JSON.stringify({ ...summary, ...override }), controlSha)).toThrow();
    expect(() => checkRedisResult(`${JSON.stringify(summary)}\n${JSON.stringify(summary)}`, controlSha)).toThrow();
    expect(() => checkRedisResult("x".repeat(4097), controlSha)).toThrow();
  });
});
