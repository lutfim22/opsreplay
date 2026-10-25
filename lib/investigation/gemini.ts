import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { InvestigationError } from "@/lib/investigation/errors";
import type { Generator } from "@/lib/investigation/service";

const MAX_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 2_000;

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

/** Maps SDK failures to fixed error kinds. Upstream messages are dropped: they can echo prompt content. */
export function mapGeminiError(error: unknown): InvestigationError {
  if (error instanceof InvestigationError) return error;
  if (isAbort(error)) return new InvestigationError("timeout");
  if (error instanceof ApiError) {
    if (error.status === 429) return new InvestigationError("quota");
    if (error.status === 408 || error.status === 504) return new InvestigationError("timeout");
    return new InvestigationError("upstream");
  }
  return new InvestigationError("upstream");
}

function retryDelayMs(attempt: number): number {
  const cap = Math.min(MAX_RETRY_DELAY_MS, INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1));
  return Math.round(cap * (0.5 + Math.random() * 0.5));
}

function isTransientGeminiError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 503 || error.status === 504);
}

/** Server-only Gemini adapter. The API key never leaves this process. */
export function createGeminiGenerator(apiKey: string): Generator {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, systemInstruction, prompt, responseJsonSchema, eventCount, timeoutMs }) => {
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let lastStatus: number | null = null;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new InvestigationError("timeout"));
      }, timeoutMs);
    });

    const runAttempts = async () => {
      while (attempts < MAX_ATTEMPTS) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) throw new InvestigationError("timeout");
        attempts += 1;
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseJsonSchema,
              ...( /^gemini-3(?:[.-]|$)/i.test(model)
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : { temperature: 0.2 }),
              maxOutputTokens: 8192,
              abortSignal: controller.signal,
              httpOptions: { timeout: remainingMs, retryOptions: { attempts: 1, httpStatusCodes: [] } },
            },
          });
          lastStatus = 200;
          if (!response.text) throw new InvestigationError("invalid_model_output");
          return response.text;
        } catch (error) {
          if (controller.signal.aborted) throw new InvestigationError("timeout");
          if (!isTransientGeminiError(error) || attempts >= MAX_ATTEMPTS) throw error;
          lastStatus = error.status;
          const delayMs = retryDelayMs(attempts);
          if (delayMs >= deadline - Date.now()) throw error;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      throw new InvestigationError("upstream");
    };

    try {
      const text = await Promise.race([runAttempts(), timedOut]);
      console.info("[investigate] Gemini request completed", {
        status: lastStatus,
        category: "success",
        durationMs: Date.now() - startedAt,
        attempts,
        model,
        eventCount,
      });
      return text;
    } catch (error) {
      const mapped = mapGeminiError(error);
      console.error("[investigate] Gemini request failed", {
        status: lastStatus ?? (error instanceof ApiError ? error.status : null),
        category: mapped.kind,
        durationMs: Date.now() - startedAt,
        attempts,
        model,
        eventCount,
      });
      throw mapped;
    } finally {
      clearTimeout(timer);
      timedOut.catch(() => undefined);
    }
  };
}
