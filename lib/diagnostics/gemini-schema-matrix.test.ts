import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";
import {
  collectSchemaKeywords,
  createMatrixCases,
  extractSafeApiErrorDetails,
  removeStringLengthBounds,
  runMatrixCase,
  undocumentedKeywords,
} from "@/scripts/gemini-schema-matrix";
import type { MatrixClient } from "@/scripts/gemini-schema-matrix";
import { investigationResponseJsonSchema } from "@/scripts/gemini-diagnostics-contract";

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

const SECRET = "AIzaSySECRETKEY1234567890";
function apiError(body: unknown, status = 400) {
  return new ApiError({ message: JSON.stringify(body), status });
}

function client(generateContent: (args: { config?: Record<string, unknown> }) => Promise<unknown>): MatrixClient {
  return { models: { generateContent: generateContent as MatrixClient["models"]["generateContent"] } };
}

function logged(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, unknown>);
}

describe("schema matrix cases", () => {
  it("defines A-E with no schema for the control and the full schema at D", () => {
    const cases = createMatrixCases();
    expect(cases.map((c) => c.name.charAt(0))).toEqual(["A", "B", "C", "D", "E"]);
    expect(cases[4].name).toBe("E_full_schema_without_string_length_bounds");
    expect(cases[4].simplePrompt).toBe(cases[3].simplePrompt);
    expect(cases[0].schema).toBeUndefined();
    expect(cases[3].schema).toBe(investigationResponseJsonSchema);
  });

  it("shows C drops the bounds that D uses", () => {
    const [, , c, d] = createMatrixCases();
    expect(undocumentedKeywords(c.schema)).toEqual([]);
    expect(collectSchemaKeywords(d.schema)).toEqual(expect.arrayContaining(["minLength", "maxLength", "maxItems", "minItems", "description"]));
    expect(undocumentedKeywords(d.schema)).toEqual(["maxLength", "minLength"]);
  });
});

describe("removeStringLengthBounds", () => {
  it("recursively removes only minLength/maxLength without mutating the input", () => {
    const input = {
      type: "object",
      properties: {
        minLength: { type: "string", minLength: 1, maxLength: 5, description: "d" },
        list: { type: "array", minItems: 1, maxItems: 2, items: { type: "string", maxLength: 3, enum: ["a"] } },
      },
      required: ["list"],
    };
    const snapshot = structuredClone(input);
    const out = removeStringLengthBounds(input);
    expect(input).toEqual(snapshot);
    expect(out).toEqual({
      type: "object",
      properties: {
        minLength: { type: "string", description: "d" },
        list: { type: "array", minItems: 1, maxItems: 2, items: { type: "string", enum: ["a"] } },
      },
      required: ["list"],
    });
  });

  it("derives E from the full schema leaving D unchanged", () => {
    const snapshot = structuredClone(investigationResponseJsonSchema);
    const [, , , d, e] = createMatrixCases();
    expect(investigationResponseJsonSchema).toEqual(snapshot);
    expect(collectSchemaKeywords(d.schema)).toEqual(expect.arrayContaining(["minLength", "maxLength"]));
    expect(collectSchemaKeywords(e.schema)).toEqual(
      collectSchemaKeywords(d.schema).filter((k) => k !== "minLength" && k !== "maxLength"),
    );
    expect(undocumentedKeywords(e.schema)).toEqual([]);
  });
});

describe("safe error extraction", () => {
  it("keeps only allowlisted values", () => {
    const details = extractSafeApiErrorDetails(
      apiError({
        error: {
          code: 400,
          status: "INVALID_ARGUMENT",
          message: `Invalid JSON payload key=${SECRET}: unsupported keyword maxLength in prompt SECRET_PROMPT`,
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.BadRequest",
              reason: "API_KEY_INVALID",
              metadata: { secret: SECRET },
              fieldViolations: [
                { field: "generation_config.response_json_schema.properties[0].summary", description: SECRET },
                { field: "bad path with spaces & secrets", description: "x" },
              ],
            },
          ],
        },
      }),
    );
    expect(details).toEqual({
      apiStatus: "INVALID_ARGUMENT",
      reasons: ["API_KEY_INVALID"],
      invalidFieldPaths: ["generation_config.response_json_schema.properties[0].summary"],
      mentionedKeywords: ["maxLength"],
    });
    expect(JSON.stringify(details)).not.toContain(SECRET);
    expect(JSON.stringify(details)).not.toContain("SECRET_PROMPT");
  });

  it("returns nothing for non-API errors, non-JSON bodies and malformed shapes", () => {
    expect(extractSafeApiErrorDetails(new Error("boom"))).toEqual({});
    expect(extractSafeApiErrorDetails(new ApiError({ message: `<html>${SECRET}</html>`, status: 400 }))).toEqual({});
    expect(extractSafeApiErrorDetails(apiError({ error: { status: "lowercase bad", details: "x" } }))).toEqual({});
  });
});

describe("runMatrixCase", () => {
  it("reports 200 success for the control and sends no schema", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fn = vi.fn(async () => ({ text: '{"ok":"yes"}' }));
    await runMatrixCase(client(fn), createMatrixCases()[0], "gemini-test", 5000);
    const [row] = logged(spy);
    expect(row).toMatchObject({ case: "A_simple_json_no_schema", httpStatus: 200, outcome: "success", hasSchema: false });
    const config = (fn.mock.calls[0] as unknown[])[0] as { config: Record<string, unknown> };
    expect(config.config).not.toHaveProperty("responseJsonSchema");
    expect(config.config.responseMimeType).toBe("application/json");
  });

  it("logs sanitized details for HTTP 400 and never raw errors or secrets", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const err = apiError({
      error: { status: "INVALID_ARGUMENT", message: `bad ${SECRET} minLength`, details: [{ fieldViolations: [{ field: "a.b", description: SECRET }] }] },
    });
    await runMatrixCase(client(async () => Promise.reject(err)), createMatrixCases()[3], "gemini-test", 5000);
    const out = spy.mock.calls.map((c) => String(c[0])).join("\n");
    const [row] = logged(spy);
    expect(row).toMatchObject({
      case: "D_full_investigation_schema",
      httpStatus: 400,
      category: "upstream_http_400",
      errorDetails: { apiStatus: "INVALID_ARGUMENT", invalidFieldPaths: ["a.b"], mentionedKeywords: ["minLength"] },
    });
    expect(out).not.toContain(SECRET);
    expect(out).not.toContain("untrusted_events");
    expect(process.exitCode).toBe(1);
  });

  it("omits errorDetails for non-400 failures", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runMatrixCase(client(async () => Promise.reject(apiError({ error: { status: "UNAVAILABLE" } }, 503))), createMatrixCases()[1], "gemini-test", 5000);
    const [row] = logged(spy);
    expect(row).toMatchObject({ httpStatus: 503, category: "upstream_http_503" });
    expect(row).not.toHaveProperty("errorDetails");
  });
});
