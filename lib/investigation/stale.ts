import type { OpsEvent } from "@/lib/events/schema";

export function captureInvestigationInput(events: readonly OpsEvent[], demoAlignment: boolean) {
  return { events: [...events], demoAlignment };
}

/** Compare the complete payload sent to /api/investigate, ignoring event display order. */
export function isInvestigationStale(
  submitted: { events: readonly OpsEvent[]; demoAlignment: boolean },
  current: { events: readonly OpsEvent[]; demoAlignment: boolean },
): boolean {
  if (submitted.demoAlignment !== current.demoAlignment) return true;
  const canonical = (events: readonly OpsEvent[]) =>
    JSON.stringify([...events].sort((a, b) => a.id.localeCompare(b.id)));
  return canonical(submitted.events) !== canonical(current.events);
}
