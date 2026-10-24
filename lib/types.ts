export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved";
export type EvidenceKind = "log" | "metric" | "alert" | "note";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  actor: string;
}

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  capturedAt: string;
  content: string;
}

export interface Incident {
  id: string;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: string;
  service: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
  evidence: Evidence[];
}
