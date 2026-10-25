import type { OpsEvent } from "@/lib/events/schema";
import { investigateFailureSchema, investigateSuccessSchema } from "@/lib/investigation/schema";
import type { InvestigateSuccess, InvestigationErrorKind } from "@/lib/investigation/schema";

export interface InvestigationFailed {
  status: "error";
  kind: InvestigationErrorKind | "network" | "invalid_response";
  message: string;
  retryAfterSeconds?: number;
}

/** `eventIds` are the events that were submitted, used to detect a stale analysis. */
export interface InvestigationReady {
  status: "ready";
  data: InvestigateSuccess;
  eventIds: string[];
}

export type InvestigationLoad = InvestigationReady | InvestigationFailed;

/** Interprets a /api/investigate response body. Anything unexpected is an error, never an analysis. */
export function parseInvestigateResponse(body: unknown): { status: "ready"; data: InvestigateSuccess } | InvestigationFailed {
  const success = investigateSuccessSchema.safeParse(body);
  if (success.success) return { status: "ready", data: success.data };
  const failure = investigateFailureSchema.safeParse(body);
  if (failure.success) {
    const { kind, message, retryAfterSeconds } = failure.data.error;
    return { status: "error", kind, message, retryAfterSeconds };
  }
  return { status: "error", kind: "invalid_response", message: "The investigation response was malformed and was discarded." };
}

export async function requestInvestigation(
  events: readonly OpsEvent[],
  options: { demoAlignment: boolean; signal?: AbortSignal },
): Promise<InvestigationLoad> {
  try {
    const res = await fetch("/api/investigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events, demoAlignment: options.demoAlignment }),
      signal: options.signal,
    });
    const parsed = parseInvestigateResponse(await res.json().catch(() => null));
    return parsed.status === "ready" ? { ...parsed, eventIds: events.map((e) => e.id) } : parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { status: "error", kind: "network", message: "Could not reach the OpsReplay server." };
  }
}
