import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Flame, ListChecks, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { IncidentTable } from "@/components/dashboard/incident-table";
import { Card } from "@/components/ui/card";
import { getIncidentStats, listIncidents } from "@/lib/incidents";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  const incidents = listIncidents();
  const stats = getIncidentStats(incidents);
  const cards: { label: string; value: number; icon: LucideIcon; tone: string }[] = [
    { label: "Total Incidents", value: stats.total, icon: ListChecks, tone: "text-primary bg-primary/10" },
    { label: "Active Incidents", value: stats.active, icon: AlertTriangle, tone: "text-amber-600 bg-amber-500/10 dark:text-amber-300" },
    { label: "Critical Incidents", value: stats.critical, icon: Flame, tone: "text-red-600 bg-red-500/10 dark:text-red-300" },
    { label: "Resolved Incidents", value: stats.resolved, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300" },
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Incident activity at a glance (mock data).</p>
      </div>
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            </div>
            <span className={`flex size-10 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
          </Card>
        ))}
      </section>
      <section aria-labelledby="recent" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-lg font-semibold">Recent incidents</h2>
          <Link href="/incidents" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        <IncidentTable incidents={incidents.slice(0, 5)} />
      </section>
    </div>
  );
}
