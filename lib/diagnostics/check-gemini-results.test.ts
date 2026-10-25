import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkGeminiResults } from "@/scripts/check-gemini-results";

const model = "gemini-2.5-flash";
const names = ["simple_json_without_schema", "simple_json_with_investigation_schema", "three_simulated_events_full_investigation"];
const rows = () => names.map((probe, i) => ({ probe, model, durationMs: 10, httpStatus: 200,
  category: "success", outcome: "success", eventCount: i === 2 ? 3 : 0 }));
const encode = (data: unknown[]) => data.map((row) => JSON.stringify(row)).join("\n");

describe("sanitized Gemini summaries (offline)", () => {
  it("accepts the three ordered probes and drops extra response fields", () => {
    const input = rows().map((row) => ({ ...row, privateOutput: "SECRET_RESPONSE" }));
    expect(checkGeminiResults(encode(input), model)).toHaveLength(3);
    expect(JSON.stringify(checkGeminiResults(encode(input), model))).not.toContain("SECRET_RESPONSE");
  });
  it("preserves a failed output despite HTTP 200 for the workflow to reject", () => {
    const input = rows();
    input[1].category = "schema_validation_failed";
    input[1].outcome = "failure";
    expect(checkGeminiResults(encode(input), model)[1]).toMatchObject({ outcome: "failure", category: "schema_validation_failed" });
  });
  it("rejects missing, extra, duplicate, reordered and wrong-model records", () => {
    const input = rows();
    for (const data of [input.slice(0, 2), [...input, input[0]], [input[0], input[0], input[2]], [...input].reverse()]) {
      expect(() => checkGeminiResults(encode(data), model)).toThrow();
    }
    expect(() => checkGeminiResults(encode(input), "gemini-3.8-flash")).toThrow();
  });
  it("rejects malformed output and unsafe category text without echoing it", () => {
    expect(() => checkGeminiResults("PRIVATE_RAW_ERROR", model)).toThrow();
    const input = rows();
    input[1].category = "PRIVATE_RAW_ERROR";
    expect(() => checkGeminiResults(encode(input), model)).toThrow("Invalid probe summary.");
  });
  it("CLI fails HTTP-200 validation failures and withholds unexpected output", () => {
    const directory = mkdtempSync(join(tmpdir(), "pr7-summary-test-"));
    try {
      const path = join(directory, "results.jsonl");
      const input = rows();
      input[1].category = "schema_validation_failed";
      input[1].outcome = "failure";
      for (const [text, status] of [[encode(rows()), 0], [encode(input), 1], ["PRIVATE_RAW_ERROR", 1]] as const) {
        writeFileSync(path, text);
        const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/check-gemini-results.ts", path], {
          env: { ...process.env, GEMINI_MODEL: model }, encoding: "utf8",
        });
        expect(result.status, result.stderr).toBe(status);
        expect(result.stdout + result.stderr).not.toContain("PRIVATE_RAW_ERROR");
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
