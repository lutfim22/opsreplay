import { Badge } from "@/components/ui/badge";
import { severityLabels, statusLabels } from "@/lib/incidents";
import type { IncidentSeverity, IncidentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const severityStyles: Record<IncidentSeverity, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

const statusStyles: Record<IncidentStatus, string> = {
  open: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  investigating: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  mitigated: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  resolved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return <Badge className={cn(severityStyles[severity])}>{severityLabels[severity]}</Badge>;
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge className={cn(statusStyles[status])}>{statusLabels[status]}</Badge>;
}
