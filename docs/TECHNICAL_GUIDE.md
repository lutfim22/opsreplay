# OpsReplay — Technical Handbook

Prepared: October 28, 2026.

## 1. Scope, evidence and reading map

This handbook is for an engineer who has not worked on OpsReplay. It documents the reviewed implementation, its operating boundaries and where to change it. It is not an instruction to provision resources or make another provider request.

OpsReplay is a Next.js incident-investigation prototype. It combines browser-local simulated smart-plug events and read-only public GitHub activity in a unified timeline. An explicit operator action can submit the filtered events to server-side Gemini. The response separates facts, hypotheses, recommended checks and limitations, with references to submitted events.

| Reference | Verified application source |
| --- | --- |
| Main | `9485fb6500ae105a8e0192ef33d10ac7a80fbbdb` |
| Enabled AI Preview | `aabb69831a94cf748d7f76d1f112aca05b6d39c0` |
| Shared application tree | `bd52bd079b703365d331a17fcc6e78b53edd7127` |
| Documentation review | PR #31; documentation revisions do not change application behavior |

Read chapters 2–7 for architecture and contracts, 8–12 for AI/quota/client behavior, and 13–18 for onboarding, operations and verification. The audience-facing demo and presenter notes are separate documents.

The public application has AI OFF. One protected Preview UI investigation passed. There is no physical device adapter, application user login, persisted incident store, streaming response or automatic remediation. A schema admitting a `shelly` provider is not an implemented Shelly integration. Mock dashboard incidents are not live incidents.

Historical results below are immutable evidence for their tested source/input, not a claim that every future model, deployment or request will work.

## 2. Architecture and module ownership

The browser owns presentation, simulator data and filter state. Next.js Route Handlers own external API access. Domain logic is separated from React so that event handling, validation and quota decisions can be tested independently.

| Module | Responsibility |
| --- | --- |
| `app/api/github/events/route.ts` | Public repository input and GitHub response/error envelope |
| `lib/github/{repo,raw,client,mapping}.ts` | Repository syntax, upstream validation, fetch orchestration and normalization |
| `lib/events/{schema,source,engine,anomaly}.ts` | `OpsEvent`, normalization, ordering/deduplication and deterministic rules |
| `lib/simulator/virtual-plug.ts` | Fixed simulated smart-plug script |
| `lib/timeline/{timeline,github-data,describe}.ts` | Merge/filter/alignment, load states and descriptions |
| `components/timeline/unified-timeline.tsx` | Browser repository loading and timeline controls |
| `components/timeline/investigation-panel.tsx` | Explicit AI action, submitted snapshot, stale warning and evidence chips |
| `app/api/investigate/route.ts` | Feature gate, input checks, quota reservation and response |
| `lib/investigation/{config,request,quota,gemini,service}.ts` | Runtime settings and server-side investigation pipeline |
| `lib/investigation/{schema,prompt,evidence,client,stale,errors}.ts` | Shared contracts, prompt boundary, validation, UI adapter and errors |

Upstash Redis stores quota counters and active leases; it does not persist the timeline or AI results. GitHub and Gemini are external services. Browser memory is not durable storage.

For the tested AI Preview, Vercel login protects the deployment before its routes are reached. This is deployment access control, not application authentication. Production and Preview secrets/databases must be scoped independently; a feature gate alone does not isolate credentials.

## 3. Two request flows and trust boundaries

**GitHub flow:** browser → `GET /api/github/events` → validate `owner/repo` → verify repository metadata is public → fetch activity → validate/normalize records → return events/warnings → merge in browser.

**Investigation flow:** browser button → `POST /api/investigate` → `readConfig` → exact feature gate → origin check → API-key presence → bounded JSON parsing → shared quota reservation → prompt/provider request → local result/evidence validation → JSON response → lease release in `finally`.

The feature gate runs before reading the body, reserving quota or constructing the Gemini client. With the gate enabled, malformed or oversized input is rejected before provider usage. Redis availability is required on Vercel; its Preview target also runs with `NODE_ENV=production` and ignores the local bypass.

