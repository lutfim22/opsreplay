# PR7 manual verification preparation (Issue #15)

This is offline preparation only. Nothing here authorizes a workflow dispatch,
provider request, secret change, deployment, push or merge. PR7 remains blocked on
the live checks in [Issue #14](https://github.com/lutfim22/opsreplay/issues/14#issuecomment-6398997693).

## Dispatch availability and immutable source

GitHub requires a `workflow_dispatch` workflow definition on the default branch
before manual dispatch is available. Adding `.github/workflows/pr7-verification.yml`
only to this task branch does **not** make it dispatchable from the UI. API/CLI
dispatch is not a workaround. See GitHub's [workflow_dispatch documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

A separately approved default-branch change must carry the workflow and
`scripts/check-gemini-results.ts`. That small control change can land without
merging PR7 application code. Review the final control commit before dispatch.
The workflow runs only from `main` in this repository, checks out the control
commit via `github.sha`, and checks out the target via the literal reviewed SHA
`ed7153260b6cf8a79b634191faf917b706fdb49f`. Branch names, arbitrary SHAs and fork
code cannot select the secret-bearing checkout. A different target needs a new
review and workflow allowlist change. The existing main-only Gemini diagnostics
workflow is unchanged and does not provide these new protections.

The input SHA must match both that literal allowlist and environment variable
`PR7_APPROVED_TARGET_SHA`. A protected environment reviewer must confirm the
approval issue explicitly authorizes that target, actual deployment model,
timeout, three generation requests and monetary limit. An issue number alone
is only a reference, not machine-verifiable approval.

## Prerequisites requiring separate owner approval

1. Approve the default-branch control change separately. For a code commit, follow
   the conditional owner-selected attribution convention in AGENTS.md.
2. Provision/review `pr7-live-verification` as a protected GitHub environment:
   required reviewers, prevent self-review, no administrator bypass, and `main`
   deployment policy. Confirm the repository plan supports these protections.
   Do not run if protections are unavailable. Merely naming an environment in YAML
   does not create review protection and may auto-create an unprotected environment.
3. Set the environment-only `GEMINI_API_KEY` and `PR7_APPROVED_TARGET_SHA` through
   an approved setup. The workflow cannot inspect protection settings with its
   minimal token; an owner must verify them. No setup was performed for this task.
4. Confirm server deployment SHA, model and deadline, provider quota and actual
   prices. Approve at most three generation requests, each max 8192 output tokens
   with bounded simulator input and 1–55 second deadline. Request limits and
   billing alerts are not guaranteed spending caps.
5. Review both control and target source, lockfile and dependencies; installation
   occurs without provider secrets and uses `--ignore-scripts`. The token is
   contents-read-only and checkout does not persist Git credentials. Provider
   secrets enter only the probe step. Keep runner debug tracing disabled.

## Execution contract (future approval only)

Inputs have no model/timeout defaults: use confirmed deployment values (app
defaults are `gemini-2.5-flash` and 25 seconds). The SHA must be the reviewed
literal above. `approval_issue` references written approval and cost limits.
Required reviewers must check these inputs before releasing the job.

The workflow invokes the existing `scripts/gemini-diagnostics.ts` once using
`pnpm exec tsx`, equivalent to `pnpm diagnose:gemini` without package-manager
banners. It runs exactly the existing three sequential probes, one SDK attempt
per probe. No model listing, seven-case schema matrix, Upstash or Vercel requests
are included. No automatic events or retries are configured; GitHub rerun attempts
are skipped. A fresh dispatch still requires fresh explicit approval, even when
inputs are unchanged. Concurrency prevents overlap, not repeated spending.

Output is captured privately, checked by the trusted control script, then deleted
without artifact upload. Only whitelisted probe/model/status/category/latency and
outcome fields are printed. Missing, extra, reordered, malformed or wrong-model
summaries fail. Any non-success category/outcome, non-200 status or nonzero process
exit fails. This catches the target's invalid-output exit-zero bug as well as
upstream failures. The local diagnostic fix also sets exit failure for invalid
JSON/schema output; the immutable original target does not contain that fix.

Schema acceptance and Zod validity are separate from evidence-ID/domain validation.
The existing probes omit `findEvidenceProblems`, request validation and Redis
controls. Successful summaries cannot establish deployment security or grounding.
Use Issue #14's separate isolated Redis/Vercel matrix after further authorization;
Preview needs its own Redis database because quota key prefixes are hardcoded.
Verify forwarded-IP/host rewriting at the real deployment boundary. Never consume
public production quotas for exhaustion tests.

## Attribution convention

Repository history uses Copilot-specific bot trailers and the owner's GitHub
noreply identity; neither establishes an official Codex identity. The owner
selected `Co-authored-by: Codex <codex@openai.com>` for Codex and ChatGPT
contributions. The email is an owner-selected convention, not a verified
official OpenAI identity. Record actual agent/model/reasoning in the report
when known. Never rewrite `ed715326` or other pushed history.

## Offline validation

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `git diff --check`
on the task branch. Focused mocked tests cover invalid-output exit status and
summary rejection/sanitization. These checks do not contact providers or dispatch
Actions and do not prove the future GitHub environment configuration.

In the Codex executor, the default Turbopack build cannot bind the local port
needed by its CSS worker (`Operation not permitted`). A direct Webpack build
also failed because this executor delivered empty stdout from Next's spawned
TypeScript CLI `--showConfig` despite a zero exit code. A temporary, restored
`experimental.useTypeScriptCli: false` setting let `next build --webpack` finish
with Next's TypeScript compiler API check, all static pages, and build traces.
This is a production build with type validation, but does not validate the
repository's default Turbopack path. Recheck that path in a suitable executor
before treating the normal build gate as passed.
