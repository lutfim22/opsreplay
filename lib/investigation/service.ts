import { InvestigationError } from "@/lib/investigation/errors";
import type { InvestigationConfig } from "@/lib/investigation/config";
import { findEvidenceProblems } from "@/lib/investigation/evidence";
import { buildUserPrompt, SYSTEM_INSTRUCTION } from "@/lib/investigation/prompt";
import { investigationResponseJsonSchema, investigationResultSchema } from "@/lib/investigation/schema";
import type { InvestigateRequest, InvestigateSuccess } from "@/lib/investigation/schema";

export interface GeneratorRequest {
  model: string;
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: typeof investigationResponseJsonSchema;
  timeoutMs: number;
}

/** Returns the model's raw JSON text. Implementations throw InvestigationError on failure. */
export type Generator = (request: GeneratorRequest) => Promise<string>;

/**
 * Runs one investigation. Output is never trusted: it must be valid JSON, match the result
 * schema, and cite only event ids that were actually submitted. There is no fallback analysis.
 */
export async function investigate(
  request: InvestigateRequest,
  generate: Generator,
  config: Pick<InvestigationConfig, "model" | "timeoutMs">,
): Promise<InvestigateSuccess> {
  const text = await generate({
    model: config.model,
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: buildUserPrompt(request.events, { demoAlignment: request.demoAlignment }),
    responseJsonSchema: investigationResponseJsonSchema,
    timeoutMs: config.timeoutMs,
  });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvestigationError("invalid_model_output");
  }
  const parsed = investigationResultSchema.safeParse(json);
  if (!parsed.success) throw new InvestigationError("invalid_model_output");

  const problems = findEvidenceProblems(parsed.data, request.events);
  if (problems.length > 0) {
    console.warn("[investigate] discarded response with untraceable evidence", { references: problems.length });
    throw new InvestigationError("invalid_model_output");
  }

  return {
    ok: true,
    result: parsed.data,
    meta: { model: config.model, eventCount: request.events.length, generatedAt: new Date().toISOString() },
  };
}
