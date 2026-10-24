import { describe, expect, it } from "vitest";
import type { OpsEvent } from "@/lib/events";
import {
  buildTimeline,
  computeAlignment,
  filterTimeline,
  formatUtc,
  getGitHubUrl,
  getSimulatedEvents,
  githubEventsOf,
  githubFallbackWarning,
  mergeEvents,
  parseGitHubResponse,
  summarizeTimeline,
} from "@/lib/timeline";

const gh = (id: string, timestamp: string, extra: Partial<OpsEvent> = {}): OpsEvent => ({
  id,
  source: { provider: "github", name: "o/r", simulated: false },
  type: "github.commit",
  timestamp,
  severity: "info",
  payload: { url: "https://github.com/o/r/commit/abc", sha: "abcdef0", title: "Fix", author: "dev" },
  ...extra,
});

const GH_EVENTS = [
  gh("g1", "2026-03-01T10:00:00.000Z"),
  gh("g2", "2026-03-02T12:00:00.000Z", { type: "github.workflow_run", severity: "warning", payload: { name: "CI", runNumber: 3, conclusion: "failure" } }),
];

describe("mergeEvents", () => {
  const sim = getSimulatedEvents();

  it("combines both sources in chronological order", () => {
    const { events } = mergeEvents(sim, GH_EVENTS);
    expect(events).toHaveLength(sim.length + GH_EVENTS.length);
    const times = events.map((e) => Date.parse(e.timestamp));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(events[0]?.source.simulated).toBe(true);
    expect(events.at(-1)?.id).toBe("g2");
  });

  it("is independent of input order", () => {
    expect(mergeEvents([...sim].reverse(), [...GH_EVENTS].reverse()).events).toEqual(mergeEvents(sim, GH_EVENTS).events);
  });

  it("orders ties by id", () => {
    const { events } = mergeEvents([], [gh("b", "2026-03-01T10:00:00.000Z"), gh("a", "2026-03-01T10:00:00.000Z")]);
    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("deduplicates by id, first wins", () => {
    const dup = gh("g1", "2026-04-01T00:00:00.000Z");
    const result = mergeEvents(sim, [...GH_EVENTS, dup]);
    expect(result.duplicates).toBe(1);
    expect(result.events.find((e) => e.id === "g1")?.timestamp).toBe("2026-03-01T10:00:00.000Z");
  });

  it("rejects invalid events and wrong-side provenance", () => {
    const fakeGitHubFromIot = gh("x", "2026-03-01T10:00:00.000Z");
    const simulatedAsGitHub = { ...gh("y", "2026-03-01T10:00:00.000Z"), source: { provider: "github", name: "o/r", simulated: true } };
    const result = mergeEvents([fakeGitHubFromIot], [{ nope: 1 }, simulatedAsGitHub, sim[0]]);
    expect(result.events).toHaveLength(0);
    expect(result.rejected).toBe(4);
  });

  it("does not mutate inputs", () => {
    const copy = structuredClone(GH_EVENTS);
    buildTimeline({ iot: sim, github: GH_EVENTS, alignTime: true });
    expect(GH_EVENTS).toEqual(copy);
  });
});

describe("buildTimeline", () => {
  it("annotates anomalies and raises effective severity without changing the event", () => {
    const model = buildTimeline({ iot: getSimulatedEvents(), github: GH_EVENTS });
    const spike = model.entries.find((e) => e.anomaly?.rule === "power_spike" && e.severity === "critical");
    expect(spike).toBeDefined();
    expect(spike?.event.severity).toBe("info");
    expect(model.entries.some((e) => e.category === "github" && e.anomaly)).toBe(false);
  });

  it("is deterministic", () => {
    const a = buildTimeline({ iot: getSimulatedEvents(), github: GH_EVENTS, alignTime: true });
    const b = buildTimeline({ iot: getSimulatedEvents(), github: GH_EVENTS, alignTime: true });
    expect(a).toEqual(b);
  });
});

describe("filterTimeline", () => {
  const { entries } = buildTimeline({ iot: getSimulatedEvents(), github: GH_EVENTS });

  it("filters by source", () => {
    expect(filterTimeline(entries, { source: "github", severity: "all" }).every((e) => e.category === "github")).toBe(true);
    expect(filterTimeline(entries, { source: "iot", severity: "all" }).every((e) => e.category === "iot")).toBe(true);
    expect(filterTimeline(entries, { source: "all", severity: "all" })).toHaveLength(entries.length);
  });

  it("filters by severity and combines with source", () => {
    expect(filterTimeline(entries, { source: "all", severity: "warning" }).every((e) => e.severity === "warning")).toBe(true);
    const combined = filterTimeline(entries, { source: "github", severity: "warning" });
    expect(combined.map((e) => e.event.id)).toEqual(["g2"]);
    expect(filterTimeline(entries, { source: "github", severity: "critical" })).toEqual([]);
  });
});

describe("summarizeTimeline", () => {
  it("counts total, anomalies, sources and range", () => {
    const { entries } = buildTimeline({ iot: getSimulatedEvents(), github: GH_EVENTS });
    const summary = summarizeTimeline(entries);
    expect(summary.total).toBe(entries.length);
    expect(summary.bySource.github).toBe(2);
    expect(summary.bySource.iot + summary.bySource.github).toBe(summary.total);
    expect(summary.anomalies).toBe(entries.filter((e) => e.anomaly).length);
    expect(summary.anomalies).toBeGreaterThan(0);
    expect(summary.range).toEqual({ start: "2025-01-01T09:00:00.000Z", end: "2026-03-02T12:00:00.000Z" });
  });

  it("handles an empty selection", () => {
    expect(summarizeTimeline([])).toEqual({ total: 0, anomalies: 0, bySource: { iot: 0, github: 0 }, range: null });
  });
});

describe("demo time alignment", () => {
  const sim = getSimulatedEvents();

  it("is off by default and leaves display timestamps original", () => {
    const model = buildTimeline({ iot: sim, github: GH_EVENTS });
    expect(model.alignment).toEqual({ enabled: false, offsetMs: null, anchor: null });
    expect(model.entries.every((e) => e.alignedTimestamp === null && e.displayTimestamp === e.event.timestamp)).toBe(true);
  });

  it("aligns the end of the simulated window to the latest GitHub event, display-only", () => {
    const model = buildTimeline({ iot: sim, github: GH_EVENTS, alignTime: true });
    expect(model.alignment.anchor).toBe("2026-03-02T12:00:00.000Z");
    const simEntries = model.entries.filter((e) => e.category === "iot");
    expect(simEntries.at(-1)?.alignedTimestamp).toBe("2026-03-02T12:00:00.000Z");
    expect(simEntries.every((e) => e.event.timestamp.startsWith("2025-01-01"))).toBe(true);
    const spacing = (list: string[]) => list.map((t, i) => (i === 0 ? 0 : Date.parse(t) - Date.parse(list[i - 1] ?? t)));
    expect(spacing(simEntries.map((e) => e.alignedTimestamp ?? ""))).toEqual(spacing(simEntries.map((e) => e.event.timestamp)));
  });

  it("never touches GitHub timestamps and orders by display time", () => {
    const model = buildTimeline({ iot: sim, github: GH_EVENTS, alignTime: true });
    for (const entry of model.entries.filter((e) => e.category === "github")) {
      expect(entry.alignedTimestamp).toBeNull();
      expect(entry.displayTimestamp).toBe(entry.event.timestamp);
    }
    const times = model.entries.map((e) => Date.parse(e.displayTimestamp));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(model.entries.at(-1)?.displayTimestamp).toBe("2026-03-02T12:00:00.000Z");
  });

  it("is not possible without GitHub events", () => {
    const model = buildTimeline({ iot: sim, github: [], alignTime: true });
    expect(model.alignment).toEqual({ enabled: true, offsetMs: null, anchor: null });
    expect(model.entries.every((e) => e.alignedTimestamp === null)).toBe(true);
    expect(computeAlignment([], true).offsetMs).toBeNull();
  });
});

describe("missing GitHub data", () => {
  const sim = getSimulatedEvents();

  it("shows only simulated events and never fabricates GitHub events", () => {
    const model = buildTimeline({ iot: sim, github: githubEventsOf(null) });
    expect(model.githubEventCount).toBe(0);
    expect(model.entries).toHaveLength(sim.length);
    expect(model.entries.every((e) => e.event.source.simulated)).toBe(true);
  });

  it("treats rate limits and malformed responses as unavailable with an explicit warning", () => {
    const limited = parseGitHubResponse({ ok: false, error: { kind: "rate_limited", message: "GitHub API rate limit exceeded.", resetAt: "2026-03-01T00:00:00.000Z" } });
    expect(limited).toMatchObject({ status: "unavailable", kind: "rate_limited" });
    expect(githubEventsOf(limited)).toEqual([]);
    expect(githubFallbackWarning(limited, [])).toMatch(/rate limit.*simulated events only/i);

    const malformed = parseGitHubResponse("oops");
    expect(malformed).toMatchObject({ status: "unavailable", kind: "invalid_response" });
    expect(githubFallbackWarning(malformed, [])).toMatch(/simulated events only/i);
  });

  it("warns on an empty or fully invalid GitHub response", () => {
    const empty = parseGitHubResponse({ ok: true, events: [], warnings: [] });
    expect(empty.status).toBe("ready");
    expect(githubFallbackWarning(empty, [])).toMatch(/no usable events/i);
    const invalid = parseGitHubResponse({ ok: true, events: [{ bad: true }] });
    const model = buildTimeline({ iot: sim, github: githubEventsOf(invalid) });
    expect(model.rejected).toBe(1);
    expect(githubFallbackWarning(invalid, [])).not.toBeNull();
  });

  it("does not warn while loading or when GitHub events exist", () => {
    expect(githubFallbackWarning(null, [])).toBeNull();
    const ready = parseGitHubResponse({ ok: true, events: GH_EVENTS });
    expect(githubFallbackWarning(ready, GH_EVENTS)).toBeNull();
  });
});

describe("helpers", () => {
  it("accepts only https github.com record links", () => {
    expect(getGitHubUrl(gh("a", "2026-03-01T10:00:00.000Z"))).toBe("https://github.com/o/r/commit/abc");
    expect(getGitHubUrl(gh("a", "2026-03-01T10:00:00.000Z", { payload: { url: "javascript:alert(1)" } }))).toBeNull();
    expect(getGitHubUrl(gh("a", "2026-03-01T10:00:00.000Z", { payload: { url: "https://evil.example/x" } }))).toBeNull();
    expect(getGitHubUrl(getSimulatedEvents()[0] as OpsEvent)).toBeNull();
  });

  it("formats UTC timestamps deterministically", () => {
    expect(formatUtc("2025-01-01T09:00:05.000Z")).toBe("2025-01-01 09:00:05 UTC");
  });
});
