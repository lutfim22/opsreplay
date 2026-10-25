import { pathToFileURL } from "node:url";
import { ApiError, GoogleGenAI } from "@google/genai";
import type { Model } from "@google/genai";

export interface ModelSummary {
  id: string;
  displayName: string | null;
  supportedActions: string[] | null;
  generateContent: "yes" | "no" | "unknown";
}

export interface ModelListFailure {
  httpStatus: number | null;
  category: string;
}

export interface ModelListClient {
  models: {
    list: (params?: { config?: { pageSize?: number } }) => Promise<AsyncIterable<Model>>;
  };
}

const PAGE_SIZE = 100;
const MAX_MODELS = 2000;

export function summarizeModel(model: Model): ModelSummary | null {
  if (!model.name) return null;
  const actions = Array.isArray(model.supportedActions)
    ? model.supportedActions.filter((a): a is string => typeof a === "string")
    : null;
  return {
    id: model.name.replace(/^models\//, ""),
    displayName: model.displayName ?? null,
    supportedActions: actions,
    generateContent: actions === null ? "unknown" : actions.includes("generateContent") ? "yes" : "no",
  };
}

export function classifyModelListFailure(error: unknown): ModelListFailure {
  if (error instanceof ApiError) {
    return { httpStatus: error.status, category: `upstream_http_${error.status}` };
  }
  return { httpStatus: null, category: "client_error" };
}

export async function listModelSummaries(client: ModelListClient): Promise<ModelSummary[]> {
  const pager = await client.models.list({ config: { pageSize: PAGE_SIZE } });
  const summaries: ModelSummary[] = [];
  for await (const model of pager) {
    const summary = summarizeModel(model);
    if (summary) summaries.push(summary);
    if (summaries.length >= MAX_MODELS) break;
  }
  return summaries;
}

export async function runModelDiscovery(client?: ModelListClient): Promise<void> {
  let ai = client;
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set; no Gemini requests were sent.");
      process.exitCode = 1;
      return;
    }
    ai = new GoogleGenAI({ apiKey }) as unknown as ModelListClient;
  }

  try {
    const models = await listModelSummaries(ai);
    for (const m of models) console.log(JSON.stringify(m));
    const supporting = models.filter((m) => m.generateContent === "yes").map((m) => m.id);
    console.log(
      JSON.stringify({
        summary: true,
        totalModels: models.length,
        generateContentModels: supporting.length,
        unknownCapabilityModels: models.filter((m) => m.generateContent === "unknown").length,
        generateContentIds: supporting,
      }),
    );
  } catch (error) {
    console.log(JSON.stringify({ summary: true, outcome: "failure", ...classifyModelListFailure(error) }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runModelDiscovery();
}
