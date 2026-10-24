import { z } from "zod";
import type { OpsEvent } from "@/lib/events";

export type GitHubLoad =
  | { status: "ready"; events: unknown[]; warnings: string[]; fetchedAt: string }
  | { status: "unavailable"; kind: string; message: string; resetAt?: string };

const responseSchema = z.union([
  z.object({
    ok: z.literal(true),
    events: z.array(z.unknown()),
    warnings: z.array(z.string()).optional(),
    fetchedAt: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({ kind: z.string().optional(), message: z.string().optional(), resetAt: z.string().optional() }).optional(),
  }),
]);

/** Interprets a /api/github/events response body. Never fabricates events. */
export function parseGitHubResponse(body: unknown): GitHubLoad {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    return { status: "unavailable", kind: "invalid_response", message: "The GitHub activity response was malformed." };
  }
  const data = parsed.data;
  if (data.ok) {
    return { status: "ready", events: data.events, warnings: data.warnings ?? [], fetchedAt: data.fetchedAt ?? "" };
  }
  return {
    status: "unavailable",
    kind: data.error?.kind ?? "upstream",
    message: data.error?.message ?? "Request failed.",
    resetAt: data.error?.resetAt,
  };
}

/** Events to feed into the timeline; empty whenever GitHub data is unavailable. */
export function githubEventsOf(load: GitHubLoad | null): readonly unknown[] {
  return load?.status === "ready" ? load.events : [];
}

/**
 * Explicit warning shown whenever the timeline has no GitHub events to display. Returns null while
 * loading or once GitHub events are present.
 */
export function githubFallbackWarning(load: GitHubLoad | null, githubEvents: readonly OpsEvent[]): string | null {
  if (load === null) return null;
  if (load.status === "unavailable") {
    const reason = load.kind === "rate_limited" ? "GitHub rate limit reached" : "GitHub data is unavailable";
    return `${reason}: ${load.message} Showing simulated events only; no GitHub events are substituted.`;
  }
  if (githubEvents.length === 0) {
    return "GitHub returned no usable events. Showing simulated events only; no GitHub events are substituted.";
  }
  return null;
}
