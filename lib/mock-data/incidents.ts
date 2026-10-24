import type { Incident } from "@/lib/types";

/**
 * MOCK DATA — fictional incidents for UI development only.
 * Not connected to any real system, service or person.
 */
export const incidents: Incident[] = [
  {
    id: "INC-1001",
    title: "[MOCK] Checkout API latency spike",
    summary:
      "p99 latency on the checkout API exceeded 4s, causing elevated cart abandonment.",
    severity: "critical",
    status: "investigating",
    source: "Monitoring",
    service: "checkout-api",
    owner: "Sample Oncall A",
    createdAt: "2026-03-14T08:02:00Z",
    updatedAt: "2026-03-14T09:20:00Z",
    timeline: [
      { id: "e1", timestamp: "2026-03-14T08:02:00Z", title: "Alert fired", description: "p99 latency threshold of 2s breached.", actor: "Monitoring" },
      { id: "e2", timestamp: "2026-03-14T08:09:00Z", title: "Incident acknowledged", description: "On-call engineer began triage.", actor: "Sample Oncall A" },
      { id: "e3", timestamp: "2026-03-14T08:41:00Z", title: "Suspect identified", description: "Connection pool saturation on the orders database replica.", actor: "Sample Oncall A" },
      { id: "e4", timestamp: "2026-03-14T09:20:00Z", title: "Mitigation in progress", description: "Pool size increase rolling out to 50% of pods.", actor: "Sample Engineer B" },
    ],
    evidence: [
      { id: "ev1", kind: "metric", title: "p99 latency (checkout-api)", capturedAt: "2026-03-14T08:05:00Z", content: "p99: 4120ms (baseline 380ms)\nerror rate: 2.4%" },
      { id: "ev2", kind: "log", title: "Pool exhaustion warnings", capturedAt: "2026-03-14T08:38:00Z", content: "WARN db pool exhausted, waiting=212 active=50/50\nWARN request timed out after 3000ms" },
    ],
  },
  {
    id: "INC-1002",
    title: "[MOCK] Payment webhook retries failing",
    summary: "Webhook deliveries to a payment provider return 502 for ~12% of requests.",
    severity: "high",
    status: "open",
    source: "Alerting",
    service: "payments-webhook",
    owner: "Sample Oncall C",
    createdAt: "2026-03-14T07:30:00Z",
    updatedAt: "2026-03-14T08:55:00Z",
    timeline: [
      { id: "e1", timestamp: "2026-03-14T07:30:00Z", title: "Alert fired", description: "Webhook failure ratio above 10%.", actor: "Alerting" },
      { id: "e2", timestamp: "2026-03-14T08:55:00Z", title: "Awaiting owner", description: "Incident assigned, not yet acknowledged.", actor: "Sample Oncall C" },
    ],
    evidence: [
      { id: "ev1", kind: "alert", title: "Webhook failure ratio", capturedAt: "2026-03-14T07:30:00Z", content: "failure_ratio=0.12 for 10m\nthreshold=0.10" },
    ],
  },
  {
    id: "INC-1003",
    title: "[MOCK] Search index replication lag",
    severity: "medium",
    summary: "Search results were up to 15 minutes stale after a reindex job.",
    status: "mitigated",
    source: "Customer report",
    service: "search",
    owner: "Sample Engineer D",
    createdAt: "2026-03-13T14:10:00Z",
    updatedAt: "2026-03-13T17:45:00Z",
    timeline: [
      { id: "e1", timestamp: "2026-03-13T14:10:00Z", title: "Report received", description: "Customer support flagged stale search results.", actor: "Support" },
      { id: "e2", timestamp: "2026-03-13T15:00:00Z", title: "Cause found", description: "Reindex job starved the replication consumer.", actor: "Sample Engineer D" },
      { id: "e3", timestamp: "2026-03-13T17:45:00Z", title: "Reindex throttled", description: "Lag recovering; monitoring.", actor: "Sample Engineer D" },
    ],
    evidence: [
      { id: "ev1", kind: "metric", title: "Replication lag", capturedAt: "2026-03-13T15:05:00Z", content: "lag_seconds: 912\nconsumer_cpu: 98%" },
      { id: "ev2", kind: "note", title: "Engineer note", capturedAt: "2026-03-13T15:30:00Z", content: "Reindex job scheduled during peak traffic; move to off-hours." },
    ],
  },
  {
    id: "INC-1004",
    title: "[MOCK] Expired TLS certificate on staging gateway",
    summary: "Staging API gateway served an expired certificate for 40 minutes.",
    severity: "low",
    status: "resolved",
    source: "Monitoring",
    service: "api-gateway-staging",
    owner: "Sample Engineer B",
    createdAt: "2026-03-12T10:00:00Z",
    updatedAt: "2026-03-12T10:55:00Z",
    timeline: [
      { id: "e1", timestamp: "2026-03-12T10:00:00Z", title: "Alert fired", description: "Certificate expiry check failed.", actor: "Monitoring" },
      { id: "e2", timestamp: "2026-03-12T10:40:00Z", title: "Certificate renewed", description: "New certificate deployed.", actor: "Sample Engineer B" },
      { id: "e3", timestamp: "2026-03-12T10:55:00Z", title: "Resolved", description: "Checks green; renewal automation ticket filed.", actor: "Sample Engineer B" },
    ],
    evidence: [
      { id: "ev1", kind: "log", title: "TLS handshake failure", capturedAt: "2026-03-12T10:01:00Z", content: "x509: certificate has expired or is not yet valid" },
    ],
  },
  {
    id: "INC-1005",
    title: "[MOCK] Background job queue backlog",
    summary: "Email notification queue grew to 80k messages after a worker deploy.",
    severity: "high",
    status: "resolved",
    source: "Alerting",
    service: "notifications-worker",
    owner: "Sample Oncall A",
    createdAt: "2026-03-11T22:15:00Z",
    updatedAt: "2026-03-12T00:30:00Z",
    timeline: [
      { id: "e1", timestamp: "2026-03-11T22:15:00Z", title: "Alert fired", description: "Queue depth above 50k.", actor: "Alerting" },
      { id: "e2", timestamp: "2026-03-11T23:05:00Z", title: "Rollback", description: "Worker release rolled back.", actor: "Sample Oncall A" },
      { id: "e3", timestamp: "2026-03-12T00:30:00Z", title: "Resolved", description: "Queue drained to normal levels.", actor: "Sample Oncall A" },
    ],
    evidence: [
      { id: "ev1", kind: "metric", title: "Queue depth", capturedAt: "2026-03-11T22:20:00Z", content: "depth: 54210\nconsumers: 2/8 healthy" },
    ],
  },
  {
    id: "INC-1006",
    title: "[MOCK] Elevated 5xx on auth service",
    summary: "Login requests intermittently failed during a cache node failover.",
    severity: "critical",
    status: "resolved",
    source: "Monitoring",
    service: "auth-service",
    owner: "Sample Engineer D",
    createdAt: "2026-03-10T03:20:00Z",
    updatedAt: "2026-03-10T04:10:00Z",
    timeline: [
      { id: "e1", timestamp: "2026-03-10T03:20:00Z", title: "Alert fired", description: "5xx rate above 5%.", actor: "Monitoring" },
      { id: "e2", timestamp: "2026-03-10T03:50:00Z", title: "Failover completed", description: "Cache cluster promoted a new primary.", actor: "Sample Engineer D" },
      { id: "e3", timestamp: "2026-03-10T04:10:00Z", title: "Resolved", description: "Error rate back to baseline.", actor: "Sample Engineer D" },
    ],
    evidence: [
      { id: "ev1", kind: "log", title: "Cache connection errors", capturedAt: "2026-03-10T03:22:00Z", content: "ERR connection reset by peer (cache-primary-1)" },
    ],
  },
];
