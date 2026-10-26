# Gemini structured output compatibility

This change separates Gemini's provider-facing `responseJsonSchema` from
OpsReplay's application validation. The provider schema retains the response
object structure, required fields and confidence enum. It omits string and
array bounds plus descriptions. Bounds remain enforced by
`investigationResultSchema` after parsing, followed by the submitted-event ID
checks; invalid or incomplete model output is discarded.

## Evidence and uncertainty

The installed `@google/genai` 2.31.0 `TextResponseFormat.schema` contract
states that `minLength` and `maxLength` are ignored, while `minItems` and
`maxItems` are enforced. It warns that schemas too complex to enforce,
including large bounds on nested arrays, can return HTTP 400
`INVALID_ARGUMENT`. The SDK types accept the schema as `unknown`; that type
does not validate Gemini compatibility.

The sanitized prior run established that JSON mode without a schema returned
HTTP 200 and the full investigation schema returned HTTP 400. It did not name a
rejected field. String length bounds alone are therefore not a confirmed
cause; nested array bounds are a documented risk and plausible cause, not a
diagnosis. The event-bearing HTTP 429 does not identify which quota or rate
limit applied. This offline change does not establish that Gemini accepts the
reduced schema.

## Future verification

A separate explicit authorization is required before any live check. Agree on
the exact model, one reduced-schema probe, timeout and cost ceiling; confirm the
project's applicable quota; use an isolated approved environment; and retain
only sanitized status/category output. Stop on the first unsuccessful probe.
Do not dispatch or rerun a workflow as part of this change. A successful mock
only verifies request construction and local rejection behavior.
