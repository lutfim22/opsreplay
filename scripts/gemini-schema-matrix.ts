import { pathToFileURL } from "node:url";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getSimulatedEvents } from "@/lib/timeline";
import {
  buildUserPrompt,
  investigationResponseJsonSchema,
  investigationResultSchema,
  SYSTEM_INSTRUCTION,
} from "@/scripts/gemini-diagnostics-contract";
import { classifyDiagnosticFailure, readDiagnosticConfig } from "@/scripts/gemini-diagnostics";

/**
 * Schema diagnostic matrix (separate from the three original probes). It isolates which part of the
 * investigation response schema makes Gemini structured output return HTTP 400. Same model, same
 * generation settings; only `responseJsonSchema` (and, for A/B, the trivial prompt) differs.
 */

export interface MatrixCase {
  name: string;
  schema: unknown;
  simplePrompt: boolean;
}

export const MINIMAL_SCHEMA = {
  type: "object",
  properties: { ok: { type: "string" } },
  required: ["ok"],
} as const;

/** Same structure and required fields as the full schema, but no length/count bounds or descriptions. */
export const ESSENTIAL_INVESTIGATION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    observedFacts: {
      type: "array",
      items: {
        type: "object",
        properties: { statement: { type: "string" }, eventIds: { type: "array", items: { type: "string" } } },
        required: ["statement", "eventIds"],
      },
    },
    hypotheses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          supportingEventIds: { type: "array", items: { type: "string" } },
          reasoning: { type: "string" },
          missingEvidence: { type: "array", items: { type: "string" } },
        },
        required: ["title", "confidence", "supportingEventIds", "reasoning", "missingEvidence"],
      },
    },
    recommendedNextChecks: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "observedFacts", "hypotheses", "recommendedNextChecks", "limitations"],
} as const;

export const SIMPLE_PROMPT = 'Return only a JSON object with one property: {"ok": "yes"}.';

const STRING_LENGTH_KEYWORDS: ReadonlySet<string> = new Set(["minLength", "maxLength"]);

/** Deep copy of a schema with only `minLength`/`maxLength` keywords removed; the input is not modified. */
export function removeStringLengthBounds<T>(node: T, isPropertyMap = false): T {
  if (Array.isArray(node)) return node.map((item) => removeStringLengthBounds(item)) as T;
  if (typeof node !== "object" || node === null) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!isPropertyMap && STRING_LENGTH_KEYWORDS.has(key)) continue;
    out[key] = removeStringLengthBounds(value, !isPropertyMap && key === "properties");
  }
  return out as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep copy of `base` plus only the listed keywords taken from the node at the same schema path in `source`
 * (through `properties` and `items`). Neither input is modified; keywords are never added to missing paths.
 */
export function addKeywordsFromSource<T>(base: T, source: unknown, keywords: readonly string[]): T {
  if (!isPlainObject(base)) return structuredClone(base);
  const src = isPlainObject(source) ? source : {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    if (key === "properties" && isPlainObject(value)) {
      const srcProps = isPlainObject(src.properties) ? src.properties : {};
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, addKeywordsFromSource(child, srcProps[name], keywords)]),
      );
    } else if (key === "items") {
      out.items = addKeywordsFromSource(value, src.items, keywords);
    } else {
      out[key] = structuredClone(value);
    }
  }
  for (const keyword of keywords) {
    if (keyword in src && !(keyword in out)) out[keyword] = structuredClone(src[keyword]);
  }
  return out as T;
}

export function createMatrixCases(): MatrixCase[] {
  return [
    { name: "A_simple_json_no_schema", schema: undefined, simplePrompt: true },
    { name: "B_minimal_schema_one_string", schema: MINIMAL_SCHEMA, simplePrompt: true },
    { name: "C_essential_investigation_schema", schema: ESSENTIAL_INVESTIGATION_SCHEMA, simplePrompt: false },
    { name: "D_full_investigation_schema", schema: investigationResponseJsonSchema, simplePrompt: false },
    {
      name: "E_full_schema_without_string_length_bounds",
      schema: removeStringLengthBounds(investigationResponseJsonSchema),
      simplePrompt: false,
    },
    {
      name: "F_essential_schema_with_descriptions",
      schema: addKeywordsFromSource(ESSENTIAL_INVESTIGATION_SCHEMA, investigationResponseJsonSchema, ["description"]),
      simplePrompt: false,
    },
    {
      name: "G_essential_schema_with_array_bounds",
      schema: addKeywordsFromSource(ESSENTIAL_INVESTIGATION_SCHEMA, investigationResponseJsonSchema, ["minItems", "maxItems"]),
      simplePrompt: false,
    },
  ];
}