The route's `maxDuration` is 60 seconds. The Gemini adapter's configured default is 25 seconds, capped at 55 seconds. This deadline bounds the provider stage, not a guaranteed full browser or route duration. Redis commands have their own two-second abort timer; reservation, result validation and release add work outside the provider timer.

The route awaits its `finally` release before completing the response, but the release function swallows cleanup errors and relies on lease expiry. Therefore a successful UI result does not independently prove that the Redis member was deleted.

Browser cancellation can stop waiting for a response. It is not proof that an already-started server/provider call stopped or was unbilled. Never use repeated clicks or refreshes as a safe cancellation/retry strategy.

## 4. OpsEvent contract and deterministic simulator

`lib/events/schema.ts` defines a strict object: required `id`, `source`, `type`, ISO `timestamp`, `severity` and `payload`; optional `deviceId` and numeric `metrics`. Source has `provider`, nonempty `name` and `simulated`. Metrics may include `powerW`, `voltageV`, `currentA` and `energyWh`; supplied numbers must be finite and nonnegative. Type uses a dotted form such as `power.reading`.

Simulator events must be marked simulated; GitHub events must be marked real. The shared engine orders by original timestamp, then ID, and deduplicates first-wins by ID. Duplicate IDs do not update the previous record. Source-specific mapping is responsible for stable, meaningful IDs.

The smart-plug script uses `sim-plug-01`, a fixed start of `2025-01-01T09:00:00.000Z`, five-second steps and a five-minute window. It reads no wall clock and uses no random values. Normal readings follow a fixed 42–46 W pattern; spike readings are 820 W, 1850 W and 1720 W. The offline window begins at offset 180 seconds; recovery occurs at 215 seconds. Readings pause during the offline window.

| Event | Original UTC | Record identity |
| --- | --- | --- |
| 1850 W / 230 V | 09:01:45 | `sim-0021` |
| 1720 W / 230 V | 09:01:50 | `sim-0022` |
| Offline | 09:03:00 | `sim-0036` |

These are reproducible simulator records, not physical measurements. The source enum also permits `shelly`, but this repository does not provide a physical-device transport adapter.

## 5. Public GitHub ingestion and failure semantics

`GET /api/github/events?repo=owner/repo` defaults to `lutfim22/opsreplay`. Repository parsing constrains owner/name syntax before building fixed `api.github.com` URLs. Optional `GITHUB_TOKEN` stays server-side. A token does not enable private repositories: the repository metadata check rejects `private=true`.

A successful complete load normally makes **four upstream requests**: one repository metadata request, then commits, pull requests and workflow runs in parallel. Each activity collection defaults to 30 records, with no pagination. This is a read-only polling/load path, not webhooks or a streaming subscription. Unauthenticated GitHub allowance is shared by the server's upstream IP; token/account limits vary.

| Collection | Timestamp / ID policy |
| --- | --- |
| Commit | Committer date, else author date; ID includes repository and SHA |
| Pull request | `updated_at`; ID includes repository and PR record ID |
| Workflow run | `updated_at`; ID includes repository, run ID and attempt |

These are activity timestamps, not proof that a deployment was applied to a device. PR and workflow timestamps can reflect later updates.

Commit/PR failures fail the load. A non-rate/network Actions failure may retain commits/PRs with a warning. Rate-limit or network failures from any collection fail the load. Invalid records are skipped with warnings. No usable GitHub data means the timeline shows simulator events with an explicit warning; it never fabricates GitHub replacements.

The server-side GitHub fetch wrapper currently has no explicit timeout/abort deadline. Browser fetch cancellation does not establish cancellation of upstream server work. Do not mistake the Gemini deadline for a GitHub timeout.

## 6. Timeline, anomaly rules and display alignment

`buildTimeline` validates the IoT/GitHub inputs separately, preventing one input side from masquerading as the other. It merges original events, computes anomalies in original chronological order, derives entry severity, applies optional display alignment and sorts entries by display timestamp then ID.

Power anomaly thresholds are **500 W warning** and **1500 W critical**. `device.offline` is critical; a later matching `device.online` is a recovery. Device state is keyed by provider, source name, simulated flag and device ID, preventing state collision between unrelated sources.

