import type { OpsEvent } from "@/lib/events";
import { normalizeAll } from "@/lib/events";
import { simulatorSource } from "@/lib/simulator/virtual-plug";

export interface EventDescription {
  label: string;
  title: string;
  detail: string;
}

const str = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

/** Deterministic simulated events from the existing virtual smart plug. */
export function getSimulatedEvents(): OpsEvent[] {
  return normalizeAll(simulatorSource).events;
}

/** Link to the original GitHub record; only https github.com URLs are accepted. */
export function getGitHubUrl(event: OpsEvent): string | null {
  if (event.source.provider !== "github") return null;
  try {
    const url = new URL(str(event.payload.url));
    return url.protocol === "https:" && url.hostname === "github.com" ? url.href : null;
  } catch {
    return null;
  }
}

export function describeEvent(event: OpsEvent): EventDescription {
  const p = event.payload;
  switch (event.type) {
    case "github.commit":
      return { label: "Commit", title: str(p.title) || str(p.sha).slice(0, 7), detail: `${str(p.sha).slice(0, 7)} by ${str(p.author) || "unknown"}` };
    case "github.pull_request":
      return { label: "Pull request", title: `#${str(p.number)} ${str(p.title)}`, detail: `${str(p.state)} by ${str(p.author) || "unknown"}` };
    case "github.workflow_run":
      return {
        label: "Workflow run",
        title: `${str(p.name)} #${str(p.runNumber)}`,
        detail: `${str(p.conclusion) || str(p.status) || "unknown"} on ${str(p.branch) || "unknown branch"} (${str(p.trigger)})`,
      };
    case "power.reading":
      return {
        label: "Power reading",
        title: event.metrics?.powerW === undefined ? "Power reading" : `${event.metrics.powerW} W`,
        detail: event.deviceId ?? "unknown device",
      };
    case "device.offline":
      return { label: "Device offline", title: `${event.deviceId ?? "Device"} went offline`, detail: event.source.name };
    case "device.online":
      return { label: "Device online", title: `${event.deviceId ?? "Device"} came online`, detail: event.source.name };
    default:
      return { label: event.type, title: event.type, detail: event.source.name };
  }
}
