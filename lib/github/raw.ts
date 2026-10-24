import { z } from "zod";

export const rawCommitSchema = z.object({
  sha: z.string().min(1),
  html_url: z.url(),
  commit: z.object({
    message: z.string(),
    author: z.object({ name: z.string().nullish(), date: z.iso.datetime({ offset: true }) }).nullish(),
    committer: z.object({ name: z.string().nullish(), date: z.iso.datetime({ offset: true }) }).nullish(),
  }),
  author: z.object({ login: z.string() }).nullish(),
});

export const rawPullSchema = z.object({
  id: z.number(),
  number: z.number(),
  html_url: z.url(),
  title: z.string(),
  state: z.string(),
  draft: z.boolean().optional(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  closed_at: z.iso.datetime({ offset: true }).nullish(),
  merged_at: z.iso.datetime({ offset: true }).nullish(),
  user: z.object({ login: z.string() }).nullish(),
});

export const rawRunSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  html_url: z.url(),
  event: z.string(),
  status: z.string().nullish(),
  conclusion: z.string().nullish(),
  run_number: z.number(),
  run_attempt: z.number().optional(),
  head_branch: z.string().nullish(),
  head_sha: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const rawCommitsSchema = z.array(rawCommitSchema);
export const rawPullsSchema = z.array(rawPullSchema);
export const rawRunsResponseSchema = z.object({ workflow_runs: z.array(rawRunSchema) });

export type RawCommit = z.infer<typeof rawCommitSchema>;
export type RawPull = z.infer<typeof rawPullSchema>;
export type RawRun = z.infer<typeof rawRunSchema>;

export type RawGitHubRecord =
  | { kind: "commit"; data: RawCommit }
  | { kind: "pull_request"; data: RawPull }
  | { kind: "workflow_run"; data: RawRun };