`TimelineEntry.severity` is the maximum of original event severity and anomaly severity. **Important contract detail:** the UI passes `visible.map(entry => entry.event)` to AI, not the derived `TimelineEntry`. A simulated power record has original severity `info` even when its effective timeline severity is Critical. The provider receives its original metrics and severity, but not the timeline anomaly object or threshold policy. A Critical filter selects those records; it does not rewrite them. Do not claim the model is told every UI anomaly classification. This also helps explain why a valid result can still use debatable wording about a reading being “normal.”

Demo Time Alignment shifts only simulated display timestamps so the latest simulated event aligns with the latest GitHub event. Both source timestamps stay unchanged; GitHub timestamps are never shifted. Missing either side means no usable offset. The AI receives original timestamps and a display-setting hint, never shifted evidence timestamps.

Source/Severity filters determine all visible AI input. The tested IoT/Critical combination contains the two critical power readings and offline event. Recovery and the 820 W warning are excluded; there is no row-selection UI.

## 7. Investigation HTTP contract

`POST /api/investigate` accepts JSON only. The strict request root contains `events` (1–200 valid `OpsEvent` objects) and optional boolean `demoAlignment`. Maximum body size is 512 KiB; streamed reads cancel once the limit is exceeded. A declared excessive Content-Length is rejected early. Prompt size is separately capped at 256 KiB.

```json
{
  "events": [{
    "id": "example-1",
    "source": {"provider":"simulator","name":"example","simulated":true},
    "type": "device.offline",
    "timestamp": "2025-01-01T09:03:00.000Z",
    "severity": "critical",
    "deviceId": "sim-plug-01",
    "payload": {"simulated":true}
  }],
  "demoAlignment": false
}
```

This is a **contract example**, not a dispatch instruction or the actual three-event verification payload.

Success is `{ok:true,result,meta}`; `meta` has `model`, `eventCount` and `generatedAt`. Failures use `{ok:false,error:{kind,message,retryAfterSeconds?}}`. Responses use `Cache-Control: no-store`; quota denials include `Retry-After` when available.

Origin enforcement compares `new URL(origin).host` with `x-forwarded-host`, falling back to Host. Missing Origin is allowed. Scheme is not compared, so this is a host comparison rather than full-origin equality. It is not authentication. Trusted proxy behavior is an unresolved deployment boundary.

Invalid-input errors expose a bounded first validation issue location/message, not a raw submitted body. Unexpected errors map to a generic upstream failure. See chapter 14 for exact HTTP/error kinds.

## 8. Prompt boundary and Gemini adapter

`prompt.ts` sorts events by original timestamp and maps them to ID, provenance, source, type, originalTimestamp, original severity, device ID, metrics and bounded payload. Provenance distinguishes `real_github`, `simulated_iot` and possible real-device data. Payload strings are limited to 500 characters, arrays to 20 items, nesting at depth four, and object keys to 100 characters; the final prompt cap still applies.

Event text is untrusted data inside `<untrusted_events>` delimiters. Less-than characters are escaped in its JSON, preventing data from closing the delimiter. Instructions ask for submitted-event citations, explicit simulation/uncertainty, missing evidence and read-only checks. These controls reduce prompt-injection exposure; they do not prove all model behavior is safe or correct.

The adapter sends `investigationProviderResponseJsonSchema`, not the historical full diagnostic schema. It requests JSON output and 8192 maximum output tokens. Gemini 3-family IDs select LOW thinking; other model names use temperature 0.2. Model selection must be explicit for live verification: the source default is `gemini-2.5-flash`, while the observed working model is `gemini-3.5-flash-lite`.

At most three application attempts occur only for 503/504, with bounded jittered backoff inside one total deadline. SDK retries are set to one attempt with no retry status list. 429 does not receive an application retry. There is no model fallback.

A success log marks provider completion **before** local JSON/schema/evidence validation. It is not sufficient by itself to certify a usable UI result. Raw provider messages, prompts and output are not logged by this adapter.

## 9. Result schema and evidence validation