const SCHEMA_KEYWORDS = [
  "$id", "$defs", "$ref", "$anchor", "type", "format", "title", "description", "enum", "items", "prefixItems",
  "minItems", "maxItems", "minimum", "maximum", "minLength", "maxLength", "pattern", "anyOf", "oneOf", "allOf",
  "properties", "additionalProperties", "required", "propertyOrdering", "default", "const", "nullable",
] as const;

/** Keywords the @google/genai `responseJsonSchema` documentation lists as supported. */
export const DOCUMENTED_SUPPORTED_KEYWORDS: ReadonlySet<string> = new Set([
  "$id", "$defs", "$ref", "$anchor", "type", "format", "title", "description", "enum", "items", "prefixItems",
  "minItems", "maxItems", "minimum", "maximum", "anyOf", "oneOf", "properties", "additionalProperties",
  "required", "propertyOrdering",
]);

/** Static, local analysis: which schema keywords a schema uses. Never involves the API. */
export function collectSchemaKeywords(schema: unknown): string[] {
  const found = new Set<string>();
  const known = new Set<string>(SCHEMA_KEYWORDS);
  const walk = (node: unknown, isPropertyMap = false): void => {
    if (Array.isArray(node)) return node.forEach((item) => walk(item));
    if (typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (isPropertyMap) walk(value);
      else {
        if (known.has(key)) found.add(key);
        if (key === "properties") walk(value, true);
        else if (key === "items" || key === "anyOf" || key === "oneOf" || key === "additionalProperties") walk(value);
      }
    }
  };
  walk(schema);
  return [...found].sort();
}

export function undocumentedKeywords(schema: unknown): string[] {
  return collectSchemaKeywords(schema).filter((keyword) => !DOCUMENTED_SUPPORTED_KEYWORDS.has(keyword));
}

export interface SafeApiErrorDetails {
  apiStatus?: string;
  reasons?: string[];
  invalidFieldPaths?: string[];
  mentionedKeywords?: string[];
}

const API_STATUS_PATTERN = /^[A-Z][A-Z_]{2,39}$/;
const REASON_PATTERN = /^[A-Z][A-Z0-9_]{2,59}$/;
const FIELD_PATH_PATTERN = /^[A-Za-z0-9_$]+(?:(?:\.[A-Za-z0-9_$]+)|(?:\[\d{1,3}\]))*$/;
const MAX_ITEMS = 10;
const MAX_FIELD_PATH = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts a strict allowlist from an SDK ApiError: the Google error `status` enum, detail `reason`
 * enums, `fieldViolations[].field` paths, and which known schema keyword names the message mentions.
 * Free-text messages, descriptions, metadata, headers, URLs and any other values are discarded, and each
 * kept value must match a restrictive pattern.
 */
