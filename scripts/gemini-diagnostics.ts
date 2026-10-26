import { pathToFileURL } from "node:url";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getSimulatedEvents } from "@/lib/timeline";
import {
  buildUserPrompt,
  investigationResponseJsonSchema,
  investigationResultSchema,
  SYSTEM_INSTRUCTION,
} from "@/scripts/gemini-diagnostics-contract";
import type { OpsEvent } from "@/lib/events";

interface Probe {
  name: string;
  prompt: string;
  eventCount: number;
  systemInstruction?: string;
  useSchema: boolean;
}

interface DiagnosticFailure {
  httpStatus: number | null;
  category: string;
}

class DiagnosticDeadlineError extends Error {}

export function classifyDiagnosticFailure(error: unknown): DiagnosticFailure {
  if (error instanceof ApiError) {
    return {
      httpStatus: error.status,
      category: error.status === 504 ? "upstream_http_504" : `upstream_http_${error.status}`,
    };
  }
  if (error instanceof DiagnosticDeadlineError || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) {
    return { httpStatus: null, category: "client_deadline_abort" };
  }
  return { httpStatus: null, category: "client_error" };
}

function representativeEvents(): OpsEvent[] {
  const events = getSimulatedEvents();
  const spike = events.find((event) => event.type === "power.reading" && (event.metrics?.powerW ?? 0) >= 1500);
  const offline = events.find((event) => event.type === "device.offline");
  const online = events.find((event) => event.type === "device.online");
  if (!spike || !offline || !online) throw new Error("simulator fixture is missing representative events");
  return [spike, offline, online];
}

export function createProbes(): Probe[] {
  const events = representativeEvents();
  return [
    {
      name: "simple_json_without_schema",
      prompt: 'Return only a JSON object with one property: {"ok": true}.',
      eventCount: 0,
      useSchema: false,
    },
    {
      name: "simple_json_with_investigation_schema",
      prompt:
        'Return one valid JSON investigation object. Include a concise non-empty summary, empty observedFacts and hypotheses arrays, one recommendedNextChecks item, and one limitations item.',
      eventCount: 0,
      useSchema: true,
    },
    {
      name: "three_simulated_events_full_investigation",
      prompt: buildUserPrompt(events),
      systemInstruction: SYSTEM_INSTRUCTION,
      eventCount: events.length,
      useSchema: true,
    },
  ];
}

export async function runProbe(ai: GoogleGenAI, probe: Probe, model: string, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveDeadline: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    resolveDeadline = () => reject(new DiagnosticDeadlineError());
    deadlineTimer = setTimeout(() => {
      controller.abort();
      resolveDeadline?.();
    }, timeoutMs);
  });

  try {
    const request = ai.models.generateContent({
      model,
      contents: probe.prompt,
      config: {
        ...(probe.systemInstruction ? { systemInstruction: probe.systemInstruction } : {}),
        responseMimeType: "application/json",
        ...(probe.useSchema ? { responseJsonSchema: investigationResponseJsonSchema } : {}),
        ...( /^gemini-3(?:[.-]|$)/i.test(model)
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : { temperature: 0.2 }),
        maxOutputTokens: 8192,
        abortSignal: controller.signal,
        httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1, httpStatusCodes: [] } },
      },
    });
    const response = await Promise.race([request, deadline]);
    let validOutput = false;
    try {
      const json: unknown = JSON.parse(response.text ?? "");
      validOutput = probe.useSchema ? investigationResultSchema.safeParse(json).success : true;
    } catch {
      validOutput = false;
    }
    if (!validOutput) process.exitCode = 1;
    console.log(
      JSON.stringify({
        probe: probe.name,
        model,
        durationMs: Date.now() - startedAt,
        httpStatus: 200,
        category: validOutput ? "success" : probe.useSchema ? "schema_validation_failed" : "invalid_json_response",
        outcome: validOutput ? "success" : "failure",
        promptBytes: Buffer.byteLength(probe.prompt, "utf8"),
        eventCount: probe.eventCount,
      }),
    );
    return validOutput;
  } catch (error) {
    const failure = classifyDiagnosticFailure(error);
    console.log(
      JSON.stringify({
        probe: probe.name,
        model,
        durationMs: Date.now() - startedAt,
        ...failure,
        outcome: "failure",
        promptBytes: Buffer.byteLength(probe.prompt, "utf8"),
        eventCount: probe.eventCount,
      }),
    );
    process.exitCode = 1;
    return false;
  } finally {
    clearTimeout(deadlineTimer);
  }
}

/** Stop after the first unsuccessful probe so a known failure does not consume more provider quota. */
export async function runProbes(ai: GoogleGenAI, model: string, timeoutMs: number): Promise<void> {
  for (const probe of createProbes()) {
    if (!(await runProbe(ai, probe, model, timeoutMs))) break;
  }
}

export const DEFAULT_DIAGNOSTIC_MODEL = "gemini-3.8-flash";
export const DEFAULT_DIAGNOSTIC_TIMEOUT_MS = 45_000;
const MAX_DIAGNOSTIC_TIMEOUT_MS = 55_000;
const MODEL_PATTERN = /^gemini-[a-z0-9][a-z0-9.-]{0,63}$/;

export function readDiagnosticConfig(env: Record<string, string | undefined> = process.env) {
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_DIAGNOSTIC_MODEL;
  if (!MODEL_PATTERN.test(model)) throw new Error("GEMINI_MODEL is not a valid gemini-* model id.");
  const raw = env.GEMINI_TIMEOUT_MS?.trim();
  const timeoutMs = raw === undefined || raw === "" ? DEFAULT_DIAGNOSTIC_TIMEOUT_MS : Number(raw);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > MAX_DIAGNOSTIC_TIMEOUT_MS) {
    throw new Error("GEMINI_TIMEOUT_MS must be between 1000 and 55000.");
  }
  return { apiKey: env.GEMINI_API_KEY?.trim() || undefined, model, timeoutMs };
}

export async function runGeminiDiagnostics(): Promise<void> {
  const config = readDiagnosticConfig();
  if (!config.apiKey) {
    console.error("GEMINI_API_KEY is not set; no Gemini requests were sent.");
    process.exitCode = 1;
    return;
  }

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  await runProbes(ai, config.model, config.timeoutMs);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runGeminiDiagnostics().catch(() => {
    console.error("Gemini diagnostics stopped before completing; no request details were logged.");
    process.exitCode = 1;
  });
}
