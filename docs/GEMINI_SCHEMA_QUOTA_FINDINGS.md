# Gemini schema and quota findings (Issue #19)

Offline review only. No provider request, credential access, workflow dispatch,
rerun, secret change or deployment was performed. The reviewed PR7 target
`ed7153260b6cf8a79b634191faf917b706fdb49f` was read only and remains unchanged.

## Confirmed evidence

- Issue #19 reports sanitized results for `gemini-3.6-flash` with a 25 second
  timeout: JSON mode without a schema returned HTTP 200 in 857 ms; the simple
  prompt with the full investigation schema returned HTTP 400 in 3266 ms; and
  the three-event full investigation returned HTTP 429 in 92 ms. The raw provider
  error was withheld, so no specific field or quota is identified by this
  evidence.
- The immutable target's `lib/investigation/schema.ts` passes
  `investigationResponseJsonSchema` as `responseJsonSchema`. Its schema includes
  nested arrays, `minItems`/`maxItems`, descriptions and string length limits.
  `lib/investigation/gemini.ts` maps 429 to the fixed `quota` category and retries
  only 503/504; it does not retry 400 or 429.
- The target manifest requires `@google/genai` `^2.31.0`; the local lockfile and
  installed package resolve to 2.31.0. That SDK's local `TextResponseFormat`
  contract says `minLength`/`maxLength` are ignored, `minItems`/`maxItems` are
  enforced, and overly complex schemas (including large bounds on nested arrays)
  can return 400 `INVALID_ARGUMENT`.
- Before this change, the diagnostics runner continued to the next probe after
  any failure. The live sequence therefore issued its event-bearing request
  after the earlier schema request had already returned 400.

## Diagnosis and limits

The 400 confirms rejection of the schema-bearing request, but does not identify
the rejected schema feature. Nested bounded arrays are a documented compatibility
risk and a plausible cause. String length bounds are documented as ignored, so
their presence alone is not evidence that they caused this 400. Schema size,
model-specific support, or another request detail remain possible. A sanitized
provider field path or a separately approved schema matrix would be needed to
narrow this down; neither is available here.

The 429 is consistent with quota/rate limiting, but the 92 ms response does not
identify which limit applied. Possible causes include request rate, daily
request or token limits, concurrent usage, project/model-specific limits, or
other quota configuration. The issue notes that a failed 400 request may still
count against rate limits, but that was not independently verified. No exact
quota root cause can be asserted without the provider's quota view and response
metadata.

## Change and validation

The diagnostics now stop after the first unsuccessful probe, avoiding known
unnecessary follow-up requests after an upstream failure. Mocked tests cover a
successful no-schema control followed by a rejected schema request, verify the
runner stops before the event-bearing probe, and verify provider details remain
redacted. This is not evidence that Gemini accepts the schema or that a live
quota issue is resolved. The PR7 application schema was not changed based on an
unconfirmed root cause; any schema simplification should be proposed separately
against the production implementation with the result validator retained.

## Prerequisites for further live verification

Any new live check requires fresh explicit authorization for the exact model,
schema/probe count, timeout and cost limit, plus owner review of the applicable
project quota and deployment configuration. Use an isolated approved environment
and sanitized output. Do not treat this offline patch or its mocked tests as a
live verification pass.
