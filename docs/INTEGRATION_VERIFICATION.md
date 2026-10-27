# Reduced-schema integration verification

This is preparation, not authorization to merge, dispatch, spend, change secrets,
enable AI or call the public endpoint. Issue #14 remains open for Redis/Vercel checks. The application
gate stays disabled; the original PR7 workflow and frozen target are unchanged.

## What the proposed workflow verifies

`.github/workflows/integration-verification.yml` is manual-only, main-only,
repository-restricted and first-attempt-only. Its approved application target is
`29801e52385cf8a7ceb481157e727f8bebec66f7`. An input and protected-environment
variable `INTEGRATION_APPROVED_TARGET_SHA` must both equal that literal.

Only owner account `lutfim22` may initiate the job: both `github.actor` and
`github.triggering_actor` must match. The protected-environment variable
`INTEGRATION_APPROVED_CONTROL_SHA` must equal the exact full dispatch `github.sha`.
Missing, malformed or mismatched control approval fails before checkout/install
or provider access. A new control commit requires a new explicit review and
approved-control value; a branch name or PR-head/preview SHA is not an approval
for the eventual main merge commit.

The workflow checks out its exact dispatch control SHA and verifies that the target
is an ancestor. Every changed path between target and control must be one of the
explicitly listed verification scripts, tests, workflow or documentation paths.
Any application, dependency, tsconfig, old workflow or old diagnostics difference
stops the run before installation/provider access. Thus the application modules
executed from the control checkout are byte-for-byte the approved target's code.
A future unrelated main change also blocks execution until a reviewed target or
parity-policy update; do not weaken the guard to work around it.

`scripts/verify-gemini-integration.ts` uses the existing deterministic simulator,
application `investigate` service and diagnostic error classifier. It supplies
three simulated spike/offline/recovery events, with original timestamps and no
GitHub, physical device, Redis or public endpoint requests. The service constructs
the actual reduced provider schema/system prompt and applies local Zod and
evidence-ID checks. The injected generator makes **one** SDK generation call,
with SDK retries disabled, 8,192 maximum output tokens and an explicitly approved
1-25 second deadline. Gemini 3 thinking / earlier-model temperature settings match
the application adapter. The application's three-attempt retry adapter is not used.

Only one strict summary is allowed: target/model/deadline, attempts, event count,
duration, HTTP status, fixed category, outcome and local-validation status.
HTTP 200 means a provider response was received; only `validation=passed` confirms
the result also passed local schema/evidence validation. It does not prove the
truth of model conclusions. Malformed/extra records or fields fail closed; any
unsuccessful summary or nonzero probe exit fails the workflow. Stdout/stderr are
captured privately and deleted unconditionally, without artifact upload. Raw
errors, prompts, event IDs, model responses, keys and headers are never published.

## Solo-account approval model

This path is for a solo developer: `lutfim22` both starts the workflow and later
approves the environment deployment. It deliberately allows self-review in
`integration-live-verification` while retaining a required reviewer and disabling
administrator bypass. There is **no independent second-person review**. An owner
must explicitly accept this trade-off before setup or execution. Actor restrictions
and the approved-control SHA reduce accidental/wrong-source execution; they do
not make the two actions independent or protect against a compromised owner account.

The original PR7 environment/workflow retains its existing policy. Do not disable
protections there, or change the application AI gate, to make this path work.

## Required owner actions before any future dispatch

1. Review and separately approve merging the solo control change. A workflow on
   a draft branch is not a dispatch workaround for GitHub's default-branch rule.
2. In a browser, open repository **Settings → Environments → integration-live-verification**
   (create it only under separate setup authorization). Enable **Required reviewers**
   with `lutfim22`. Leave **Prevent self-review** unchecked for this environment.
   Disable **Allow administrators to bypass configured protection rules**. Under
   **Deployment branches and tags**, select **Selected branches and tags** and allow
   only the `main` branch, without a tag wildcard. Save and verify all settings.
   Naming an environment in YAML does not establish these protections. Do not
   dispatch if the repository plan cannot enforce the required-reviewer gate.
