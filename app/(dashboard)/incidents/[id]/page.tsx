import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SeverityBadge, StatusBadge } from "@/components/dashboard/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimestamp, getIncident, listIncidents, sortTimeline } from "@/lib/incidents";

export function generateStaticParams() {
  return listIncidents().map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/incidents/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getIncident(id)?.id ?? "Incident not found" };
}

export default async function IncidentDetailPage({ params }: PageProps<"/incidents/[id]">) {
  const { id } = await params;
  const incident = getIncident(id);
  if (!incident) notFound();

  const metadata: { label: string; value: React.ReactNode }[] = [
    { label: "Severity", value: <SeverityBadge severity={incident.severity} /> },
    { label: "Status", value: <StatusBadge status={incident.status} /> },
    { label: "Source", value: incident.source },
    { label: "Service", value: incident.service },
    { label: "Owner", value: incident.owner },
    { label: "Created", value: <time dateTime={incident.createdAt}>{formatTimestamp(incident.createdAt)}</time> },
    { label: "Last updated", value: <time dateTime={incident.updatedAt}>{formatTimestamp(incident.updatedAt)}</time> },
  ];
  const timeline = sortTimeline(incident);

  return (
    <div className="space-y-6">
      <Link href="/incidents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to incidents
      </Link>
      <div>
        <p className="font-mono text-xs text-muted-foreground">{incident.id}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{incident.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{incident.summary}</p>
        <Link href="/timeline" className="mt-2 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Open unified IoT + GitHub timeline
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metadata.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded.</p>
            ) : (
              <ol className="relative space-y-5 border-l border-border pl-5">
                {timeline.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden="true" />
                    <time dateTime={event.timestamp} className="text-xs text-muted-foreground">
                      {formatTimestamp(event.timestamp)}
                    </time>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                    <p className="text-xs text-muted-foreground">by {event.actor}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Evidence</CardTitle></CardHeader>
          <CardContent>
            {incident.evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evidence attached.</p>
            ) : (
              <ul className="space-y-4">
                {incident.evidence.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                      <Badge className="border-border bg-muted uppercase">{item.kind}</Badge>
                      <span className="text-sm font-medium">{item.title}</span>
                      <time dateTime={item.capturedAt} className="ml-auto text-xs text-muted-foreground">
                        {formatTimestamp(item.capturedAt)}
                      </time>
                    </div>
                    <pre className="overflow-x-auto bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap" tabIndex={0}>{item.content}</pre>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
