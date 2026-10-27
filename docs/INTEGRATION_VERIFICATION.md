# Reduced-schema integration verification

This is preparation, not authorization to merge, dispatch, spend, change secrets,
enable AI or call the public endpoint. Issue #14 remains unverified. The application
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