3. Through a separately approved setup, put `INTEGRATION_GEMINI_API_KEY` in that
   environment only. Under that environment's variables, set
   `INTEGRATION_APPROVED_TARGET_SHA` to the target above and
   `INTEGRATION_APPROVED_CONTROL_SHA` to the exact reviewed full main merge commit
   containing this solo change, after its separately approved merge. Do not use the
   application target SHA in place of the control merge SHA.
   The dedicated secret name prevents fallback to the legacy repository
   `GEMINI_API_KEY`. Do not create a repository/organization secret with the new
   name either. The workflow maps it to the SDK's `GEMINI_API_KEY` only in the
   probe step. Never send key values in chat. No setup is performed by this PR.
4. Confirm the real model identifier, approved timeout, provider project, current
   remaining quota, applicable pricing/free-tier eligibility and maximum monetary
   exposure. No model discovery is included. One request, token bounds and billing
   alerts are not a hard monetary spending cap. Stop if acceptable exposure cannot
   be established; do not reuse historical budget approvals.
5. Obtain fresh explicit permission for **one dispatch / at most one request**,
   naming both control and target SHA, model, timeout and monetary limit. The
   `approval_issue` input is a reference; it cannot machine-verify human consent.
   The protected reviewer must verify all inputs before releasing the job.

After all prerequisites and fresh one-run permission are confirmed, the owner
uses **Actions → Reviewed reduced-schema verification → Run workflow** on `main`,
with the agreed target/model/deadline/issue inputs. The run then waits at the
environment gate. Open that run's **Review deployments**, select
`integration-live-verification`, inspect the exact control SHA and approved scope,
then choose **Approve and deploy** to release the single probe. The GitHub wording
refers to the environment job: this does not deploy the application or enable AI.
Do not use an administrator bypass. Verify the required-reviewer gate in Settings
before dispatch; a live run is not a safe test of environment protection. If an
unexpected execution starts, cancel it, treat that run's one-request permission
as consumed and do not rerun without fresh authorization.

The CLI additionally requires `INTEGRATION_VERIFICATION_AUTHORIZED=1`, the exact
`TARGET_SHA`, a key, explicit `GEMINI_MODEL` and `GEMINI_TIMEOUT_MS`; missing or
invalid configuration fails before client construction. That marker is a guard
against accidental invocation, not proof of owner consent. The workflow supplies
it only in the single secret-bearing step after guards and secret-free install.

No rerun, retry, matrix or follow-up request is authorized by one dispatch approval.
Rerun attempts are skipped; a skipped job is not verification evidence. A fresh
dispatch still needs fresh permission. Stop on 400/429/503/504, timeout or invalid
output and report the sanitized result instead of trying another model or request.

## Scope after a successful future probe

A successful probe verifies reduced-schema acceptance and local domain validation
for one approved model/input. It does not test Vercel host/IP trust, authentication,
Redis atomicity, quota exhaustion, lease behavior, costs under public traffic or
the production retry adapter. Separate Redis databases and authorized isolated
deployment tests are still required before AI activation. The application feature
gate and Vercel secrets are not changed by this workflow. Keep Issue #14 open
until all agreed verification criteria are supported by actual evidence.

Offline checks use injected mocks; they do not contact Gemini or prove live acceptance.

## Verified Gemini milestone and the next separate scope