Provider JSON must parse and pass `investigationResultSchema` locally. The reduced provider schema preserves structure, required fields and confidence enum; local Zod enforces bounds that were removed from the provider-facing contract for compatibility.

| Field | Local constraints |
| --- | --- |
| `summary` | Trimmed nonempty string, max 2000 characters |
| `observedFacts` | At most 30; statement max 600 characters; each cites 1–30 IDs |
| `hypotheses` | At most 8; title max 200; reasoning max 1500; confidence low/medium/high |
| Hypothesis evidence | 1–30 supporting IDs; up to 10 missing-evidence strings, each max 400 |
| `recommendedNextChecks` | Up to 10 strings, each max 400 |
| `limitations` | Up to 10 strings, each max 400 |

Referenced IDs are nonempty strings of at most 300 characters. Every explicit evidence ID must belong to the submitted event set. Free-text fields are additionally scanned for known GitHub/simulator ID-shaped mentions; an unknown matching ID discards the response. This pattern check is not an exhaustive factual checker or a detector of every possible invented statement.

The request root uses strict validation. Do not infer that unknown result properties are similarly rejected: ordinary Zod objects in the result contract use their default parsing behavior. Validation concerns the parsed result and its bounded fields.

Evidence chips resolve against the submitted snapshot, not whatever events a later filter happens to show. A chip is a button that tries to scroll to the event row; it is not an immutable exported evidence archive. If filters remove the row, a scroll target may be absent. GitHub timeline entries separately link to public original records.

Reference membership establishes traceability to input. It does not prove source authenticity, physical reality, semantic correctness, confidence calibration or causation.

## 10. Shared Redis quota and cleanup behavior

`quota.ts` calls Upstash REST with a two-second abort timer per command. One Lua reservation uses Redis TIME for UTC minute/day boundaries, prunes expired active entries, checks all limits and increments accepted counters atomically.

| Limit | Behavior |
| --- | --- |
| Global/day | 100 accepted requests, counter expires at next UTC day |
| Client/minute | 5, expires at next UTC minute |
| Client/day | 15, expires at next UTC day |
| Concurrency | 3 active leases; each accepted lease expires after 60 seconds |

Key namespace is hardcoded `opsreplay:investigate:v1:`. Keys cover a global day counter, client minute/day counters and the `active` sorted set. Separate client IDs do **not** isolate environments because global/active keys are shared. Use separate databases for independent runtimes.

Client identity hashes one syntactically valid `x-forwarded-for` IP only when `VERCEL=1`. Missing, multi-address or invalid values use a shared `anonymous` bucket. A hash is not user identity, and direct Vercel proxy header behavior still requires deployment-level verification.

Denials do not increment accepted request counters, although the script can prune expired leases before denying. An accepted request spends its allowance even when Gemini or validation fails. Provider retries can incur up to three calls for that one allowance.

Release issues `ZREM` for its own UUID; failure is swallowed and expiry is the fallback. New reservations prune expired members. This is best effort, not guaranteed immediate cleanup. An aborted REST request may have executed remotely; do not automatically replay it assuming no mutation occurred. Missing/unusable Redis fails closed before Gemini on Vercel.

## 11. Configuration, environments and costs

All provider/storage settings are server-only. Never prefix them with `NEXT_PUBLIC_`, commit values, pull secret material into review artifacts or request it in chat.

| Variable | Source behavior |
| --- | --- |
| `INVESTIGATE_ENABLED` | Only exact `1` enables; default OFF |
| `GEMINI_API_KEY` | Required when enabled; trimmed server-side |
| `GEMINI_MODEL` | Valid `gemini-*` pattern, else fallback `gemini-2.5-flash` |
| `GEMINI_TIMEOUT_MS` | Positive integer; default 25000, max 55000 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Both required for shared quota; URL must satisfy configured HTTPS-root check |
| `INVESTIGATE_LOCAL_DEV_BYPASS` | Exact `1` permits local non-production limiter; ignored in production |
| `INVESTIGATE_RATE_LIMIT_PER_MINUTE` | Local limiter default 10, max 600 |
| `GITHUB_TOKEN` | Optional server-only public GitHub access allowance |

