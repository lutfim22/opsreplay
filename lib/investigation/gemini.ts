import { ApiError, GoogleGenAI } from "@google/genai";
import { InvestigationError } from "@/lib/investigation/errors";
import type { Generator } from "@/lib/investigation/service";

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

/** Maps SDK failures to fixed error kinds. Upstream messages are dropped: they can echo prompt content. */
export function mapGeminiError(error: unknown): InvestigationError {
  if (error instanceof InvestigationError) return error;
  if (isAbort(error)) return new InvestigationError("timeout");
  if (error instanceof ApiError) {
    console.error("[investigate] Gemini API error", { status: error.status });
    if (error.status === 429) return new InvestigationError("quota");
    if (error.status === 408 || error.status === 504) return new InvestigationError("timeout");
    return new InvestigationError("upstream");
  }
  console.error("[investigate] unexpected Gemini failure", { name: error instanceof Error ? error.name : typeof error });
  return new InvestigationError("upstream");
}

/** Server-only Gemini adapter. The API key never leaves this process. */
export function createGeminiGenerator(apiKey: string): Generator {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, systemInstruction, prompt, responseJsonSchema, timeoutMs }) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new InvestigationError("timeout"));
      }, timeoutMs);
    });
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseJsonSchema,
            temperature: 0.2,
            maxOutputTokens: 8192,
            abortSignal: controller.signal,
            httpOptions: { timeout: timeoutMs },
          },
        }),
        timedOut,
      ]);
      const text = response.text;
      if (!text) throw new InvestigationError("invalid_model_output");
      return text;
    } catch (error) {
      throw mapGeminiError(error);
    } finally {
      clearTimeout(timer);
      // The losing generateContent promise may still reject after a timeout; swallow it.
      timedOut.catch(() => undefined);
    }
  };
}
