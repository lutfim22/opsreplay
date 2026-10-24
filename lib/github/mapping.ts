import type { EventSource } from "@/lib/events/source";
import type { EventSeverity, EventSourceRef, OpsEvent } from "@/lib/events/schema";
import { formatRepo } from "@/lib/github/repo";
import type { RepoRef } from "@/lib/github/repo";
import type { RawGitHubRecord } from "@/lib/github/raw";

export function githubSourceRef(repo: RepoRef): EventSourceRef {
  return { provider: "github", name: formatRepo(repo), simulated: false };
}

const toIso = (value: string) => new Date(value).toISOString();
const firstLine = (text: string) => text.split("\n")[0]?.trim() ?? "";

function runSeverity(conclusion: string | null | undefined): EventSeverity {
  if (conclusion === "failure" || conclusion === "timed_out") return "warning";
  return "info";
}

/** Maps one raw GitHub REST record into an OpsEvent. Ids are stable per record. */
export function normalizeGitHubRecord(repo: RepoRef, raw: RawGitHubRecord): OpsEvent {
  const source = githubSourceRef(repo);
  const prefix = `github:${source.name}`;
  switch (raw.kind) {
    case "commit": {
      const c = raw.data;
      const stamp = c.commit.committer?.date ?? c.commit.author?.date;
      return {
        id: `${prefix}:commit:${c.sha}`,
        source,
        type: "github.commit",
        timestamp: toIso(stamp ?? ""),
        severity: "info",
        payload: {
          url: c.html_url,
          sha: c.sha,
          title: firstLine(c.commit.message),
          author: c.author?.login ?? c.commit.author?.name ?? null,
        },
      };
    }
    case "pull_request": {
      const p = raw.data;
      const state = p.merged_at ? "merged" : p.state;
      return {
        id: `${prefix}:pull_request:${p.id}`,
        source,
        type: "github.pull_request",
        timestamp: toIso(p.updated_at),
        severity: "info",
        payload: {
          url: p.html_url,
          number: p.number,
          title: p.title,
          state,
          draft: p.draft ?? false,
          author: p.user?.login ?? null,
          createdAt: toIso(p.created_at),
        },
      };
    }
    case "workflow_run": {
      const r = raw.data;
      return {
        id: `${prefix}:workflow_run:${r.id}:${r.run_attempt ?? 1}`,
        source,
        type: "github.workflow_run",
        timestamp: toIso(r.updated_at),
        severity: runSeverity(r.conclusion),
        payload: {
          url: r.html_url,
          name: r.name ?? "workflow",
          runNumber: r.run_number,
          trigger: r.event,
          status: r.status ?? null,
          conclusion: r.conclusion ?? null,
          branch: r.head_branch ?? null,
          sha: r.head_sha,
        },
      };
    }
  }
}

export function createGitHubSource(repo: RepoRef, records: readonly RawGitHubRecord[]): EventSource<RawGitHubRecord> {
  return {
    ref: githubSourceRef(repo),
    readRaw: () => records,
    normalize: (raw) => normalizeGitHubRecord(repo, raw),
  };
}
