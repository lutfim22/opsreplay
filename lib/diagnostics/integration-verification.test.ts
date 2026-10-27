import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "@google/genai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUserPrompt, SYSTEM_INSTRUCTION } from "@/lib/investigation/prompt";
import { investigationProviderResponseJsonSchema } from "@/lib/investigation/schema";
import { checkIntegrationResult } from "@/scripts/check-integration-result";
import { INTEGRATION_TARGET_SHA, verificationInputs } from "@/scripts/integration-verification-contract";
import { integrationEvents, liveVerificationConfig, runIntegrationProbe } from "@/scripts/verify-gemini-integration";

const config = { model: "gemini-3.6-flash", timeoutMs: 1000 };
const validResult = () => ({
  summary: "The submitted simulated events show a spike, offline state and recovery.",
  observedFacts: integrationEvents().map((event) => ({ statement: "A simulated event was recorded.", eventIds: [event.id] })),
  hypotheses: [],
  recommendedNextChecks: ["Read device logs to establish real-world behavior."],
  limitations: ["Simulated telemetry is not real hardware evidence."],
});
const successSummary = () => ({ probe: "reduced_schema_investigation", targetSha: INTEGRATION_TARGET_SHA,
  ...config, attempts: 1, eventCount: 3, durationMs: 20, httpStatus: 200,
  category: "success", outcome: "success", validation: "passed" });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("reduced-schema integration verification (offline)", () => {
  it.each(["gemini-2.5-flash", "gemini-3.6-flash"])("sends exactly the application's contract once for %s", async (model) => {
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(validResult()) });
    const row = await runIntegrationProbe({ generateContent }, { ...config, model });
    expect(row).toMatchObject({ attempts: 1, eventCount: 3, httpStatus: 200, category: "success", outcome: "success", validation: "passed" });
    expect(generateContent).toHaveBeenCalledTimes(1);
    const request = generateContent.mock.calls[0]?.[0];
    expect(request.contents).toBe(buildUserPrompt(integrationEvents()));
    expect(request.config.systemInstruction).toBe(SYSTEM_INSTRUCTION);
    expect(request.config.responseJsonSchema).toBe(investigationProviderResponseJsonSchema);
    expect(request.config).toMatchObject({ responseMimeType: "application/json", maxOutputTokens: 8192,
      httpOptions: { timeout: 1000, retryOptions: { attempts: 1, httpStatusCodes: [] } } });
    expect(request.config.thinkingConfig).toEqual(model.startsWith("gemini-3") ? { thinkingLevel: "LOW" } : undefined);
    expect(request.config.temperature).toBe(model.startsWith("gemini-3") ? undefined : 0.2);
    expect(JSON.stringify(row)).not.toContain(integrationEvents()[0]!.id);
    expect(checkIntegrationResult(JSON.stringify(row), { ...config, model })).toEqual(row);
  });

  it.each([400, 429, 503, 504])("never retries HTTP %s and discards private provider details", async (status) => {
    const generateContent = vi.fn().mockRejectedValue(new ApiError({ status, message: "PRIVATE_PROVIDER_ERROR" }));
    const row = await runIntegrationProbe({ generateContent }, config);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(row).toMatchObject({ attempts: 1, httpStatus: status, category: `upstream_http_${status}`, outcome: "failure", validation: "not_run" });
    expect(JSON.stringify(row)).not.toContain("PRIVATE_PROVIDER_ERROR");
    expect(checkIntegrationResult(JSON.stringify(row), config)).toEqual(row);
  });

  it.each(["not-json", "", JSON.stringify({ summary: "incomplete" }), JSON.stringify({ ...validResult(), summary: "x".repeat(2001) })])("rejects unusable output without fallback", async (text) => {
    const generateContent = vi.fn().mockResolvedValue({ text });
    const row = await runIntegrationProbe({ generateContent }, config);
    expect(row).toMatchObject({ httpStatus: 200, category: "invalid_model_output", outcome: "failure", validation: "failed" });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(checkIntegrationResult(JSON.stringify(row), config)).toEqual(row);
  });

  it.each(["structured", "free-text"])("rejects invented evidence in %s and emits no private output", async (mode) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = validResult();
    if (mode === "structured") result.observedFacts[0]!.eventIds = ["sim-9999"];
    else result.summary = "PRIVATE_MODEL_OUTPUT refers to sim-9999.";
    const row = await runIntegrationProbe({ generateContent: vi.fn().mockResolvedValue({ text: JSON.stringify(result) }) }, config);
    expect(row).toMatchObject({ category: "invalid_model_output", validation: "failed", outcome: "failure" });
    expect(JSON.stringify(row)).not.toMatch(/PRIVATE_MODEL_OUTPUT|sim-9999/);
  });

  it("aborts a hanging provider request at the approved deadline without a second attempt", async () => {
    vi.useFakeTimers();
    const generateContent = vi.fn().mockImplementation(() => new Promise(() => undefined));
    const pending = runIntegrationProbe({ generateContent }, config);
    await vi.advanceTimersByTimeAsync(1000);
    const row = await pending;
    expect(row).toMatchObject({ attempts: 1, httpStatus: null, category: "client_deadline_abort", outcome: "failure", validation: "not_run" });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0]?.[0].config.abortSignal.aborted).toBe(true);
    expect(checkIntegrationResult(JSON.stringify(row), config)).toEqual(row);
  });

  it("requires explicit live authorization, an exact target, a key, model and bounded timeout", () => {
    const env = { INTEGRATION_VERIFICATION_AUTHORIZED: "1", TARGET_SHA: INTEGRATION_TARGET_SHA,
      GEMINI_API_KEY: "PRIVATE_TEST_KEY", GEMINI_MODEL: config.model, GEMINI_TIMEOUT_MS: "1000" };
    expect(liveVerificationConfig(env)).toEqual({ ...config, apiKey: "PRIVATE_TEST_KEY" });
    for (const key of Object.keys(env)) {
      expect(() => liveVerificationConfig({ ...env, [key]: undefined })).toThrow();
    }
    expect(() => liveVerificationConfig({ ...env, TARGET_SHA: "main" })).toThrow();
    for (const timeout of ["0", "999", "25001", "55000", "1e3", "NaN"]) {
      expect(() => verificationInputs({ ...env, GEMINI_TIMEOUT_MS: timeout })).toThrow();
    }
    expect(() => verificationInputs({ ...env, GEMINI_MODEL: "PRIVATE_BAD_MODEL" })).toThrow();
  });

  it("rejects invalid configuration before touching the injected provider", async () => {
    const generateContent = vi.fn();
    await expect(runIntegrationProbe({ generateContent }, { ...config, timeoutMs: 25001 })).rejects.toThrow();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("CLI fails without the authorization marker and withholds environment values", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/verify-gemini-integration.ts"], {
      env: { ...process.env, INTEGRATION_VERIFICATION_AUTHORIZED: "", TARGET_SHA: INTEGRATION_TARGET_SHA,
        GEMINI_API_KEY: "PRIVATE_TEST_KEY", GEMINI_MODEL: config.model, GEMINI_TIMEOUT_MS: "1000" }, encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("PRIVATE_TEST_KEY");
  });
});

