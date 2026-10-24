import Link from "next/link";

export default function IncidentNotFound() {
  return (
    <div className="space-y-3 py-12 text-center">
      <h1 className="text-2xl font-semibold">Incident not found</h1>
      <p className="text-sm text-muted-foreground">It may not exist in the mock dataset.</p>
      <Link href="/incidents" className="text-sm font-medium text-primary hover:underline">Back to incidents</Link>
    </div>
  );
}
