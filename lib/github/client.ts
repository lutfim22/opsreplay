import type { z } from "zod";
import { ingestEvents } from "@/lib/events/engine";
import type { OpsEvent } from "@/lib/events/schema";
import { normalizeAll } from "@/lib/events/source";
import { createGitHubSource } from "@/lib/github/mapping";
import { rawCommitsSchema, rawPullsSchema, rawRunsResponseSchema } from "@/lib/github/raw";
import type { RawGitHubRecord } from "@/lib/github/raw";
import type { RepoRef } from "@/lib/github/repo";

export type GitHubErrorKind = "not_found" | "rate_limited" | "network" | "upstream" | "invalid_response";

export class GitHubApiError extends Error {
  constructor(
    readonly kind: GitHubErrorKind,
    message: string,
    readonly resetAt?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export interface GitHubActivity {
  events: OpsEvent[];
  warnings: string[];
}

export interface FetchOptions {
  fetchFn?: typeof fetch;
  token?: string;
  perPage?: number;
}

const API = "https://api.github.com";

function resetAt(res: Response): string | undefined {
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  return Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : undefined;
}

async function getJson<T>(url: string, schema: z.ZodType<T>, opts: FetchOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "opsreplay",
  };
  if (opts.token) headers.Authorization = "Bearer " + opts.token;
  let res: Response;
  try {
    res = await (opts.fetchFn ?? fetch)(url, { headers, cache: "no-store" });
  } catch {
    throw new GitHubApiError("network", "Could not reach the GitHub API.");
  }
  if (!res.ok) {
    const limited =
      res.status === 429 || (res.status === 403 && (res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after")));
    if (limited) throw new GitHubApiError("rate_limited", "GitHub API rate limit exceeded.", resetAt(res));
    if (res.status === 404 || res.status === 403 || res.status === 401) {
      throw new GitHubApiError("not_found", "Repository not found, private, or not accessible.");
    }
    throw new GitHubApiError("upstream", `GitHub API responded with status ${res.status}.`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new GitHubApiError("invalid_response", "GitHub API returned malformed JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new GitHubApiError("invalid_response", "GitHub API response did not match the expected shape.");
  return parsed.data;
}

/**
 * Fetches recent commits, PRs and workflow runs. Commits and PRs are required; a failure of the
 * Actions endpoint (e.g. disabled) is reported as a warning. Rate-limit/network errors always throw.
 */
export async function fetchGitHubActivity(repo: RepoRef, opts: FetchOptions = {}): Promise<GitHubActivity> {
  const base = `${API}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
  const n = opts.perPage ?? 30;
  const [commits, pulls, runs] = await Promise.allSettled([
    getJson(`${base}/commits?per_page=${n}`, rawCommitsSchema, opts),
    getJson(`${base}/pulls?state=all&sort=updated&direction=desc&per_page=${n}`, rawPullsSchema, opts),
    getJson(`${base}/actions/runs?per_page=${n}`, rawRunsResponseSchema, opts),
  ]);

  for (const result of [commits, pulls, runs]) {
    if (result.status === "rejected") {
      const err = result.reason;
      if (err instanceof GitHubApiError && (err.kind === "rate_limited" || err.kind === "network")) throw err;
    }
  }
  if (commits.status === "rejected") throw commits.reason;
  if (pulls.status === "rejected") throw pulls.reason;

  const warnings: string[] = [];
  const records: RawGitHubRecord[] = [
    ...commits.value.map((data) => ({ kind: "commit" as const, data })),
    ...pulls.value.map((data) => ({ kind: "pull_request" as const, data })),
  ];
  if (runs.status === "fulfilled") {
    records.push(...runs.value.workflow_runs.map((data) => ({ kind: "workflow_run" as const, data })));
  } else {
    warnings.push("Workflow runs are unavailable for this repository (GitHub Actions may be disabled).");
  }

  const { events, errors } = normalizeAll(createGitHubSource(repo, records));
  if (errors.length > 0) warnings.push(`${errors.length} GitHub record(s) failed validation and were skipped.`);
  return { events: ingestEvents([], events).events, warnings };
}
