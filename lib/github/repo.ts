export const DEFAULT_REPO = "lutfim22/opsreplay";

export interface RepoRef {
  owner: string;
  repo: string;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Parses "owner/repo". Returns null when the input is not a valid public-repo reference. */
export function parseRepo(input: string): RepoRef | null {
  const parts = input.trim().split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo || !OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === "." || repo === "..") return null;
  return { owner, repo };
}

export function formatRepo(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}
