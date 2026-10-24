import { describe, expect, it } from "vitest";
import { detectAnomalies, ingestEvents, normalizeAll, opsEventSchema } from "@/lib/events";
import type { OpsEvent } from "@/lib/events";
import { buildSimulatorScript, eventsUpTo, simulatorSource } from "@/lib/simulator/virtual-plug";

function make(id: string, timestamp: string, extra: Partial<OpsEvent> = {}): OpsEvent {
  return {
    id,
    source: { provider: "simulator", name: "t", simulated: true },
    type: "power.reading",
    timestamp,
    severity: "info",
    payload: {},
    ...extra,
  };
}

describe("schema", () => {
  it("accepts a valid event", () => {
    expect(opsEventSchema.safeParse(make("a", "2025-01-01T00:00:00.000Z")).success).toBe(true);
  });
  it("rejects invalid timestamp, severity and unknown keys", () => {
    expect(opsEventSchema.safeParse(make("a", "yesterday")).success).toBe(false);
    expect(opsEventSchema.safeParse({ ...make("a", "2025-01-01T00:00:00.000Z"), severity: "bad" }).success).toBe(false);
    expect(opsEventSchema.safeParse({ ...make("a", "2025-01-01T00:00:00.000Z"), extra: 1 }).success).toBe(false);
  });
  it("rejects simulator events not flagged simulated", () => {
    const bad = make("a", "2025-01-01T00:00:00.000Z", { source: { provider: "simulator", name: "t", simulated: false } });
    expect(opsEventSchema.safeParse(bad).success).toBe(false);
  });
  it("accepts real provider events as non-simulated", () => {
    const ok = make("a", "2025-01-01T00:00:00.000Z", { source: { provider: "shelly", name: "plug", simulated: false } });
    expect(opsEventSchema.safeParse(ok).success).toBe(true);
  });
});

describe("ingest", () => {
  it("orders events by timestamp then id", () => {
    const { events } = ingestEvents([], [make("b", "2025-01-01T00:00:05.000Z"), make("z", "2025-01-01T00:00:00.000Z"), make("a", "2025-01-01T00:00:05.000Z")]);
    expect(events.map((e) => e.id)).toEqual(["z", "a", "b"]);
  });
  it("rejects duplicate ids, first wins", () => {
    const first = make("a", "2025-01-01T00:00:00.000Z");
    const dup = make("a", "2025-01-01T00:00:09.000Z");
    const r = ingestEvents([first], [dup, make("b", "2025-01-01T00:00:01.000Z"), make("b", "2025-01-01T00:00:02.000Z")]);
    expect(r.events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(r.duplicates).toHaveLength(2);
    expect(r.events[0]).toBe(first);
  });
});

describe("anomaly rules", () => {
  const reading = (id: string, ts: string, powerW: number) => make(id, ts, { metrics: { powerW }, deviceId: "d" });
  it("flags spikes by threshold", () => {
    const a = detectAnomalies([reading("1", "2025-01-01T00:00:00.000Z", 45), reading("2", "2025-01-01T00:00:05.000Z", 600), reading("3", "2025-01-01T00:00:10.000Z", 1800)]);
    expect(a.map((x) => [x.eventId, x.severity])).toEqual([["2", "warning"], ["3", "critical"]]);
  });
  it("flags offline and recovery only after offline", () => {
    const a = detectAnomalies([
      make("0", "2025-01-01T00:00:00.000Z", { type: "device.online", deviceId: "d" }),
      make("1", "2025-01-01T00:00:05.000Z", { type: "device.offline", deviceId: "d" }),
      make("2", "2025-01-01T00:00:10.000Z", { type: "device.online", deviceId: "d" }),
    ]);
    expect(a.map((x) => x.rule)).toEqual(["device_offline", "device_recovered"]);
  });
});

describe("simulator", () => {
  it("is deterministic and valid", () => {
    const one = normalizeAll(simulatorSource);
    const two = normalizeAll(simulatorSource);
    expect(one.errors).toEqual([]);
    expect(one.events).toEqual(two.events);
    expect(one.events.every((e) => e.source.simulated)).toBe(true);
    expect(new Set(one.events.map((e) => e.id)).size).toBe(one.events.length);
    expect(buildSimulatorScript()).toEqual(buildSimulatorScript());
  });
  it("is already chronologically ordered", () => {
    const { events } = normalizeAll(simulatorSource);
    expect(ingestEvents([], events).events).toEqual(events);
  });
  it("contains normal, spike, offline and recovery phases", () => {
    const { events } = normalizeAll(simulatorSource);
    const rules = new Set(detectAnomalies(events).map((a) => a.rule));
    expect(rules).toEqual(new Set(["power_spike", "device_offline", "device_recovered"]));
    expect(eventsUpTo(events, 0)).toHaveLength(1);
  });
  it("reports invalid normalized output instead of throwing", () => {
    const r = normalizeAll(simulatorSource, [{ seq: 1, offsetMs: 0, kind: "reading", powerW: -5 }]);
    expect(r.events).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
  });
});
