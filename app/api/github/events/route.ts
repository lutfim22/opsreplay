import { NextResponse } from "next/server";
import { fetchGitHubActivity, GitHubApiError } from "@/lib/github/client";
import type { GitHubErrorKind } from "@/lib/github/client";
import { DEFAULT_REPO, formatRepo, parseRepo } from "@/lib/github/repo";

const STATUS: Record<GitHubErrorKind, number> = {
  not_found: 404,
  rate_limited: 429,
  network: 502,
  upstream: 502,
  invalid_response: 502,
};

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("repo") ?? DEFAULT_REPO;
  const repo = parseRepo(input);
  if (!repo) {
    return NextResponse.json({ ok: false, error: { kind: "invalid_input", message: "Use the format owner/repo." } }, { status: 400 });
  }
  try {
    const activity = await fetchGitHubActivity(repo, { token: process.env.GITHUB_TOKEN || undefined });
    return NextResponse.json({
      ok: true,
      repo: formatRepo(repo),
      live: true,
      fetchedAt: new Date().toISOString(),
      events: activity.events,
      warnings: activity.warnings,
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        { ok: false, error: { kind: error.kind, message: error.message, resetAt: error.resetAt } },
        { status: STATUS[error.kind] },
      );
    }
    return NextResponse.json({ ok: false, error: { kind: "upstream", message: "Unexpected error." } }, { status: 500 });
  }
}
