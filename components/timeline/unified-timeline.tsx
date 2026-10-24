"use client";

import { ExternalLink, Cpu, GitCommit, GitPullRequest, Loader2, PlayCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventSeverity } from "@/lib/events";
import { DEFAULT_REPO, parseRepo } from "@/lib/github/repo";
import {
  buildTimeline,
  DEFAULT_FILTERS,
  describeEvent,
  filterTimeline,
  formatUtc,
  getGitHubUrl,
  getSimulatedEvents,
  githubEventsOf,
  githubFallbackWarning,
  parseGitHubResponse,
  summarizeTimeline,
} from "@/lib/timeline";
import type { GitHubLoad, SeverityFilter, SourceFilter, TimelineEntry } from "@/lib/timeline";
import { cn } from "@/lib/utils";

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "iot", label: "IoT" },
  { value: "github", label: "GitHub" },
];

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

const severityStyles: Record<EventSeverity, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

const typeIcons: Record<string, typeof GitCommit> = {
  "github.commit": GitCommit,
  "github.pull_request": GitPullRequest,
  "github.workflow_run": PlayCircle,
};

function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              value === option.value ? "bg-muted text-foreground" : "bg-card text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function EntryRow({ entry, aligned }: { entry: TimelineEntry; aligned: boolean }) {
  const { event } = entry;
  const description = describeEvent(event);
  const simulated = event.source.simulated;
  const url = getGitHubUrl(event);
  const Icon = typeIcons[event.type] ?? Cpu;
  return (
    <li className="space-y-1 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">{description.label}</span>
        {simulated ? (
          <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300">SIMULATED IoT</Badge>
        ) : (
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            LIVE GITHUB · {event.source.name}
          </Badge>
        )}
        <Badge className={severityStyles[entry.severity]}>{entry.severity}</Badge>
        {entry.anomaly && <Badge className="border-red-500/30 text-red-700 dark:text-red-300">anomaly</Badge>}
      </div>
      <p className="text-sm font-medium break-words">{description.title}</p>
      <p className="text-xs text-muted-foreground break-words">{description.detail}</p>
      {entry.anomaly && <p className="text-xs font-medium break-words">⚠ {entry.anomaly.message} (rule-based)</p>}
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {entry.alignedTimestamp ? (
          <>
            <p>
              Original: <time dateTime={event.timestamp}>{formatUtc(event.timestamp)}</time>
            </p>
            <p>
              Aligned (demo only): <time dateTime={entry.alignedTimestamp}>{formatUtc(entry.alignedTimestamp)}</time>
            </p>
          </>
        ) : (
          <p>
            <time dateTime={event.timestamp}>{formatUtc(event.timestamp)}</time>
            {aligned && !simulated && " (original GitHub timestamp)"}
          </p>
        )}
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View on GitHub <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      )}
    </li>
  );
}

