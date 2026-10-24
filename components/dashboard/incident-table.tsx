import { Inbox } from "lucide-react";
import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/dashboard/badges";
import { Card } from "@/components/ui/card";
import { formatTimestamp } from "@/lib/incidents";
import type { Incident } from "@/lib/types";

export function IncidentTable({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">No incidents</p>
        <p className="text-sm text-muted-foreground">Incidents will appear here once they are reported.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Incidents, most recently updated first</caption>
          <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {["ID", "Title", "Severity", "Status", "Source", "Last Updated"].map((h) => (
                <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {incidents.map((incident) => (
              <tr key={incident.id} className="relative transition-colors focus-within:bg-muted/50 hover:bg-muted/50">
                <td className="px-4 py-3 font-mono text-xs">{incident.id}</td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/incidents/${incident.id}`}
                    className="after:absolute after:inset-0 after:content-[''] hover:underline"
                  >
                    {incident.title}
                  </Link>
                </td>
                <td className="px-4 py-3"><SeverityBadge severity={incident.severity} /></td>
                <td className="px-4 py-3"><StatusBadge status={incident.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{incident.source}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  <time dateTime={incident.updatedAt}>{formatTimestamp(incident.updatedAt)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
