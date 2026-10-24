import type { Metadata } from "next";
import { IncidentTable } from "@/components/dashboard/incident-table";
import { listIncidents } from "@/lib/incidents";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
        <p className="text-sm text-muted-foreground">All incidents, most recently updated first (mock data).</p>
      </div>
      <IncidentTable incidents={listIncidents()} />
    </div>
  );
}
