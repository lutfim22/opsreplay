import { NextResponse } from "next/server";
import { readConfig } from "@/lib/investigation/config";
import { ERROR_STATUS, InvestigationError } from "@/lib/investigation/errors";
import { createGeminiGenerator } from "@/lib/investigation/gemini";
import { clientKey, createRateLimiter } from "@/lib/investigation/rate-limit";
import { reserveQuota, vercelClientKey } from "@/lib/investigation/quota";
import { assertSameOrigin, parseInvestigateRequest } from "@/lib/investigation/request";
import { investigate } from "@/lib/investigation/service";

export const maxDuration = 60;

let limiter: ReturnType<typeof createRateLimiter> | undefined;
let limiterLimit = 0;

function rateLimiter(limit: number) {
  if (!limiter || limiterLimit !== limit) {
    limiter = createRateLimiter(limit);
    limiterLimit = limit;
  }
  return limiter;
}

function failure(error: InvestigationError) {
  return NextResponse.json(
    { ok: false, error: { kind: error.kind, message: error.message, retryAfterSeconds: error.retryAfterSeconds } },
    {
      status: ERROR_STATUS[error.kind],
      headers: {
        "Cache-Control": "no-store",
        ...(error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {}),
      },
    },
  );
}

/** Read-only AI analysis of submitted events. Nothing is stored and nothing is executed. */
export async function POST(request: Request) {
  try {
    const config = readConfig();
    assertSameOrigin(request);

    if (!config.apiKey) throw new InvestigationError("not_configured");
    const body = await parseInvestigateRequest(request);
    if (!config.quota && !config.localBypass) throw new InvestigationError("quota_unavailable");
    let release: (() => Promise<void>) | undefined;
    if (config.quota) release = await reserveQuota(config.quota, vercelClientKey(request.headers, config.vercel));
    else {
      const limit = rateLimiter(config.rateLimitPerMinute).check(clientKey(request.headers));
      if (!limit.allowed) throw new InvestigationError("rate_limited", { retryAfterSeconds: limit.retryAfterSeconds });
    }
    try {
      const result = await investigate(body, createGeminiGenerator(config.apiKey), config);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } finally { await release?.(); }
  } catch (error) {
    if (error instanceof InvestigationError) return failure(error);
    console.error("[investigate] unexpected error", { name: error instanceof Error ? error.name : typeof error });
    return failure(new InvestigationError("upstream"));
  }
}
