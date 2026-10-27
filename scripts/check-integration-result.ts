import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { integrationSummarySchema, verificationInputs } from "@/scripts/integration-verification-contract";

/** Only one bounded, strict summary may reach public workflow logs. */
export function checkIntegrationResult(text: string, expected: { model: string; timeoutMs: number }) {
  verificationInputs({ GEMINI_MODEL: expected.model, GEMINI_TIMEOUT_MS: String(expected.timeoutMs) });
  if (Buffer.byteLength(text, "utf8") > 4096 || text.trim().split(/\r?\n/).length !== 1) {
    throw new Error("Invalid integration summary.");
  }
  const row = integrationSummarySchema.parse(JSON.parse(text));
  if (row.model !== expected.model || row.timeoutMs !== expected.timeoutMs ||
      (row.outcome === "success" && (row.category !== "success" || row.validation !== "passed" || row.httpStatus !== 200 || row.attempts !== 1)) ||
      (row.outcome === "failure" && (row.category === "success" || row.validation === "passed")) ||
      (row.validation === "failed" && (row.httpStatus !== 200 || row.category !== "invalid_model_output" || row.attempts !== 1)) ||
      (row.category === "invalid_model_output" && row.validation !== "failed") ||
      (row.category.startsWith("upstream_http_") && (row.httpStatus !== Number(row.category.slice(-3)) || row.attempts !== 1 || row.validation !== "not_run"))) {
    throw new Error("Inconsistent integration summary.");
  }
  // Strict schema rejects extra fields; reconstruct the public allowlist as defense in depth.
  return { probe: row.probe, targetSha: row.targetSha, model: row.model, timeoutMs: row.timeoutMs,
    attempts: row.attempts, eventCount: row.eventCount, durationMs: row.durationMs, httpStatus: row.httpStatus,
    category: row.category, outcome: row.outcome, validation: row.validation };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const row = checkIntegrationResult(readFileSync(process.argv[2], "utf8"), verificationInputs(process.env));
    console.log(JSON.stringify(row));
    if (row.outcome !== "success") process.exitCode = 1;
  } catch {
    console.error("Integration summary validation failed; private output withheld.");
    process.exitCode = 1;
  }
}
