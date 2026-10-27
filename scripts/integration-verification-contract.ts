import { z } from "zod";

export const INTEGRATION_TARGET_SHA = "29801e52385cf8a7ceb481157e727f8bebec66f7";
export const INTEGRATION_PROBE = "reduced_schema_investigation";
export const MODEL_PATTERN = /^gemini-[a-z0-9][a-z0-9.-]{0,63}$/;

export const integrationSummarySchema = z.object({
  probe: z.literal(INTEGRATION_PROBE),
  targetSha: z.literal(INTEGRATION_TARGET_SHA),
  model: z.string().regex(MODEL_PATTERN),
  timeoutMs: z.number().int().min(1000).max(25000),
  attempts: z.number().int().min(0).max(1),
  eventCount: z.literal(3),
  durationMs: z.number().finite().nonnegative(),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  category: z.string().regex(/^(success|invalid_model_output|payload_too_large|client_deadline_abort|client_error|upstream_http_[1-5][0-9]{2})$/),
  outcome: z.enum(["success", "failure"]),
  validation: z.enum(["passed", "failed", "not_run"]),
}).strict();

export type IntegrationSummary = z.infer<typeof integrationSummarySchema>;

/** No defaults or silent model substitution in an approved provider test. */
export function verificationInputs(env: Record<string, string | undefined>) {
  const model = env.GEMINI_MODEL ?? "";
  const rawTimeout = env.GEMINI_TIMEOUT_MS ?? "";
  const timeoutMs = Number(rawTimeout);
  if (!MODEL_PATTERN.test(model) || !/^[1-9][0-9]{3,4}$/.test(rawTimeout) || timeoutMs > 25000) {
    throw new Error("Verification requires an explicit model and a 1000-25000 ms timeout.");
  }
  return { model, timeoutMs };
}
