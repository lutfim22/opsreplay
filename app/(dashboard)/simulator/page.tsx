import type { Metadata } from "next";
import { SimulatorPanel } from "@/components/simulator/simulator-panel";

export const metadata: Metadata = { title: "Simulator" };

export default function SimulatorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">IoT Simulator</h1>
        <p className="text-sm text-muted-foreground">
          Deterministic virtual smart plug. All telemetry is SIMULATED and runs locally in your browser.
        </p>
      </div>
      <SimulatorPanel />
    </div>
  );
}