export function UnifiedTimeline() {
  const [input, setInput] = useState(DEFAULT_REPO);
  const [repo, setRepo] = useState(DEFAULT_REPO);
  const [requestId, setRequestId] = useState(0);
  const [inputError, setInputError] = useState<string | null>(null);
  const [github, setGithub] = useState<GitHubLoad | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [alignTime, setAlignTime] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch(`/api/github/events?repo=${encodeURIComponent(repo)}`, { signal: controller.signal });
        setGithub(parseGitHubResponse(await res.json()));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGithub({ status: "unavailable", kind: "network", message: "Could not reach the OpsReplay server." });
      }
    }
    void load();
    return () => controller.abort();
  }, [repo, requestId]);

  const simulated = useMemo(() => getSimulatedEvents(), []);
  const githubInput = useMemo(() => githubEventsOf(github), [github]);
  const model = useMemo(() => buildTimeline({ iot: simulated, github: githubInput, alignTime }), [simulated, githubInput, alignTime]);
  const visible = useMemo(() => filterTimeline(model.entries, filters), [model.entries, filters]);
  const summary = useMemo(() => summarizeTimeline(visible), [visible]);
  const warning = githubFallbackWarning(github, model.entries.filter((e) => e.category === "github").map((e) => e.event));
  const loading = github === null;

  function reload(next: string) {
    setGithub(null);
    setRepo(next);
    setRequestId((id) => id + 1);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseRepo(input);
    if (!parsed) {
      setInputError("Enter a public repository as owner/repo.");
      return;
    }
    setInputError(null);
    reload(`${parsed.owner}/${parsed.repo}`);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-1">
          <label htmlFor="timeline-repo" className="text-sm font-medium">GitHub repository</label>
          <input
            id="timeline-repo"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="owner/repo"
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? "timeline-repo-error" : undefined}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          {inputError && <p id="timeline-repo-error" role="alert" className="text-sm text-red-600 dark:text-red-400">{inputError}</p>}
        </div>
        <button type="submit" className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted sm:mt-6">
          Reload GitHub data
        </button>
      </form>

      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading GitHub activity… simulated events are shown meanwhile.
        </p>
      )}
      {warning && (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">GitHub data not available</p>
          <p>{warning}</p>
          {github?.status === "unavailable" && github.kind === "rate_limited" && (
            <p>{github.resetAt ? `Try again after ${new Date(github.resetAt).toLocaleTimeString()}.` : "Try again later."}</p>
          )}
        </div>
      )}
      {github?.status === "ready" && github.warnings.map((w) => (
        <p key={w} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-sm">{w}</p>
      ))}
      {(model.rejected > 0 || model.duplicates > 0) && (
        <p className="text-xs text-muted-foreground">
          {model.rejected} invalid and {model.duplicates} duplicate event(s) were skipped.
        </p>
      )}

      <Card>
        <CardHeader><CardTitle>Investigation summary</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Events</dt>
              <dd className="text-2xl font-semibold tabular-nums">{summary.total}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Anomalies (rule-based)</dt>
              <dd className="text-2xl font-semibold tabular-nums">{summary.anomalies}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sources</dt>
              <dd className="text-sm font-medium">
                {summary.bySource.iot} simulated IoT · {summary.bySource.github} GitHub
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Visible time range{alignTime ? " (display)" : ""}</dt>
              <dd className="text-sm font-medium break-words">
                {summary.range ? `${formatUtc(summary.range.start)} → ${formatUtc(summary.range.end)}` : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Filters and display</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Segmented legend="Source" value={filters.source} options={SOURCE_OPTIONS} onChange={(source) => setFilters((f) => ({ ...f, source }))} />
            <Segmented legend="Severity" value={filters.severity} options={SEVERITY_OPTIONS} onChange={(severity) => setFilters((f) => ({ ...f, severity }))} />
          </div>
          <div className="space-y-1 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={alignTime} onChange={(e) => setAlignTime(e.target.checked)} className="size-4" />
              Demo Time Alignment
              <Badge className={alignTime ? "border-violet-500/30 bg-violet-500/10" : "border-border text-muted-foreground"}>{alignTime ? "ON" : "OFF"}</Badge>
            </label>
            <p className="text-xs text-muted-foreground">
              For demonstration only. When on, simulated events are displayed shifted so the end of the simulated window
              lands on the latest GitHub event. Original OpsEvent timestamps are never changed and GitHub timestamps are never
              shifted; aligned times do not represent when anything really happened.
            </p>
            {alignTime && model.alignment.offsetMs === null && (
              <p className="text-xs font-medium">Alignment unavailable: there are no GitHub events to align to, so original timestamps are shown.</p>
            )}
            {alignTime && model.alignment.anchor && (
              <p className="text-xs font-medium">Aligned to latest GitHub activity at {formatUtc(model.alignment.anchor)}.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-2">
          <CardTitle>Timeline</CardTitle>
          <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300">SIMULATED IoT</Badge>
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">LIVE GITHUB DATA</Badge>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events match the current filters.</p>
          ) : (
            <ol className="space-y-3" aria-label="Unified events, oldest first">
              {visible.map((entry) => (
                <EntryRow key={entry.event.id} entry={entry} aligned={alignTime && model.alignment.offsetMs !== null} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
