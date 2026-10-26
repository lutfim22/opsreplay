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
  it("accepts fail-fast prefixes for inspection while the CLI fails incomplete output", () => {
    const firstFailure = rows();
    firstFailure[0].category = "upstream_http_400";
    firstFailure[0].outcome = "failure";
    const secondFailure = rows();
    secondFailure[1].category = "upstream_http_400";
    secondFailure[1].outcome = "failure";

    expect(checkGeminiResults(encode(firstFailure.slice(0, 1)), model)).toHaveLength(1);
    expect(checkGeminiResults(encode(secondFailure.slice(0, 2)), model)).toHaveLength(2);
    expect(checkGeminiResults(encode(rows().slice(0, 2)), model)).toHaveLength(2);
    expect(() => checkGeminiResults(encode(rows().slice(0, 2).reverse()), model)).toThrow();

    const directory = mkdtempSync(join(tmpdir(), "pr7-summary-test-"));
    try {
      const path = join(directory, "results.jsonl");
      for (const partial of [firstFailure.slice(0, 1), secondFailure.slice(0, 2), rows().slice(0, 2)]) {
        writeFileSync(path, encode(partial));
        const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/check-gemini-results.ts", path], {
          env: { ...process.env, GEMINI_MODEL: model }, encoding: "utf8",
        });
        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).not.toContain("PRIVATE_RAW_ERROR");
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("preserves a failed output despite HTTP 200 for the workflow to reject", () => {
    const input = rows();
    input[1].category = "schema_validation_failed";
    input[1].outcome = "failure";
    expect(checkGeminiResults(encode(input), model)[1]).toMatchObject({ outcome: "failure", category: "schema_validation_failed" });
  });
  it("rejects extra, duplicate, reordered and wrong-model records", () => {
    const input = rows();
    for (const data of [[...input, input[0]], [input[0], input[0], input[2]], [...input].reverse()]) {
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
  it("CLI passes only the all-success three-probe run and withholds unexpected output", () => {
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
