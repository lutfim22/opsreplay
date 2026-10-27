import { pathToFileURL } from "node:url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { InvestigationError } from "@/lib/investigation/errors";
import { investigate } from "@/lib/investigation/service";
import { getSimulatedEvents } from "@/lib/timeline";
import { classifyDiagnosticFailure } from "@/scripts/gemini-diagnostics";
import { INTEGRATION_PROBE, INTEGRATION_TARGET_SHA, verificationInputs } from "@/scripts/integration-verification-contract";
import type { IntegrationSummary } from "@/scripts/integration-verification-contract";

type ProbeClient = Pick<GoogleGenAI["models"], "generateContent">;

/** Existing deterministic simulator data; no GitHub, device, Redis or production requests. */
export function integrationEvents() {
  const events = getSimulatedEvents();
  const selected = [
    events.find((event) => event.type === "power.reading" && (event.metrics?.powerW ?? 0) >= 1500),
    events.find((event) => event.type === "device.offline"),
    events.find((event) => event.type === "device.online"),
  ];
  return selected.map((event) => {
    if (!event) throw new Error("Verification simulator fixture is incomplete.");
    return event;
  });
}

/** The application service supplies its actual reduced schema, prompt and local evidence checks. */
export async function runIntegrationProbe(
  client: ProbeClient,
  config: { model: string; timeoutMs: number },
): Promise<IntegrationSummary> {
  // Revalidate even callers using the injectable, offline-test entry point.
  verificationInputs({ GEMINI_MODEL: config.model, GEMINI_TIMEOUT_MS: String(config.timeoutMs) });
  const events = integrationEvents();
  const startedAt = Date.now();
  let attempts = 0;
  let httpStatus: number | null = null;
  let category = "success";
  let validation: IntegrationSummary["validation"] = "not_run";
  try {
    await investigate({ events }, async (request) => {
      attempts += 1;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new DOMException("Verification deadline exceeded.", "TimeoutError"));
        }, request.timeoutMs);
      });
      try {
        const response = await Promise.race([
          client.generateContent({
            model: request.model,
            contents: request.prompt,
            config: {
              systemInstruction: request.systemInstruction,
              responseMimeType: "application/json",
              responseJsonSchema: request.responseJsonSchema,
              ...(/^gemini-3(?:[.-]|$)/i.test(request.model)
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : { temperature: 0.2 }),
              maxOutputTokens: 8192,
              abortSignal: controller.signal,
              httpOptions: { timeout: request.timeoutMs, retryOptions: { attempts: 1, httpStatusCodes: [] } },
            },
          }),
          deadline,
        ]);
        httpStatus = 200;
        return response.text ?? "";
      } finally {
        clearTimeout(timer);
      }
    }, config);
    validation = "passed";
  } catch (error) {
    if (error instanceof InvestigationError) {
      category = error.kind === "payload_too_large" ? "payload_too_large" : "invalid_model_output";
      if (httpStatus === 200) validation = "failed";
    } else {
      const failure = classifyDiagnosticFailure(error);
      category = failure.category;
      httpStatus = failure.httpStatus;
    }
  }
  // Never return model content, event IDs, errors, credentials or provider headers.
  return {
    probe: INTEGRATION_PROBE,
    targetSha: INTEGRATION_TARGET_SHA,
    model: config.model,
    timeoutMs: config.timeoutMs,
    attempts,
    eventCount: 3,
    durationMs: Date.now() - startedAt,
    httpStatus,
    category,
    outcome: validation === "passed" ? "success" : "failure",
    validation,
  };
}

export function liveVerificationConfig(env: Record<string, string | undefined>) {
  if (env.INTEGRATION_VERIFICATION_AUTHORIZED !== "1" || env.TARGET_SHA !== INTEGRATION_TARGET_SHA) {
    throw new Error("Explicit verification authorization and the pinned target are required.");
  }
  const inputs = verificationInputs(env);
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Verification provider configuration is missing.");
  return { ...inputs, apiKey };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    const config = liveVerificationConfig(process.env);
    const client = new GoogleGenAI({ apiKey: config.apiKey });
    const summary = await runIntegrationProbe(client.models, config);
    console.log(JSON.stringify(summary));
    if (summary.outcome !== "success") process.exitCode = 1;
  })().catch(() => {
    console.error("Integration verification stopped; private details withheld.");
    process.exitCode = 1;
  });
}
