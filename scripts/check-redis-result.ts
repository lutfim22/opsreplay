import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { REDIS_CHECKS, redisSummarySchema } from "@/scripts/redis-verification-contract";

export function checkRedisResult(text: string, controlSha: string) {
  if (!/^[a-f0-9]{40}$/.test(controlSha) || Buffer.byteLength(text, "utf8") > 4096 || text.trim().split(/\r?\n/).length !== 1) {
    throw new Error("Invalid Redis summary.");
  }
  const row = redisSummarySchema.parse(JSON.parse(text));
  if (row.controlSha !== controlSha || row.checks.some((check, index) => check !== REDIS_CHECKS[index]) ||
      row.httpRequests < 1 ||
      (row.outcome === "success" && (row.category !== "success" || row.cleanup !== "passed" || row.checks.length !== REDIS_CHECKS.length || row.applicationAttempts !== 16 || row.httpRequests !== 43)) ||
      (row.outcome === "failure" && row.category === "success") ||
      (row.category === "database_not_empty" && (row.cleanup !== "not_started" || row.applicationAttempts !== 0 || row.httpRequests !== 1 || row.checks.length !== 0))) {
    throw new Error("Inconsistent Redis summary.");
  }
  return { probe: row.probe, targetSha: row.targetSha, controlSha: row.controlSha, outcome: row.outcome,
    category: row.category, checks: row.checks, cleanup: row.cleanup, httpRequests: row.httpRequests,
    applicationAttempts: row.applicationAttempts, durationMs: row.durationMs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const row = checkRedisResult(readFileSync(process.argv[2], "utf8"), process.env.CONTROL_SHA ?? "");
    console.log(JSON.stringify(row));
    if (row.outcome !== "success") process.exitCode = 1;
  } catch {
    console.error("Redis summary validation failed; private output withheld.");
    process.exitCode = 1;
  }
}
