import { incidents } from "@/lib/mock-data/incidents";
import type { Incident, IncidentSeverity, IncidentStatus } from "@/lib/types";

export const severityLabels: Record<IncidentSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const statusLabels: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  mitigated: "Mitigated",
  resolved: "Resolved",
};

export function listIncidents(): Incident[] {
  return [...incidents].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export function getIncident(id: string): Incident | undefined {
  return incidents.find((incident) => incident.id === id);
}

export function isActive(incident: Incident): boolean {
  return incident.status !== "resolved";
}

export function getIncidentStats(list: Incident[]) {
  return {
    total: list.length,
    active: list.filter(isActive).length,
    critical: list.filter((i) => i.severity === "critical").length,
    resolved: list.filter((i) => i.status === "resolved").length,
  };
}

export function sortTimeline(incident: Incident) {
  return [...incident.timeline].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
}

const formatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatTimestamp(iso: string): string {
  return `${formatter.format(new Date(iso))} UTC`;
}
