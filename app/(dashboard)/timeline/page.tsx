import type { Metadata } from "next";
import { UnifiedTimeline } from "@/components/timeline/unified-timeline";

export const metadata: Metadata = { title: "Unified Timeline" };

export default function TimelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unified Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Read-only chronological view combining SIMULATED IoT telemetry with LIVE GITHUB DATA. Events shown together
          are context only; proximity in time does not prove causation.
        </p>
      </div>
      <UnifiedTimeline />
    </div>
  );
}
