import type { EventSeverity, OpsEvent } from "@/lib/events/schema";

export const POWER_SPIKE_WARNING_W = 500;
export const POWER_SPIKE_CRITICAL_W = 1500;

export type AnomalyRule = "power_spike" | "device_offline" | "device_recovered";

export interface Anomaly {
  eventId: string;
  rule: AnomalyRule;
  severity: EventSeverity;
  message: string;
}

/** Deterministic, rule-based detection. Events are expected in chronological order. */
export function detectAnomalies(events: readonly OpsEvent[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const offline = new Set<string>();
  for (const event of events) {
    const device = event.deviceId ?? "unknown";
    const stateKey = JSON.stringify([
      event.source.provider,
      event.source.name,
      event.source.simulated,
      event.deviceId ?? null,
    ]);
    const powerW = event.metrics?.powerW;
    if (event.type === "device.offline") {
      offline.add(stateKey);
      anomalies.push({ eventId: event.id, rule: "device_offline", severity: "critical", message: `${device} went offline` });
    } else if (event.type === "device.online" && offline.delete(stateKey)) {
      anomalies.push({ eventId: event.id, rule: "device_recovered", severity: "info", message: `${device} recovered` });
    } else if (event.type === "power.reading" && powerW !== undefined && powerW >= POWER_SPIKE_WARNING_W) {
      const critical = powerW >= POWER_SPIKE_CRITICAL_W;
      anomalies.push({
        eventId: event.id,
        rule: "power_spike",
        severity: critical ? "critical" : "warning",
        message: `Power spike: ${powerW} W (threshold ${critical ? POWER_SPIKE_CRITICAL_W : POWER_SPIKE_WARNING_W} W)`,
      });
    }
  }
  return anomalies;
}
