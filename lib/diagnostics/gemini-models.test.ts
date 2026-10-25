import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";
import type { Model } from "@google/genai";
import {
  classifyModelListFailure,
  listModelSummaries,
  runModelDiscovery,
  summarizeModel,
} from "@/scripts/gemini-models";
import type { ModelListClient } from "@/scripts/gemini-models";

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function* paged(pages: Model[][]): AsyncGenerator<Model> {
  for (const page of pages) yield* page;
}

const clientOf = (pages: Model[][]): ModelListClient => ({
  models: { list: vi.fn(async () => paged(pages)) },
});

describe("model discovery", () => {
  it("lists models and flags generateContent support", async () => {
    const out = await listModelSummaries(
      clientOf([[{ name: "models/gemini-a", displayName: "A", supportedActions: ["generateContent", "countTokens"] }]]),
    );
    expect(out).toEqual([
      { id: "gemini-a", displayName: "A", supportedActions: ["generateContent", "countTokens"], generateContent: "yes" },
    ]);
  });

  it("returns models across all pages", async () => {
    const out = await listModelSummaries(
      clientOf([[{ name: "models/a" }, { name: "models/b" }], [{ name: "models/c" }]]),
    );
    expect(out.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("marks missing capability metadata as unknown and no-support as no", () => {
    expect(summarizeModel({ name: "models/x" })?.generateContent).toBe("unknown");
    expect(summarizeModel({ name: "models/y", supportedActions: ["embedContent"] })?.generateContent).toBe("no");
    expect(summarizeModel({})).toBeNull();
  });

  it("classifies API failures without exposing messages", async () => {
    expect(classifyModelListFailure(new ApiError({ message: "secret-key-123", status: 403 }))).toEqual({
      httpStatus: 403,
      category: "upstream_http_403",
    });
    expect(classifyModelListFailure(new Error("boom"))).toEqual({ httpStatus: null, category: "client_error" });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runModelDiscovery({
      models: { list: vi.fn(async () => Promise.reject(new ApiError({ message: "secret-key-123", status: 404 }))) },
    });
    const printed = log.mock.calls.flat().join("\n");
    expect(printed).toContain("upstream_http_404");
    expect(printed).not.toContain("secret-key-123");
    expect(process.exitCode).toBe(1);
  });
});
