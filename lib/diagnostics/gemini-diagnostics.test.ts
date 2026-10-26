import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";
import type { GoogleGenAI } from "@google/genai";
import { getSimulatedEvents } from "@/lib/timeline";
import {
  classifyDiagnosticFailure,
  createProbes,
  DEFAULT_DIAGNOSTIC_MODEL,
  DEFAULT_DIAGNOSTIC_TIMEOUT_MS,
  readDiagnosticConfig,
  runProbe,
  runProbes,
} from "@/scripts/gemini-diagnostics";
import {
  investigationResponseJsonSchema,
  investigationResultSchema,
  SYSTEM_INSTRUCTION,
} from "@/scripts/gemini-diagnostics-contract";

const validResult = {
  summary: "Simulated device went offline and came back.",
  observedFacts: [],
  hypotheses: [],
  recommendedNextChecks: ["Inspect the device status page."],
  limitations: ["Simulated telemetry only."],
};

afterEach(() => vi.restoreAllMocks());

describe("diagnostic error classification", () => {
  it("distinguishes upstream HTTP errors from client deadline aborts", () => {
    expect(classifyDiagnosticFailure(new ApiError({ message: "secret", status: 504 }))).toEqual({
      httpStatus: 504,
      category: "upstream_http_504",
    });
    expect(classifyDiagnosticFailure(new ApiError({ message: "secret", status: 403 }))).toEqual({
      httpStatus: 403,
      category: "upstream_http_403",
    });
    const abort = new Error("timeout");
    abort.name = "AbortError";
    expect(classifyDiagnosticFailure(abort)).toEqual({ httpStatus: null, category: "client_deadline_abort" });
    expect(classifyDiagnosticFailure(new Error("boom"))).toEqual({ httpStatus: null, category: "client_error" });
  });
});

describe("diagnostic config", () => {
  it("defaults and validates model and timeout", () => {
    expect(readDiagnosticConfig({})).toEqual({
      apiKey: undefined,
      model: DEFAULT_DIAGNOSTIC_MODEL,
      timeoutMs: DEFAULT_DIAGNOSTIC_TIMEOUT_MS,
    });
    expect(readDiagnosticConfig({ GEMINI_API_KEY: " k ", GEMINI_MODEL: "gemini-2.5-flash", GEMINI_TIMEOUT_MS: "55000" })).toEqual({
      apiKey: "k",
      model: "gemini-2.5-flash",
      timeoutMs: 55000,
    });
    expect(() => readDiagnosticConfig({ GEMINI_MODEL: "bad model" })).toThrow();
    expect(() => readDiagnosticConfig({ GEMINI_TIMEOUT_MS: "56000" })).toThrow();
    expect(() => readDiagnosticConfig({ GEMINI_TIMEOUT_MS: "abc" })).toThrow();
  });
});

describe("probe construction and execution (mocked)", () => {
  it("builds the three probes and logs no prompts, ids or responses", async () => {
    const probes = createProbes();
    expect(probes.map((p) => p.name)).toEqual([
      "simple_json_without_schema",
      "simple_json_with_investigation_schema",
      "three_simulated_events_full_investigation",
    ]);
    expect(probes.map((p) => p.useSchema)).toEqual([false, true, true]);
    expect(probes[2]?.eventCount).toBe(3);

    const sim = getSimulatedEvents();
    const spike = sim.find((e) => e.type === "power.reading" && (e.metrics?.powerW ?? 0) >= 1500);
    if (!spike) throw new Error("fixture missing power spike");
    expect(probes[2]?.prompt).toContain(spike.id);
    expect(probes[0]?.prompt).not.toContain(spike.id);

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(validResult) });
    const client = { models: { generateContent } } as unknown as GoogleGenAI;
    for (const probe of probes) await runProbe(client, probe, "gemini-3.8-flash", 1000);

    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(generateContent.mock.calls[0]?.[0].config.responseJsonSchema).toBeUndefined();
    expect(generateContent.mock.calls[1]?.[0].config.responseJsonSchema).toBe(investigationResponseJsonSchema);
    expect(generateContent.mock.calls[2]?.[0].config.systemInstruction).toBe(SYSTEM_INSTRUCTION);
    for (const [call] of generateContent.mock.calls) {
      expect(call.model).toBe("gemini-3.8-flash");
      expect(call.config).toMatchObject({
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "LOW" },
        maxOutputTokens: 8192,
        httpOptions: { retryOptions: { attempts: 1, httpStatusCodes: [] } },
      });
    }
    const lines = log.mock.calls.map(([line]) => String(line));
    const results = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(results.every((r) => r.category === "success")).toBe(true);
    expect(lines.join("")).not.toContain(spike.id);
    expect(lines.join("")).not.toContain(validResult.summary);
  });

  it("classifies failures without leaking error details and sets a failing exit code", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const previous = process.exitCode;
    const generateContent = vi.fn().mockRejectedValue(new ApiError({ message: "SECRET-DETAIL", status: 504 }));
    const client = { models: { generateContent } } as unknown as GoogleGenAI;
    const probe = createProbes()[0]!;
    await runProbe(client, probe, "gemini-3.8-flash", 1000);
    process.exitCode = previous;
    const line = String(log.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toMatchObject({ category: "upstream_http_504", httpStatus: 504, outcome: "failure" });
    expect(line).not.toContain("SECRET-DETAIL");
  });

  it("stops before later probes after a mocked schema rejection", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const previous = process.exitCode;
    try {
      const generateContent = vi
        .fn()
        .mockResolvedValueOnce({ text: '{"ok":true}' })
        .mockRejectedValueOnce(new ApiError({ message: "PRIVATE_PROVIDER_DETAIL", status: 400 }));
      const client = { models: { generateContent } } as unknown as GoogleGenAI;

      await runProbes(client, "gemini-3.6-flash", 1000);

      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(generateContent.mock.calls[0]?.[0].config.responseJsonSchema).toBeUndefined();
      expect(generateContent.mock.calls[1]?.[0].config.responseJsonSchema).toBe(investigationResponseJsonSchema);
      expect(log).toHaveBeenCalledTimes(2);
      expect(String(log.mock.calls[1]?.[0])).not.toContain("PRIVATE_PROVIDER_DETAIL");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previous;
    }
  });

  it("flags schema-invalid output", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const previous = process.exitCode;
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify({ summary: "" }) });
    const client = { models: { generateContent } } as unknown as GoogleGenAI;
    await runProbe(client, createProbes()[1]!, "gemini-3.8-flash", 1000);
    expect(process.exitCode).toBe(1);
    process.exitCode = previous;
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ category: "schema_validation_failed" });
    expect(investigationResultSchema.safeParse({ summary: "" }).success).toBe(false);
  });

  it("fails invalid JSON without logging the response", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const previous = process.exitCode;
    try {
      const generateContent = vi.fn().mockResolvedValue({ text: "PRIVATE_INVALID_JSON" });
      await runProbe({ models: { generateContent } } as unknown as GoogleGenAI, createProbes()[0]!, "gemini-2.5-flash", 1000);
      expect(process.exitCode).toBe(1);
      expect(String(log.mock.calls[0]?.[0])).not.toContain("PRIVATE_INVALID_JSON");
      expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ category: "invalid_json_response", outcome: "failure" });
      expect(generateContent).toHaveBeenCalledTimes(1);
    } finally {
      process.exitCode = previous;
    }
  });
});
