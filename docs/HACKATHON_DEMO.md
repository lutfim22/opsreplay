# OpsReplay — Demo

Audience material is English. Indonesian narration is provided separately in the local demo bundle. The verified story uses simulated device events; GitHub remains an additional implemented adapter with no software-to-device mapping. No alternative API is integrated yet.

## 1. The store is open. A device goes offline.

An illustrative scenario for a small retail business

DEVICE OFFLINE · Where do I start? · Power? · Connection? · Device?

## 2. The offline alert is only the last clue.

Reconstruct the sequence before deciding what to check.

Before the alert · 09:01:45   1850 W · 09:01:50   1720 W · Device: sim-plug-01 · The latest alert · 09:03:00   offline · Cause: unconfirmed · What evidence is missing? · ? · An event sequence helps investigation. Timing alone does not prove the cause.

## 3. Useful approaches already exist.

A documentation-based comparison — not a performance benchmark.

01 · Manual review · Open each source · Build the sequence · 02 / S2 · PagerDuty · Recent Changes · Changes in incident context · 03 / S3 · Datadog · Bits Investigation · AI + operational context · OpsReplay: replay device events and inspect the evidence behind an AI response.

## 4. OpsReplay turns events into an investigation.

The verified demo follows one device through its event history.

Device events · SIMULATED · Unified Timeline · Source / Severity · Gemini · Facts + hypotheses · Evidence chips · GitHub adapter is available separately. · Software-to-device mapping is not implemented.

## 5. What the prototype implements.

A working path, with clear module boundaries.

Simulator · Fixed event fixtures · GitHub adapter · Optional software context · Timeline · Source / Severity · Gemini adapter · Structured response · Validation · Schema + evidence IDs · Quota · Feature gate + Redis

## 6. Demo: replay one device going offline.

Recorded successful request · Source: IoT · Severity: Critical

SIMULATED · sim-plug-01  /  230 V · 1850 W · 09:01:45 UTC · 1720 W · 09:01:50 UTC · offline · 09:03:00 UTC · 3 SIMULATED EVENTS · 0 GITHUB EVENTS · Demo Time Alignment: OFF

## 7. The saved AI result is inspectable.

Protected Preview · recorded result · no new live request

3 · events · 1 · attempt · 1.623 s · provider stage · Hypotheses (unconfirmed) · Device failure or loss of connectivity · low confidence · not a confirmed root cause · Evidence IDs checked against the submitted events. · One observed result; not a latency benchmark.

## 8. A prototype with visible boundaries.

Evidence references are useful. They do not prove the root cause.

CURRENT · IoT · SIMULATED · AI verification · One IoT-only request · Access · Protected Preview · NOT YET · Physical devices · Hardware adapter · Relevant external context · Dependency mapping + adapter · Public AI · Access + cost controls

## 9. Next: connect the right operational context.

Add a relevant source, then verify the combined investigation.

01 · Cloud status · Map device dependencies · 02 · Replay cases · Expected facts + evidence · 03 · Real devices · Hardware adapter · OpsReplay: reconstruct the story. Check the evidence. · Future work · external context and optional 3D are not implemented

## Sources

- [S2 · PagerDuty — Recent Changes](https://docs.pagerduty.com/ai-automation/aiops/recent-changes)
- [S3 · Datadog — Bits Investigation](https://www.datadoghq.com/blog/bits-ai-sre/)
