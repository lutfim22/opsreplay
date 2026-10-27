import { describe, expect, it, vi } from "vitest";
import { reserveQuota, RESERVE_SCRIPT, vercelClientKey } from "@/lib/investigation/quota";

const config = { url: "https://example.upstash.io", token: "SECRET_TOKEN" };
function reply(result: unknown): Response { return new Response(JSON.stringify({ result }), { status: 200 }); }

describe("shared investigation quota", () => {
  it("never trusts client IP headers outside Vercel, and buckets missing or ambiguous IPs", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });
    expect(vercelClientKey(headers, false)).toBe("anonymous");
    expect(vercelClientKey(new Headers(), true)).toBe("anonymous");
    expect(vercelClientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), true)).toBe("anonymous");
    expect(vercelClientKey(headers, true)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reserves global and client allowance atomically before returning a lease", async () => {
    const calls: unknown[][] = [];
    const fetcher = vi.fn(async (_url: unknown, init: RequestInit = {}) => {
      const args = JSON.parse(String(init.body)) as unknown[];
      calls.push(args);
      return reply(args[0] === "EVAL" ? [1, 0] : 1);
    }) as unknown as typeof fetch;
    const release = await reserveQuota(config, "anonymous", fetcher);
    expect(calls[0]?.[0]).toBe("EVAL");
    expect(calls[0]?.[2]).toBe(4);
    expect(calls[0]?.[3]).toMatch(/global:/);
    expect(calls[0]?.[4]).toMatch(/client:anonymous:minute:/);
    await release();
    expect(calls[1]?.[0]).toBe("ZREM");
  });

  it.each([["global day", 86400], ["client minute", 60], ["client day", 3600], ["concurrency", 1]])("rejects exhausted %s with Retry-After", async (_name, wait) => {
    const fetcher = vi.fn(async () => reply([0, wait])) as unknown as typeof fetch;
    await expect(reserveQuota(config, "client", fetcher)).rejects.toMatchObject({ kind: "rate_limited", retryAfterSeconds: wait });
  });

  it("fails closed on Redis outage, timeout and malformed results without leaking credentials", async () => {
    for (const fetcher of [
      vi.fn(async () => { throw new Error("SECRET_TOKEN unavailable"); }),
      vi.fn(async () => new Response("unavailable", { status: 503 })),
      vi.fn(async () => reply(null)),
    ]) {
      const error = await reserveQuota(config, "client", fetcher as unknown as typeof fetch).catch((e: unknown) => e);
      expect(error).toMatchObject({ kind: "quota_unavailable" });
      expect(String(error)).not.toContain("SECRET_TOKEN");
    }
  });

  it("denies concurrent reservations when the shared service reports the boundary", async () => {
    let active = 0;
    const fetcher = vi.fn(async (_url: unknown, init: RequestInit = {}) => {
      const args = JSON.parse(String(init.body)) as unknown[];
      if (args[0] === "ZREM") { active -= 1; return reply(1); }
      if (active >= 3) return reply([0, 1]);
      active += 1;
      return reply([1, 0]);
    }) as unknown as typeof fetch;
    const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => reserveQuota(config, "same-client", fetcher)));
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(3);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(5);
    for (const outcome of outcomes) if (outcome.status === "fulfilled") await outcome.value();
    expect(active).toBe(0);
  });

  it("denies a timed-out Redis call", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn((_url: unknown, init: RequestInit = {}) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
      const pending = reserveQuota(config, "client", fetcher);
      const result = expect(pending).rejects.toMatchObject({ kind: "quota_unavailable" });
      await vi.advanceTimersByTimeAsync(2000);
      await result;
    } finally { vi.useRealTimers(); }
  });

  it("uses Redis server time, UTC day/minute boundaries and one atomic concurrency check", () => {
    expect(RESERVE_SCRIPT).toContain("redis.call('TIME')");
    expect(RESERVE_SCRIPT).toContain("math.floor(now / 86400000)");
    expect(RESERVE_SCRIPT).toContain("math.floor(now / 60000)");
    expect(RESERVE_SCRIPT).toContain("redis.call('ZCARD', a) >= 3");
    expect(RESERVE_SCRIPT).toContain("redis.call('PEXPIREAT', g, de)");
  });
});