The verified Preview uses explicit `gemini-3.5-flash-lite`, timeout 25000 and branch-only credentials/gate on `codex/isolated-redis-verification`. Its Free Redis database was reassigned from isolated verification to this Preview. Never run the empty-database verification harness against that active database.

Production AI remains OFF. Deleting configuration entries does not erase secrets already injected into immutable historical deployments. The owner's earlier Production redeployment may retain old credentials even after correcting current scopes; isolation must not be claimed retroactively.

Source quotas, token caps, timeout and billing alerts are not a guaranteed monetary cap. The completed UI request had a USD 0.10 allowance; actual tokens/cost were not collected. That permission is consumed. Additional live use requires its own approved request count/cost scope. No paid Upstash upgrade or Prod Pack was needed for the completed test.

## 12. Client state, stale results and user actions

`UnifiedTimeline` loads GitHub data on mount/repository refresh, while simulator events are memoized in the browser. It derives visible original events from filter results. Loading GitHub data is an external API operation even when AI remains disabled.

The investigation panel disables submission while pending, with zero events or more than 200 events. It captures the submitted event array and alignment setting, aborts a previous browser request when starting a newer one, and stores the resulting outcome with that snapshot. Unmount aborts browser waiting.

Staleness compares the complete serialized event payload, sorted by ID to ignore display order, plus the alignment flag. Same IDs with changed content can therefore make a result stale. A stale warning means the result covers its old submitted input; it does not automatically refresh or issue another provider call.

The client validates the JSON response envelope. Malformed responses are discarded; there is no fabricated fallback analysis. Disabled, invalid_input, payload_too_large and forbidden are non-retryable UI kinds. Other failure kinds may expose a Retry button, but a visible button does not grant permission for another paid request.

Evidence chips use submitted event metadata and original timestamps. Scrolling depends on the corresponding timeline row remaining mounted. Confidence styling is a presentation convention, not a measured probability.

Changing Source/Severity only changes the current view/input candidate. It does not rewrite previous analysis or run AI. Demo Time Alignment is a display setting and part of the stale-input comparison, not evidence of synchronized physical clocks.

## 13. Local onboarding and verification commands

Use the repository's lockfile and `packageManager` pin, currently `pnpm@12.15.0`. CI uses Node 22 on Ubuntu 24.04. A different local runtime can produce toolchain differences; document it rather than silently changing dependency or build configuration.

