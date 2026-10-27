import type { InvestigationErrorKind } from "@/lib/investigation/schema";

export const ERROR_STATUS: Record<InvestigationErrorKind, number> = {
  invalid_input: 400,
  forbidden: 403,
  payload_too_large: 413,
  rate_limited: 429,
  quota: 429,
  not_configured: 503,
  quota_unavailable: 503,
  timeout: 504,
  upstream: 502,
  invalid_model_output: 502,
};

/** Messages are fixed strings so that upstream error text (which may echo input) is never relayed. */
export const ERROR_MESSAGE: Record<InvestigationErrorKind, string> = {
  invalid_input: "The selected events are not valid.",
  forbidden: "Cross-origin requests are not allowed.",
  payload_too_large: "The selected events are too large to analyze. Narrow the timeline filters and try again.",
  rate_limited: "Too many investigation requests. Please wait a moment and try again.",
  not_configured: "AI investigation is not configured on this server. Set GEMINI_API_KEY to enable it.",
  quota_unavailable: "Investigation is temporarily unavailable. Please try again later.",
  timeout: "The AI model took too long to respond. Please try again.",
  quota: "The Gemini API quota or rate limit was reached. Please try again later.",
  upstream: "The Gemini API request failed. Please try again.",
  invalid_model_output: "The AI response did not pass evidence validation and was discarded. Please try again.",
};

export class InvestigationError extends Error {
  readonly kind: InvestigationErrorKind;
  readonly retryAfterSeconds?: number;

  constructor(kind: InvestigationErrorKind, options: { message?: string; retryAfterSeconds?: number } = {}) {
    super(options.message ?? ERROR_MESSAGE[kind]);
    this.name = "InvestigationError";
    this.kind = kind;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