[Run 40595678687](https://github.com/lutfim22/opsreplay/actions/runs/40595678687)
passed for `gemini-3.5-flash-lite`: one request, three simulated events, HTTP 200,
1,997 ms, and local schema/evidence-ID validation passed. Control was
`6b3e5996f1aded1b07cf2043e58e5c8e1115e798`; the application target was
`29801e52385cf8a7ceb481157e727f8bebec66f7`. This does not verify another model,
the deployed endpoint, Redis, retry behavior, causal truth or actual monetary cost.
That one-run permission is consumed. The prior `gemini-2.5-flash` run returned 404.
The exact current checkpoint and any future permission live in Issue #14.

### Redis verification preparation — no live run authorized by this change

`redis-verification.yml` is a separate manual-only, owner/main/first-attempt-only
workflow. It uses **integration-redis-verification**, not PR7's Environment or the
Gemini Environment. It checks exact approved target/control/host and an explicit
isolation attestation before checkout, then frozen install without credentials.
Its baseline is `6b3e5996f1aded1b07cf2043e58e5c8e1115e798`. Only the Redis
workflow, its three scripts, its two test files and this document may differ.
Application/dependency/Gemini-workflow differences fail before Redis access.

`verify-redis-integration.ts` invokes the existing `reserveQuota`/release adapter
and the unmodified application Lua script. It does not construct a Gemini client
or call a public endpoint. It runs these fixed cases, stopping at the first failure:

| Case | Pass criterion |
| --- | --- |
| Concurrent requests and release | Eight parallel reservations yield exactly three leases and five denials with Retry-After 1; release empties the active set and another reservation succeeds. |
| Client minute | Seed count 4; one reservation reaches 5, the next is denied with Retry-After 1–60, and denied/released requests do not incorrectly change counters. |
| Client day | Seed count 14; one reaches 15, the next is denied with Retry-After 1–86400. |
| Global day | Seed count 99; one reaches 100, the next is denied with Retry-After 1–86400. |
| Expired leases | Three deliberately expired sorted-set entries are pruned by the actual reservation script; one new lease has TTL >0 and <=60000 ms, and release empties the set. |

The last case checks server-side expiry pruning and lease TTL configuration. It
does **not** wait 60 seconds to prove natural expiry, crash recovery under real
traffic, or rollover at midnight. If a minute/day bucket rolls over during a case,
the run stops with `clock_boundary` and needs fresh permission, not a retry.
Mocked tests exercise outage, malformed responses and missing release behavior;
they do not establish live outage/failover behavior or execute a real Lua server.

### Database isolation and cleanup contract

This is a **write test**, not a read-only check. Use a dedicated empty Upstash
database that is **not connected to any Production, Preview, local app, other
project or concurrent user**. The application's quota prefix is hardcoded;
different client IDs alone do not isolate global counters/leases. Do not link this
test database to Vercel's runtime environments when provisioning it. A database
name, hostname approval or empty check cannot independently prove that isolation;
the owner must verify it in the provider dashboard before releasing the job.

The runner accepts only an exact approved `*.upstash.io` hostname and HTTPS root
URL, without credentials/port/path/query/fragment. Redirects are rejected. An
atomic `DBSIZE` check claims a 120-second ownership lock only if the database is
empty; a nonempty database is neither mutated nor cleaned by the harness.
Before application requests, the harness registers exact possible test keys for
the next 90 seconds of UTC buckets. Resets/final cleanup require the lock token,
validate a maximum 16-key manifest, and delete only those registered keys.
Unexpected keys are never deleted; lost ownership or unexpected remaining data
fails the run. There is no FLUSHALL, broad key scan or deletion of preexisting data.

Main work has a 90-second deadline, each REST request a two-second deadline, and
the total bound is **64 REST requests including cleanup**, with one slot reserved
for final cleanup. No HTTP retry, workflow rerun or alternate endpoint is allowed.
The five successful scenarios make 16 application reservations (eight allowed,
eight denied), eight releases and 43 REST requests in total. Based on the reviewed
bounded scripts, a conservative ceiling is 2,048 Redis command invocations
(64 requests × 32 including EVAL/internal commands), not 64 billable commands.
Provider billing, quotas and pricing must still be reviewed before a live run;
request/command bounds are not a hard monetary cap.

Cleanup is best effort on failure, not a rollback guarantee. A timed-out write may
still execute after the client stops; termination can prevent cleanup; counters
can persist until UTC expiry. After uncertain transport failure/cancellation or a
cleanup failure, inspect and discard the dedicated test database through a
separately authorized provider action. Do not reuse it or run another test to
clean it. Only the fixture seed/manifest/lock expirations are short-lived; do not
claim all application keys automatically disappear after two minutes.

The single public summary includes only target/control SHA, fixed category,
completed check names, cleanup status, request/attempt counts and duration. The
checker rejects unknown fields, multiple records, wrong control/target, missing
checks or unsuccessful summaries; exit 0 alone is insufficient. Raw provider
errors, hostnames, keys, tokens, lock IDs and private stdout/stderr stay out of the
published summary. Private files are always removed, with no artifact upload.

### Future owner setup and permission — not performed by this PR

Do not configure secrets, provision a database, dispatch, merge or deploy an
enabled app merely because this draft/CI passes. After separately approving a
merge and a dedicated database with an acceptable plan/cost, create/open exact
GitHub Environment **integration-redis-verification**. Require reviewer `lutfim22`,
allow self-review only there, disable administrator bypass, allow branch `main`
only and save all settings. This remains solo approval, not independent review.
If the required-reviewer capability is unavailable, stop; do not test with a run.

In **that Environment's Variables**, configure:

| Name | Value |
| --- | --- |
| `INTEGRATION_REDIS_APPROVED_TARGET_SHA` | `6b3e5996f1aded1b07cf2043e58e5c8e1115e798` |
| `INTEGRATION_REDIS_APPROVED_CONTROL_SHA` | Exact separately reviewed eventual main merge SHA, not this baseline, PR head or branch name |
| `INTEGRATION_REDIS_APPROVED_HOST` | Exact hostname of the dedicated verification database, without scheme/path |
| `INTEGRATION_REDIS_ISOLATED_DATABASE` | `1`, only after confirming isolation and write-test consent |

In **that Environment's Secrets only**, enter `INTEGRATION_REDIS_REST_URL` and
`INTEGRATION_REDIS_REST_TOKEN` directly in GitHub. Never share values in chat,
screenshots, repository/organization secrets or Vercel runtime configuration.
There is no fallback to legacy/runtime Redis credentials. The probe step alone
receives them; install/checker steps do not.

Obtain fresh consent naming exact target/control/host, an empty isolated database,
one dispatch, up to 64 REST requests/2,048 Redis commands, fixture writes and owned
key deletion, cleanup limitations, and an acceptable monetary exposure. The
workflow cannot verify human consent or enforce a monetary cap. Then the owner
may use `Run workflow` from `main` with `target_sha`, `database_host` and
`approval_issue=14`, review the exact commit/inputs at `Review deployments`, and
release only `integration-redis-verification`. Do not bypass protection. A failed
run still consumes one-dispatch consent; do not click Re-run. The connector cannot
perform owner Environment/secret setup or dispatch/release actions.

### Effect on existing Gemini parity and remaining work

This PR adds Redis paths outside the existing Gemini workflow's eight-path parity
allowlist. **That unchanged guard will block a new Gemini run from a main commit
containing these files.** This is intentional fail-closed behavior, not permission
to widen its allowlist or update its target/approval variables. Past successful
run evidence remains valid for its immutable control. Any future Gemini rerun
needs a separate target/control/parity review and fresh paid-run consent.

Successful Redis verification would still leave deployed Vercel origin/forwarded
host/IP trust, access control, Preview/Production database isolation, natural
lease expiry and public cost exposure to verify or explicitly decide before
activation. Keep `INVESTIGATE_ENABLED` absent/disabled. Keep Issue #14 open until
all agreed criteria have evidence; do not close it on a green prep CI or Redis run.
