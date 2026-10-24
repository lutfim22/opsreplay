import { compareEvents, detectAnomalies, ingestEvents, opsEventSchema } from "@/lib/events";
import type { Anomaly, EventSeverity, OpsEvent } from "@/lib/events";

export type SourceCategory = "iot" | "github";
export type SourceFilter = "all" | SourceCategory;
export type SeverityFilter = "all" | EventSeverity;

export interface TimelineFilters {
  source: SourceFilter;
  severity: SeverityFilter;
}

export const DEFAULT_FILTERS: TimelineFilters = { source: "all", severity: "all" };

/**
 * A read-only view over one OpsEvent. `event` is the untouched original (original timestamp and
 * provenance). `alignedTimestamp` is display-only and only set for simulated events when Demo
 * Time Alignment is enabled.
 */
export interface TimelineEntry {
  event: OpsEvent;
  category: SourceCategory;
  /** Highest of the event severity and the severity of the anomaly detected on it. */
  severity: EventSeverity;
  anomaly: Anomaly | null;
  alignedTimestamp: string | null;
  /** Timestamp used for ordering and the visible range: aligned if present, otherwise original. */
  displayTimestamp: string;
}

export interface MergeResult {
  events: OpsEvent[];
  /** Events dropped because their id was already seen (first one wins). */
  duplicates: number;
  /** Inputs dropped because they failed OpsEvent validation or came from the wrong source side. */
  rejected: number;
}

export interface Alignment {
  enabled: boolean;
  /** Milliseconds added to simulated timestamps for display; null when alignment is not possible. */
  offsetMs: number | null;
  /** Latest GitHub timestamp the simulated window was aligned to. */
  anchor: string | null;
}

export interface TimelineModel extends MergeResult {
  entries: TimelineEntry[];
  alignment: Alignment;
  githubEventCount: number;
}

export interface TimelineSummary {
  total: number;
  anomalies: number;
  bySource: Record<SourceCategory, number>;
  range: { start: string; end: string } | null;
}

const SEVERITY_RANK: Record<EventSeverity, number> = { info: 0, warning: 1, critical: 2 };

export function sourceCategory(event: OpsEvent): SourceCategory {
  return event.source.provider === "github" ? "github" : "iot";
}

function maxSeverity(a: EventSeverity, b: EventSeverity): EventSeverity {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}

function validate(inputs: readonly unknown[], category: SourceCategory): { events: OpsEvent[]; rejected: number } {
  const events: OpsEvent[] = [];
  let rejected = 0;
  for (const input of inputs) {
    const parsed = opsEventSchema.safeParse(input);
    if (parsed.success && sourceCategory(parsed.data) === category) events.push(parsed.data);
    else rejected += 1;
  }
  return { events, rejected };
}

/**
 * Validates and merges IoT and GitHub events using the shared OpsEvent engine
 * (ordering by timestamp then id, first-wins id deduplication). GitHub input must come from the
 * github provider and IoT input must not, so one side can never masquerade as the other.
 */
export function mergeEvents(iotInput: readonly unknown[], githubInput: readonly unknown[]): MergeResult {
  const iot = validate(iotInput, "iot");
  const github = validate(githubInput, "github");
  const { events, duplicates } = ingestEvents([], [...iot.events, ...github.events]);
  return { events, duplicates: duplicates.length, rejected: iot.rejected + github.rejected };
}

/**
 * Display-only alignment: shifts the simulated window so that its last event lands on the
 * latest GitHub event. Uses no clock; returns null offset without both sides.
 */
export function computeAlignment(events: readonly OpsEvent[], enabled: boolean): Alignment {
  let latestGitHub: number | null = null;
  let latestSimulated: number | null = null;
  for (const event of events) {
    const ms = Date.parse(event.timestamp);
    if (event.source.provider === "github") latestGitHub = Math.max(latestGitHub ?? ms, ms);
    else if (event.source.simulated) latestSimulated = Math.max(latestSimulated ?? ms, ms);
  }
  if (!enabled || latestGitHub === null || latestSimulated === null) {
    return { enabled, offsetMs: null, anchor: null };
  }
  return { enabled, offsetMs: latestGitHub - latestSimulated, anchor: new Date(latestGitHub).toISOString() };
}

export function alignedTimestamp(event: OpsEvent, alignment: Alignment): string | null {
  if (alignment.offsetMs === null || !event.source.simulated) return null;
  return new Date(Date.parse(event.timestamp) + alignment.offsetMs).toISOString();
}

function compareEntries(a: TimelineEntry, b: TimelineEntry): number {
  return compareEvents(
    { ...a.event, timestamp: a.displayTimestamp },
    { ...b.event, timestamp: b.displayTimestamp },
  );
}

/** Builds the unified timeline. Original OpsEvents are never modified. */
export function buildTimeline(input: {
  iot: readonly unknown[];
  github: readonly unknown[];
  alignTime?: boolean;
}): TimelineModel {
  const merged = mergeEvents(input.iot, input.github);
  // Anomaly rules are stateful and need the original chronological order.
  const anomalyByEvent = new Map(detectAnomalies(merged.events).map((anomaly) => [anomaly.eventId, anomaly]));
  const alignment = computeAlignment(merged.events, input.alignTime ?? false);
  const entries = merged.events
    .map((event): TimelineEntry => {
      const anomaly = anomalyByEvent.get(event.id) ?? null;
      const aligned = alignedTimestamp(event, alignment);
      return {
        event,
        category: sourceCategory(event),
        severity: anomaly ? maxSeverity(event.severity, anomaly.severity) : event.severity,
        anomaly,
        alignedTimestamp: aligned,
        displayTimestamp: aligned ?? event.timestamp,
      };
    })
    .sort(compareEntries);
  return {
    ...merged,
    entries,
    alignment,
    githubEventCount: entries.filter((entry) => entry.category === "github").length,
  };
}

export function filterTimeline(entries: readonly TimelineEntry[], filters: TimelineFilters): TimelineEntry[] {
  return entries.filter(
    (entry) =>
      (filters.source === "all" || entry.category === filters.source) &&
      (filters.severity === "all" || entry.severity === filters.severity),
  );
}

/** Summary of the given (typically filtered/visible) entries. */
export function summarizeTimeline(entries: readonly TimelineEntry[]): TimelineSummary {
  const bySource: Record<SourceCategory, number> = { iot: 0, github: 0 };
  let anomalies = 0;
  let start: number | null = null;
  let end: number | null = null;
  for (const entry of entries) {
    bySource[entry.category] += 1;
    if (entry.anomaly) anomalies += 1;
    const ms = Date.parse(entry.displayTimestamp);
    start = start === null ? ms : Math.min(start, ms);
    end = end === null ? ms : Math.max(end, ms);
  }
  return {
    total: entries.length,
    anomalies,
    bySource,
    range: start === null || end === null ? null : { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
  };
}

/** "2025-01-01 09:00:00 UTC" — deterministic, timezone independent. */
export function formatUtc(timestamp: string): string {
  return `${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)} UTC`;
}
