"use client";

import { ExternalLink, GitCommit, GitPullRequest, Loader2, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpsEvent } from "@/lib/events";
import { DEFAULT_REPO, parseRepo } from "@/lib/github/repo";
import { cn } from "@/lib/utils";

type State =
  | { status: "loading" }
  | { status: "error"; kind: string; message: string; resetAt?: string }
  | { status: "ready"; events: OpsEvent[]; warnings: string[]; fetchedAt: string };

const typeMeta: Record<string, { label: string; icon: typeof GitCommit }> = {
  "github.commit": { label: "Commit", icon: GitCommit },
  "github.pull_request": { label: "Pull request", icon: GitPullRequest },
  "github.workflow_run": { label: "Workflow run", icon: PlayCircle },
};

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function describe(event: OpsEvent): { title: string; detail: string } {
  const p = event.payload;
  switch (event.type) {
    case "github.commit":
      return { title: str(p.title) || str(p.sha).slice(0, 7), detail: `${str(p.sha).slice(0, 7)} by ${str(p.author) || "unknown"}` };
    case "github.pull_request":
      return { title: `#${str(p.number)} ${str(p.title)}`, detail: `${str(p.state)} by ${str(p.author) || "unknown"}` };
    default:
      return {
        title: `${str(p.name)} #${str(p.runNumber)}`,
        detail: `${str(p.conclusion) || str(p.status) || "unknown"} on ${str(p.branch) || "unknown branch"} (${str(p.trigger)})`,
      };
  }
}

function safeUrl(value: unknown): string | null {
  try {
    const url = new URL(str(value));
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function GitHubActivity() {
  const [input, setInput] = useState(DEFAULT_REPO);
  const [repo, setRepo] = useState(DEFAULT_REPO);
  const [requestId, setRequestId] = useState(0);
  const [inputError, setInputError] = useState<string | null>(null);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const target = repo;
    async function load() {
    try {
      const res = await fetch(`/api/github/events?repo=${encodeURIComponent(target)}`, { signal });
      const body: unknown = await res.json();
      const data = body as {
        ok?: boolean;
        events?: OpsEvent[];
        warnings?: string[];
        fetchedAt?: string;
        error?: { kind?: string; message?: string; resetAt?: string };
      };
      if (data.ok && data.events) {
        setState({ status: "ready", events: [...data.events].reverse(), warnings: data.warnings ?? [], fetchedAt: data.fetchedAt ?? "" });
      } else {
        setState({ status: "error", kind: data.error?.kind ?? "upstream", message: data.error?.message ?? "Request failed.", resetAt: data.error?.resetAt });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState({ status: "error", kind: "network", message: "Could not reach the OpsReplay server." });
    }
    }
    void load();
    return () => controller.abort();
  }, [repo, requestId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseRepo(input);
    if (!parsed) {
      setInputError("Enter a public repository as owner/repo.");
      return;
    }
    setInputError(null);
    const next = `${parsed.owner}/${parsed.repo}`;
    setState({ status: "loading" });
    setRepo(next);
    setRequestId((id) => id + 1);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-1">
          <label htmlFor="repo" className="text-sm font-medium">Repository</label>
          <input
            id="repo"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="owner/repo"
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? "repo-error" : undefined}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          {inputError && <p id="repo-error" role="alert" className="text-sm text-red-600 dark:text-red-400">{inputError}</p>}
        </div>
        <button type="submit" className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted sm:mt-6">
          Load activity
        </button>
      </form>

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-2">
          <CardTitle>{repo}</CardTitle>
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">LIVE GITHUB DATA</Badge>
          <Badge className="border-border text-muted-foreground">Not SIMULATED IoT data</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Events close in time are shown together for context only; proximity does not prove causation.
          </p>
          {state.status === "loading" && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading GitHub activity…
            </p>
          )}
          {state.status === "error" && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
              <p className="font-medium">
                {state.kind === "rate_limited" ? "GitHub rate limit reached" : state.kind === "not_found" ? "Repository unavailable" : "Could not load GitHub activity"}
              </p>
              <p>{state.message}</p>
              {state.kind === "rate_limited" && (
                <p>{state.resetAt ? `Try again after ${new Date(state.resetAt).toLocaleTimeString()}.` : "Try again later."} The server can be configured with an optional GITHUB_TOKEN for higher limits.</p>
              )}
            </div>
          )}
          {state.status === "ready" && (
            <>
              {state.warnings.map((w) => (
                <p key={w} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-sm">{w}</p>
              ))}
              {state.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent commits, pull requests or workflow runs found.</p>
              ) : (
                <ol className="space-y-3 border-l border-border pl-4">
                  {state.events.map((event) => {
                    const meta = typeMeta[event.type] ?? typeMeta["github.commit"];
                    const Icon = meta.icon;
                    const { title, detail } = describe(event);
                    const url = safeUrl(event.payload.url);
                    return (
                      <li key={event.id} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Icon className="size-4" aria-hidden="true" />
                          <span>{meta.label}</span>
                          <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time>
                          <Badge className={cn(event.severity === "warning" ? "border-amber-500/30 bg-amber-500/10" : "border-border")}>{event.severity}</Badge>
                        </div>
                        <p className="text-sm font-medium break-words">{title}</p>
                        <p className="text-xs text-muted-foreground break-words">{detail}</p>
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                            View on GitHub <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