describe("single integration result checker (offline)", () => {
  it("rejects repeated, oversized, malformed and extra-field records without echoing them", () => {
    const row = JSON.stringify(successSummary());
    for (const text of [`${row}\n${row}`, "PRIVATE_RAW_OUTPUT", "x".repeat(4097), JSON.stringify({ ...successSummary(), privateOutput: "PRIVATE_RAW_OUTPUT" })]) {
      expect(() => checkIntegrationResult(text, config)).toThrow();
    }
  });

  it.each([
    { targetSha: "main" }, { model: "gemini-other" }, { timeoutMs: 2000 }, { attempts: 0 },
    { attempts: 2 }, { eventCount: 4 }, { durationMs: -1 }, { httpStatus: 400 },
    { category: "PRIVATE_ERROR_TEXT" }, { validation: "not_run" }, { outcome: "failure" },
  ])("rejects a wrong or inconsistent summary: %j", (change) => {
    expect(() => checkIntegrationResult(JSON.stringify({ ...successSummary(), ...change }), config)).toThrow();
  });

  it("checker CLI succeeds only for a successful probe and fails unsuccessful or malformed output", () => {
    const directory = mkdtempSync(join(tmpdir(), "integration-summary-"));
    try {
      const path = join(directory, "summary.jsonl");
      const failure = { ...successSummary(), httpStatus: 429, category: "upstream_http_429", outcome: "failure", validation: "not_run" };
      for (const [text, status] of [[JSON.stringify(successSummary()), 0], [JSON.stringify(failure), 1], ["PRIVATE_RAW_OUTPUT", 1]] as const) {
        writeFileSync(path, text);
        const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/check-integration-result.ts", path], {
          env: { ...process.env, GEMINI_MODEL: config.model, GEMINI_TIMEOUT_MS: "1000" }, encoding: "utf8",
        });
        expect(result.status).toBe(status);
        expect(result.stdout + result.stderr).not.toContain("PRIVATE_RAW_OUTPUT");
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