```bash
git clone https://github.com/lutfim22/opsreplay.git
cd opsreplay
git checkout 9485fb6500ae105a8e0192ef33d10ac7a80fbbdb
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

These checks use mocked Gemini/Redis and need no live credentials. The source SHA reproduces the verified application; the documentation PR contains the newer reading material separately.

For intentional local UI inspection, copy `.env.example` to ignored `.env.local`, keep `INVESTIGATE_ENABLED=0`, and run `pnpm dev`. Opening `/timeline` or `/github` may fetch public GitHub data; this is not a fully offline browser exercise. Do not add keys or enable the local bypass merely to read documentation.

`AGENTS.md` requires lint, typecheck and build before committing. Its old “no external APIs/IoT yet” architecture sentence is historical; actual source and this scoped guide describe current modules. Do not interpret it as a reason to remove working integrations.

This managed environment has previously blocked Turbopack CSS worker port binding. Record a local build failure honestly and use the exact-head normal CI build for evidence; do not substitute a different bundler or weaken checks to obtain a green result. Offline unit tests do not prove provider, live Lua or deployment correctness.

## 14. Errors, observability and diagnosis

| HTTP | Error kind | First inspection; no automatic live retry |
| --- | --- | --- |
| 400 | `invalid_input` | JSON content type, strict event/root schema and current filter input |
| 403 | `forbidden` | Origin host, forwarded-host trust and intended deployment URL |
| 413 | `payload_too_large` | Body/event count and generated prompt size |
| 429 | `rate_limited` | Shared quota counters and Retry-After; do not bypass client identity |
| 429 | `quota` | Provider project/model allowance, not necessarily Redis |
| 503 | `disabled` | Exact feature opt-in and deployment snapshot |
| 503 | `not_configured` | Key presence/scope; never reveal its value |
| 503 | `quota_unavailable` | Redis presence/connectivity/REST result shape |
| 504 | `timeout` | Provider-stage deadline and sanitized attempt duration |
| 502 | `upstream` | Fixed provider error category/status, no raw message dump |
| 502 | `invalid_model_output` | JSON/schema/evidence validation; do not display rejected output |

The adapter logs status, category, durationMs, attempts, model and eventCount. Evidence rejection logs a count, not event contents. Unexpected route errors log only a name. Do not add prompts, responses, keys, tokens, event payloads or raw provider errors to logs/traces.

Scope inspection to the immutable deployment and a supported retention window. The Hobby account rejected a 24-hour runtime query; a 15-minute query worked. Empty error groups are not proof that all requests succeeded, nor a cost audit. Provider completion can precede later validation rejection; pair it with a successful UI response when claiming an end-to-end happy path.

Read configuration metadata without decrypting secrets. Troubleshoot by category and scope first; a raw secret dump is not a diagnostic method. Browser Retry and manual workflow reruns can consume new allowance and require separate authorization.

## 15. CI and manual verification workflows

The normal CI workflow is pull_request-triggered, contents-read, Ubuntu 24.04, Node 22 and pinned package manager from package.json. It installs with frozen lockfile, then runs lint, typecheck, tests and normal build. Its tests use mocked services. CI success does not imply a billable provider call happened.

| Workflow | Purpose / boundary |
| --- | --- |
| `ci.yml` | Automatic offline checks on PRs |
| `integration-preflight.yml` | Historical pinned offline integration; not a current release shortcut |
| `pr7-verification.yml` | Preserved immutable historical PR7 verification path |
| `gemini-diagnostics.yml` | Manual model/schema diagnostics; separate from runtime feature gate |
| `integration-verification.yml` | Reviewed reduced-schema one-request harness, exact control/target guards |
| `redis-verification.yml` | Reviewed isolated-empty-DB quota scenarios with bounded owned-key cleanup |

Diagnostics can call providers directly even when runtime AI is OFF. Manual workflows are not an alternate way to bypass UI or cost authorization. Environment names matter: `pr7-live-verification`, `integration-live-verification` and `integration-redis-verification` are distinct.

The reviewed Gemini/Redis harnesses enforce immutable target/control expectations and path-parity policies. Later source/documentation commits may fail those guards. Do not widen allowlists or update approved-control variables just to make a new run pass. Review compatible target/control/parity and obtain new consent before any future execution.

The database used by the passing Redis harness is now Preview-active. Repeating the isolated-empty-DB harness there is invalid. Preserve original PR7, its frozen anchor and the `backup-work-before-pr7` stash. Documentation PR31 neither replaces those controls nor authorizes a merge, Production activation or another dispatch.

## 16. Verification matrix: what the evidence proves

| Evidence | Result and practical limit |
| --- | --- |
| CI `40598088048` | 248 tests / 15 files, lint/typecheck/build passed for reviewed application tree; mocks are not live evidence |
| Gemini `40595678687` | One `gemini-3.5-flash-lite` request, HTTP 200, 1997 ms, validation passed; one input/model |
| Redis `40603979911` | Five bounded live scenarios, 43 REST requests, 16 reservations, cleanup passed; not full outage/rollover coverage |
| Protected Preview | Owner observed Vercel login required in logged-out Incognito; no separate anonymous HTTP trace |
| UI at `2026-10-28T01:11:40.028Z` | Provider status 200, success, one attempt, three events, 1623 ms; screenshot additionally supports local result validation |
| Docs CI `40615924402` | Original PR31 documentation head passed offline CI and build; later revisions require their own checks |

The successful UI input was two critical power readings plus offline, with Source IoT, Severity Critical and alignment OFF. It was not the spike/offline/recovery fixture from the direct diagnostic. It included zero GitHub events; mixed-source AI behavior was not separately verified by this run.

Redis scenarios cover concurrency/release, client minute/day and global day denials, and expired-lease pruning. Cleanup included an empty-database assertion at that time. It does not prove a later empty database, actual billable command count, natural crash-time lease expiry, UTC rollover, failover or deployed proxy trust.

No exact tokens/provider cost, browser-total latency or measured incident-resolution improvement was collected. Do not invent MTTR reduction, accuracy percentages, physical sensor validation or causation claims from these results. Public Production AI readiness remains a separate decision tracked in Issue #14.

## 17. Security, release criteria and unresolved work

| Area | Current state / next evidence needed |
| --- | --- |
| Access control | Private Preview protected; app itself unauthenticated. Define an explicit public access policy before enabling public AI. |
| Origin/host/IP | Missing Origin allowed; forwarded host/IP trust requires deployed negative tests at the intended boundary. |
| Database isolation | Current credentials branch-scoped; historical injected snapshots can retain old values. Retire/rotate through a separately approved plan if needed. |
| Quota/outage | Bounded Redis scenarios passed; deployed denial, outage and release-observation cases remain incomplete. |
| Expiry/time | Natural lease expiry, UTC rollover and failover need scoped tests or explicit residual-risk acceptance. |
| AI/cost | Working model verified once; request limits are not a hard budget. Define who can spend and how much. |
| Semantics | Derived anomaly severity is not sent as such; evidence validity does not establish model correctness. |

Keep Production AI default OFF until access, credentials/database, provider availability/cost, deployed failure behavior and owner release authorization are resolved. Do not infer authorization from a green build or an enabled private Preview.

Future tests should have a concrete target SHA/URL, isolated resources, request/mutation limits, cleanup plan and spending allowance. Prefer offline negative coverage before proposing any live request. Do not run destructive or production-quota experiments to “see if it works.”

For hackathon judging, use the public non-AI app plus saved result evidence, or an owner-authenticated presentation of the private Preview. No bypass links, shared sessions or disabled protection are required. Unverified areas belong in the technical record; the audience deck should make concise, honest product-scope statements rather than mix in release procedures.

## 18. Contribution map, terminology and references

| Change you need | Start here / relevant existing checks |
| --- | --- |
| New event adapter | `events/schema.ts`, `source.ts`, source mapper; event/source validation and dedup tests |
| Anomaly policy or filter | `events/anomaly.ts`, `timeline/timeline.ts`; threshold, severity, ordering and alignment regressions |
| AI result/prompt change | `investigation/schema.ts`, `prompt.ts`, `service.ts`, `evidence.ts`; domain/evidence tests plus separately reviewed provider compatibility |
| Quota policy | `investigation/quota.ts`; offline atomic-model tests and separately authorized isolated live Lua verification |
| UI result/staleness | `investigation-panel.tsx`, `stale.ts`, `client.ts`; complete-payload staleness and error parsing checks |

Review the actual diff and preserve security controls. Run repository-required checks; do not write tests that merely mirror a low-impact documentation change. A source change affecting paid calls needs a new review of execution scope, not a silent rerun of historical harnesses.

**Key terms:** provenance is source/origin metadata; evidence ID identifies submitted input; hypothesis is an unconfirmed explanation; feature gate is an explicit activation flag; quota is request allowance; concurrency lease is a temporary in-progress slot; fail closed means refusing work when required controls are unavailable. None of these imply a proven root cause or a monetary cap.

References: [repository](https://github.com/lutfim22/opsreplay), [reviewed source](https://github.com/lutfim22/opsreplay/tree/9485fb6500ae105a8e0192ef33d10ac7a80fbbdb), [Issue #14](https://github.com/lutfim22/opsreplay/issues/14), [PR #31](https://github.com/lutfim22/opsreplay/pull/31), and existing `docs/INTEGRATION_VERIFICATION.md` / `docs/GEMINI_SCHEMA_COMPATIBILITY.md` / `docs/PR7_VERIFICATION.md`.

The other two documents are audience-facing **Demo Deck** and private **Presenter Notes**. Keep their purposes separate: slides communicate the problem and demonstrated value; notes help delivery; this handbook explains implementation and operating limits.

