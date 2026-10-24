import type { EventSource } from "@/lib/events/source";
import type { OpsEvent } from "@/lib/events/schema";

export const SIMULATOR_DEVICE_ID = "sim-plug-01";
export const SIMULATOR_START = "2025-01-01T09:00:00.000Z";
export const SIMULATOR_STEP_MS = 5_000;
export const SIMULATOR_DURATION_MS = 300_000;

export type RawSimulatorRecord =
  | { seq: number; offsetMs: number; kind: "reading"; powerW: number }
  | { seq: number; offsetMs: number; kind: "offline" | "online" };

const NORMAL_PATTERN = [42, 44, 43, 45, 44, 46, 43, 45] as const;
const SPIKE_START_MS = 100_000;
const SPIKE_END_MS = 115_000;
const OFFLINE_START_MS = 180_000;
const ONLINE_MS = 215_000;

function powerAt(offsetMs: number, index: number): number {
  if (offsetMs >= SPIKE_START_MS && offsetMs < SPIKE_END_MS) return [820, 1850, 1720][(offsetMs - SPIKE_START_MS) / SIMULATOR_STEP_MS] ?? 1800;
  return NORMAL_PATTERN[index % NORMAL_PATTERN.length] ?? 44;
}

/** Fixed script: no randomness, no clock reads. */
export function buildSimulatorScript(): RawSimulatorRecord[] {
  const records: RawSimulatorRecord[] = [];
  let seq = 0;
  for (let offsetMs = 0, index = 0; offsetMs < SIMULATOR_DURATION_MS; offsetMs += SIMULATOR_STEP_MS, index++) {
    if (offsetMs === OFFLINE_START_MS) records.push({ seq: seq++, offsetMs, kind: "offline" });
    if (offsetMs === ONLINE_MS) records.push({ seq: seq++, offsetMs, kind: "online" });
    if (offsetMs >= OFFLINE_START_MS && offsetMs < ONLINE_MS) continue;
    records.push({ seq: seq++, offsetMs, kind: "reading", powerW: powerAt(offsetMs, index) });
  }
  return records;
}

export const simulatorSource: EventSource<RawSimulatorRecord> = {
  ref: { provider: "simulator", name: "virtual-smart-plug", simulated: true },
  readRaw: buildSimulatorScript,
  normalize(raw): OpsEvent {
    const base = {
      id: `sim-${String(raw.seq).padStart(4, "0")}`,
      source: simulatorSource.ref,
      timestamp: new Date(Date.parse(SIMULATOR_START) + raw.offsetMs).toISOString(),
      deviceId: SIMULATOR_DEVICE_ID,
    };
    if (raw.kind === "reading") {
      return {
        ...base,
        type: "power.reading",
        severity: "info",
        metrics: { powerW: raw.powerW, voltageV: 230 },
        payload: { simulated: true },
      };
    }
    return {
      ...base,
      type: raw.kind === "offline" ? "device.offline" : "device.online",
      severity: raw.kind === "offline" ? "critical" : "info",
      payload: { simulated: true },
    };
  },
};

/** Events that would have been emitted once `elapsedMs` of simulated time passed. */
export function eventsUpTo(events: readonly OpsEvent[], elapsedMs: number): OpsEvent[] {
  const limit = Date.parse(SIMULATOR_START) + elapsedMs;
  return events.filter((event) => Date.parse(event.timestamp) <= limit);
}
