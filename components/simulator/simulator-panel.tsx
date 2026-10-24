"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { detectAnomalies, ingestEvents, normalizeAll } from "@/lib/events";
import type { Anomaly, EventSeverity } from "@/lib/events";
import {
  eventsUpTo,
  SIMULATOR_DEVICE_ID,
  SIMULATOR_DURATION_MS,
  SIMULATOR_START,
  simulatorSource,
} from "@/lib/simulator/virtual-plug";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 2, 4] as const;
const TICK_MS = 250;

const severityStyles: Record<EventSeverity, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

function PowerChart({ points }: { points: { t: number; w: number }[] }) {
  const width = 600;
  const height = 160;
  const maxW = Math.max(100, ...points.map((p) => p.w));
  const path = points
    .map((p, i) => {
      const x = (p.t / SIMULATOR_DURATION_MS) * width;
      const y = height - (p.w / maxW) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Simulated power consumption in watts over time"
      className="h-40 w-full rounded-lg border border-border bg-muted/30"
      preserveAspectRatio="none"
    >
      {path && <path d={path} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" className="text-indigo-500" />}
    </svg>
  );
}

export function SimulatorPanel() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const allEvents = useMemo(() => ingestEvents([], normalizeAll(simulatorSource).events).events, []);
  const events = useMemo(() => eventsUpTo(allEvents, elapsedMs), [allEvents, elapsedMs]);
  const anomalies = useMemo(() => detectAnomalies(events), [events]);
  const anomalyByEvent = useMemo(() => new Map<string, Anomaly>(anomalies.map((a) => [a.eventId, a])), [anomalies]);

  const finished = elapsedMs >= SIMULATOR_DURATION_MS;
  const active = running && !finished;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setElapsedMs((prev) => Math.min(SIMULATOR_DURATION_MS, prev + TICK_MS * speed));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [active, speed]);

  const startMs = Date.parse(SIMULATOR_START);
  const points = events
    .filter((e) => e.type === "power.reading" && e.metrics?.powerW !== undefined)
    .map((e) => ({ t: Date.parse(e.timestamp) - startMs, w: e.metrics?.powerW ?? 0 }));
  const connectionEvent = [...events].reverse().find((e) => e.type === "device.offline" || e.type === "device.online");
  const online = connectionEvent?.type !== "device.offline";
  const lastPoint = points[points.length - 1];
  const currentW = online ? lastPoint?.w : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} disabled={active || finished} onClick={() => setRunning(true)}>
          <Play className="size-4" aria-hidden="true" /> Start
        </button>
        <button type="button" className={buttonClass} disabled={!active} onClick={() => setRunning(false)}>
          <Pause className="size-4" aria-hidden="true" /> Pause
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setRunning(false);
            setElapsedMs(0);
          }}
        >
          <RotateCcw className="size-4" aria-hidden="true" /> Reset
        </button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Speed
          <select
            className="rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground"
            value={speed}
            onChange={(e) => setSpeed(SPEEDS.find((s) => String(s) === e.target.value) ?? 1)}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {Math.floor(elapsedMs / 1000)}s / {SIMULATOR_DURATION_MS / 1000}s
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Virtual device: {SIMULATOR_DEVICE_ID}</CardTitle>
            <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300">SIMULATED</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Connection</p>
                <Badge
                  className={cn(
                    online
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : severityStyles.critical,
                  )}
                >
                  {online ? "Online" : "Offline"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current power (simulated)</p>
                <p className="text-2xl font-semibold tabular-nums">{currentW === undefined ? "—" : `${currentW} W`}</p>
              </div>
            </div>
            <PowerChart points={points} />
            <p className="text-xs text-muted-foreground">All values are simulated and do not come from real hardware.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Event timeline</CardTitle>
            <span className="text-xs text-muted-foreground">{anomalies.length} anomalies (rule-based)</span>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Press Start to stream simulated events.</p>
            ) : (
              <ol className="max-h-96 space-y-2 overflow-y-auto" aria-label="Simulated events, newest first">
                {[...events].reverse().map((event) => {
                  const anomaly = anomalyByEvent.get(event.id);
                  return (
                    <li
                      key={event.id}
                      className={cn(
                        "rounded-lg border border-border px-3 py-2 text-sm",
                        anomaly && severityStyles[anomaly.severity],
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs">{event.timestamp.slice(11, 19)}</span>
                        <span className="font-medium">{event.type}</span>
                        <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300">SIMULATED</Badge>
                        {event.metrics?.powerW !== undefined && <span className="tabular-nums">{event.metrics.powerW} W</span>}
                      </div>
                      {anomaly && <p className="mt-1 text-xs font-medium">⚠ {anomaly.message}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
