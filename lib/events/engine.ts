import type { OpsEvent } from "@/lib/events/schema";

export interface IngestResult {
  events: OpsEvent[];
  accepted: OpsEvent[];
  duplicates: OpsEvent[];
}

export function compareEvents(a: OpsEvent, b: OpsEvent): number {
  const diff = Date.parse(a.timestamp) - Date.parse(b.timestamp);
  if (diff !== 0) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Pure ingestion: merges incoming events into an existing, ordered list.
 * Events whose id was already seen are rejected (first one wins).
 * The result is ordered by timestamp, then id.
 */
export function ingestEvents(existing: readonly OpsEvent[], incoming: readonly OpsEvent[]): IngestResult {
  const seen = new Set(existing.map((event) => event.id));
  const accepted: OpsEvent[] = [];
  const duplicates: OpsEvent[] = [];
  for (const event of incoming) {
    if (seen.has(event.id)) {
      duplicates.push(event);
    } else {
      seen.add(event.id);
      accepted.push(event);
    }
  }
  const events = [...existing, ...accepted].sort(compareEvents);
  return { events, accepted, duplicates };
}
