import { describe, expect, it } from "vitest";
import { opsEventSchema } from "@/lib/events";
import { fetchGitHubActivity, GitHubApiError } from "@/lib/github/client";
import { parseRepo } from "@/lib/github/repo";

const repo = { owner: "o", repo: "r" };

const commit = (sha: string, date: string) => ({
  sha,
  html_url: `https://github.com/o/r/commit/${sha}`,
  commit: { message: "feat: x\n\nbody", author: { name: "A", date }, committer: { name: "A", date } },
  author: { login: "alice" },
});
const pull = (id: number, updated: string) => ({
  id, number: id, html_url: `https://github.com/o/r/pull/${id}`, title: "PR", state: "closed",
  created_at: "2025-01-01T00:00:00Z", updated_at: updated, merged_at: updated, user: { login: "bob" },
});
const run = (id: number, updated: string, conclusion: string) => ({
  id, name: "CI", html_url: `https://github.com/o/r/actions/runs/${id}`, event: "push", status: "completed",
  conclusion, run_number: id, head_branch: "main", head_sha: "abc", created_at: updated, updated_at: updated,
});

function mockFetch(routes: { commits?: Response | Error; pulls?: Response | Error; runs?: Response | Error }): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const r = url.includes("/commits") ? routes.commits : url.includes("/pulls") ? routes.pulls : routes.runs;
    if (r instanceof Error) throw r;
    return r?.clone() ?? new Response("{}", { status: 404 });
  }) as typeof fetch;
}
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init);

describe("parseRepo", () => {
  it("validates owner/repo", () => {
    expect(parseRepo("lutfim22/opsreplay")).toEqual({ owner: "lutfim22", repo: "opsreplay" });
    for (const bad of ["", "a", "a/b/c", "-a/b", "a/..", "a/b c", "a/b?x=1"]) expect(parseRepo(bad)).toBeNull();
  });
});

describe("fetchGitHubActivity", () => {
  it("maps, validates and orders events, preserving ids, urls and real source", async () => {
    const { events, warnings } = await fetchGitHubActivity(repo, {
      fetchFn: mockFetch({
        commits: json([commit("c2", "2025-01-02T00:00:00Z"), commit("c1", "2025-01-01T00:00:00Z")]),
        pulls: json([pull(5, "2025-01-03T00:00:00Z")]),
        runs: json({ workflow_runs: [run(9, "2025-01-02T12:00:00Z", "failure")] }),
      }),
    });
    expect(warnings).toEqual([]);
    expect(events.map((e) => e.type)).toEqual(["github.commit", "github.commit", "github.workflow_run", "github.pull_request"]);
    expect(events.map((e) => e.timestamp)).toEqual([...events.map((e) => e.timestamp)].sort());
    for (const e of events) {
      expect(opsEventSchema.safeParse(e).success).toBe(true);
      expect(e.source).toEqual({ provider: "github", name: "o/r", simulated: false });
      expect(String(e.payload.url)).toMatch(/^https:\/\/github\.com\//);
    }
    expect(events[0]?.id).toBe("github:o/r:commit:c1");
    expect(events.find((e) => e.type === "github.workflow_run")?.severity).toBe("warning");
    expect(events.find((e) => e.type === "github.pull_request")?.payload.state).toBe("merged");
  });

  it("deduplicates repeated records", async () => {
    const c = commit("c1", "2025-01-01T00:00:00Z");
    const { events } = await fetchGitHubActivity(repo, {
      fetchFn: mockFetch({ commits: json([c, c]), pulls: json([]), runs: json({ workflow_runs: [] }) }),
    });
    expect(events).toHaveLength(1);
  });

  it("warns, without mock data, when Actions is unavailable", async () => {
    const { events, warnings } = await fetchGitHubActivity(repo, {
      fetchFn: mockFetch({ commits: json([commit("c1", "2025-01-01T00:00:00Z")]), pulls: json([]), runs: json({}, { status: 404 }) }),
    });
    expect(events).toHaveLength(1);
    expect(warnings).toHaveLength(1);
  });

  it("skips invalid records with a warning", async () => {
    const bad = { ...commit("c1", "2025-01-01T00:00:00Z"), commit: { message: "m", author: null, committer: null } };
    const { events, warnings } = await fetchGitHubActivity(repo, {
      fetchFn: mockFetch({ commits: json([bad]), pulls: json([]), runs: json({ workflow_runs: [] }) }),
    });
    expect(events).toHaveLength(0);
    expect(warnings[0]).toMatch(/failed validation/);
  });

  it.each([
    ["not_found", json({}, { status: 404 })],
    ["rate_limited", json({}, { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1735689600" } })],
    ["upstream", json({}, { status: 500 })],
    ["invalid_response", json({ nope: 1 })],
  ])("reports %s errors", async (kind, response) => {
    const err = await fetchGitHubActivity(repo, { fetchFn: mockFetch({ commits: response, pulls: json([]), runs: json({ workflow_runs: [] }) }) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitHubApiError);
    expect((err as GitHubApiError).kind).toBe(kind);
    if (kind === "rate_limited") expect((err as GitHubApiError).resetAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("reports network errors", async () => {
    const err = await fetchGitHubActivity(repo, { fetchFn: mockFetch({ commits: new Error("down"), pulls: json([]), runs: json({}) }) }).catch((e: unknown) => e);
    expect((err as GitHubApiError).kind).toBe("network");
  });

  it("sends the token only as a server-side Authorization header", async () => {
    const seen: string[] = [];
    const fetchFn = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String((init?.headers as Record<string, string>).Authorization));
      return json(String(_u).includes("/actions") ? { workflow_runs: [] } : []);
    }) as typeof fetch;
    await fetchGitHubActivity(repo, { fetchFn, token: "tok" });
    expect(seen.every((h) => h === "Bearer " + "tok")).toBe(true);
  });
});
