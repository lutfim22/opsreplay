import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const names = [
  "simple_json_without_schema",
  "simple_json_with_investigation_schema",
  "three_simulated_events_full_investigation",
] as const;

/** Parse only the existing diagnostic summaries. Never echo unexpected output. */
export function checkGeminiResults(text: string, model: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1 || lines.length > names.length) {
    throw new Error("Expected one to three ordered probe summaries.");
  }
  return lines.map((line, index) => {
    const value: unknown = JSON.parse(line);
    if (!value || typeof value !== "object") throw new Error("Invalid probe summary.");
    const row = value as Record<string, unknown>;
    const category = row.category;
    if (row.probe !== names[index] || row.model !== model ||
        !["success", "failure"].includes(String(row.outcome)) ||
        typeof category !== "string" ||
        !/^(success|schema_validation_failed|invalid_json_response|client_deadline_abort|client_error|upstream_http_[1-5][0-9]{2})$/.test(category) ||
        !(row.httpStatus === null || (Number.isInteger(row.httpStatus) && Number(row.httpStatus) >= 100 && Number(row.httpStatus) <= 599)) ||
        typeof row.durationMs !== "number" || !Number.isFinite(row.durationMs) || row.durationMs < 0 ||
        row.eventCount !== (index === 2 ? 3 : 0)) {
      throw new Error("Invalid probe summary.");
    }
    // Whitelist fields rather than printing arbitrary parsed properties.
    return { probe: names[index], model, durationMs: row.durationMs, httpStatus: row.httpStatus,
      category, outcome: row.outcome };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const model = process.env.GEMINI_MODEL ?? "";
    if (!/^gemini-[a-z0-9][a-z0-9.-]{0,63}$/.test(model)) throw new Error("Invalid model.");
    const rows = checkGeminiResults(readFileSync(process.argv[2], "utf8"), model);
    for (const row of rows) console.log(JSON.stringify(row));
    if (rows.length !== names.length || rows.some((row) => row.outcome !== "success" || row.category !== "success" || row.httpStatus !== 200)) {
      process.exitCode = 1;
    }
  } catch {
    console.error("Gemini summary validation failed; raw output withheld.");
    process.exitCode = 1;
  }
}