export function extractSafeApiErrorDetails(error: unknown): SafeApiErrorDetails {
  if (!(error instanceof ApiError)) return {};
  let body: unknown;
  try {
    body = JSON.parse(error.message);
  } catch {
    return {};
  }
  const err = isRecord(body) && isRecord(body.error) ? body.error : undefined;
  if (!err) return {};

  const details: SafeApiErrorDetails = {};
  if (typeof err.status === "string" && API_STATUS_PATTERN.test(err.status)) details.apiStatus = err.status;

  const reasons = new Set<string>();
  const paths = new Set<string>();
  if (Array.isArray(err.details)) {
    for (const detail of err.details.slice(0, 20)) {
      if (!isRecord(detail)) continue;
      if (typeof detail.reason === "string" && REASON_PATTERN.test(detail.reason)) reasons.add(detail.reason);
      if (Array.isArray(detail.fieldViolations)) {
        for (const violation of detail.fieldViolations.slice(0, 20)) {
          const field = isRecord(violation) ? violation.field : undefined;
          if (typeof field === "string" && field.length <= MAX_FIELD_PATH && FIELD_PATH_PATTERN.test(field)) paths.add(field);
        }
      }
    }
  }
  if (reasons.size) details.reasons = [...reasons].slice(0, MAX_ITEMS);
  if (paths.size) details.invalidFieldPaths = [...paths].slice(0, MAX_ITEMS);

  if (typeof err.message === "string") {
    const message = err.message;
    const mentioned = SCHEMA_KEYWORDS.filter((keyword) =>
      new RegExp(`(?<![A-Za-z0-9_$])${keyword.replace(/[.*+?^${}()|[\]\\$]/g, "\\$&")}(?![A-Za-z0-9_$])`).test(message),
    );
    // Generic words such as "type" or "required" occur in many messages; only report distinctive keywords.
    const distinctive = mentioned.filter((keyword) => !["type", "title", "description", "default", "required", "items", "properties", "format"].includes(keyword));
    if (distinctive.length) details.mentionedKeywords = distinctive.slice(0, MAX_ITEMS);
  }
  return details;
}

export interface MatrixClient {
  models: { generateContent: GoogleGenAI["models"]["generateContent"] };
}

export async function runMatrixCase(client: MatrixClient, testCase: MatrixCase, model: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  const events = testCase.simplePrompt ? [] : (() => {
    const all = getSimulatedEvents();
    return [
      all.find((e) => e.type === "power.reading" && (e.metrics?.powerW ?? 0) >= 1500),
      all.find((e) => e.type === "device.offline"),
      all.find((e) => e.type === "device.online"),
    ].filter((e): e is NonNullable<typeof e> => e !== undefined);
  })();
  const prompt = testCase.simplePrompt ? SIMPLE_PROMPT : buildUserPrompt(events);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base = {
    case: testCase.name,
    model,
    hasSchema: testCase.schema !== undefined,
    schemaKeywords: collectSchemaKeywords(testCase.schema),
    undocumentedKeywords: undocumentedKeywords(testCase.schema),
    promptBytes: Buffer.byteLength(prompt, "utf8"),
  };
  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        ...(testCase.simplePrompt ? {} : { systemInstruction: SYSTEM_INSTRUCTION }),
        responseMimeType: "application/json",
        ...(testCase.schema !== undefined ? { responseJsonSchema: testCase.schema } : {}),
        ...(/^gemini-3(?:[.-]|$)/i.test(model)
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : { temperature: 0.2 }),
        maxOutputTokens: 8192,
        abortSignal: controller.signal,
        httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1, httpStatusCodes: [] } },
      },
    });
    let valid = false;
    try {
      const json: unknown = JSON.parse(response.text ?? "");
      valid = testCase.simplePrompt ? true : investigationResultSchema.safeParse(json).success;
    } catch {
      valid = false;
    }
    console.log(JSON.stringify({ ...base, durationMs: Date.now() - startedAt, httpStatus: 200, category: valid ? "success" : "invalid_json_response", outcome: valid ? "success" : "failure" }));
    if (!valid) process.exitCode = 1;
  } catch (error) {
    const failure = classifyDiagnosticFailure(error);
    console.log(
      JSON.stringify({
        ...base,
        durationMs: Date.now() - startedAt,
        ...failure,
        outcome: "failure",
        ...(failure.httpStatus === 400 ? { errorDetails: extractSafeApiErrorDetails(error) } : {}),
      }),
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
  }
}

export async function runSchemaMatrix(): Promise<void> {
  const config = readDiagnosticConfig();
  if (!config.apiKey) {
    console.error("GEMINI_API_KEY is not set; no Gemini requests were sent.");
    process.exitCode = 1;
    return;
  }
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  for (const testCase of createMatrixCases()) {
    await runMatrixCase(ai, testCase, config.model, config.timeoutMs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runSchemaMatrix().catch(() => {
    console.error("Gemini schema matrix stopped before completing; no request details were logged.");
    process.exitCode = 1;
  });
}
