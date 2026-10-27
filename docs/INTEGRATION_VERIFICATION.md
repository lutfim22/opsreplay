# Reduced-schema integration verification

This is preparation, not authorization to merge, dispatch, spend, change secrets,
enable AI or call the public endpoint. Issue #14 remains unverified. The application
gate stays disabled; the original PR7 workflow and frozen target are unchanged.

## What the proposed workflow verifies

`.github/workflows/integration-verification.yml` is manual-only, main-only,
repository-restricted and first-attempt-only. Its approved application target is
`29801e52385cf8a7ceb481157e727f8bebec66f7`. An input and protected-environment
variable `INTEGRATION_APPROVED_TARGET_SHA` must both equal that literal.

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

## Required owner actions before any future dispatch

1. Review and separately approve merging this draft control change. A workflow on
   a draft branch is not a dispatch workaround for GitHub's default-branch rule.
2. Provision and verify `integration-live-verification` protections: required
   reviewers, prevent self-review, no administrator bypass and main-only deployment
   policy. Naming an environment in YAML does not establish these protections.
   Do not dispatch if the repository plan cannot enforce them.
3. Through a separately approved setup, put `INTEGRATION_GEMINI_API_KEY` in that
   environment only and set `INTEGRATION_APPROVED_TARGET_SHA` to the target above.
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
