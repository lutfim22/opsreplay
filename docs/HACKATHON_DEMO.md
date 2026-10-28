# OpsReplay — Visual Hackathon Demo

Solo project. Scenario first; narrative is in Presenter Notes.

## 1. The store is open. A device goes offline.

An illustrative scenario for a small retail business

DEVICE OFFLINE · Where do I start? · Power? · Connection? · Software?

## 2. Two sources. One missing story.

Device records and software changes need context.

Device telemetry · 09:01:45   1850 W · 09:01:50   1720 W · 09:03:00   offline · GitHub activity · Commit · Pull request · Workflow run · ? · Real-world context: Square’s September 2023 outage disrupted seller services. [S5]

## 3. Useful approaches already exist.

A documentation-based comparison — not a performance benchmark.

01 · Manual review · Open each source · Build the sequence · 02 / S2 · PagerDuty · Recent Changes · Changes in incident context · 03 / S3 · Datadog · Bits Investigation · AI + operational context · My experiment: a small, inspectable workflow for device + software evidence.

## 4. OpsReplay connects the investigation.

Bring records together. Select events. Check the evidence.

IoT · SIMULATED · GitHub · PUBLIC API · Unified Timeline · Source / Severity · Gemini · Observed facts · Hypotheses (unconfirmed) · Evidence chips · Evidence supports review. The operator decides.

## 5. Built as a solo hackathon prototype.

A working path, with clear module boundaries.

Simulator · Fixed event fixtures · GitHub adapter · Public repository activity · Timeline · Source / Severity · Gemini adapter · Structured response · Validation · Schema + evidence IDs · Quota · Feature gate + Redis

## 6. Demo: replay one device going offline.

Recorded successful request · Source: IoT · Severity: Critical

SIMULATED · sim-plug-01  /  230 V · 1850 W · 09:01:45 UTC · 1720 W · 09:01:50 UTC · offline · 09:03:00 UTC · 3 SIMULATED EVENTS · 0 GITHUB EVENTS · Demo Time Alignment: OFF

## 7. The saved AI result is inspectable.

Protected Preview · recorded result · no new live request

3 · events · 1 · attempt · 1.623 s · provider stage · Hypotheses (unconfirmed) · Device failure or loss of connectivity · low confidence · not a confirmed root cause · Evidence IDs checked against the submitted events. · One observed result; not a latency benchmark.

## 8. A prototype with visible boundaries.

Evidence references are useful. They do not prove the root cause.

CURRENT · IoT · SIMULATED · AI verification · One IoT-only request · Access · Protected Preview · NOT YET · Physical devices · Hardware adapter · Broader evaluation · Mixed-source cases · Public AI · Access + cost controls

## 9. Next: strengthen the evidence, then the view.

Small modules make the next experiment easier to change.

01 · Real data · Hardware adapter · 02 · Replay cases · Expected facts + evidence · 03 · Optional 3D · Device location + status · OpsReplay: reconstruct the story. Check the evidence. · Future direction · 3D is not implemented

## Sources

- [S2 · PagerDuty — Recent Changes](https://docs.pagerduty.com/ai-automation/aiops/recent-changes)
- [S3 · Datadog — Bits Investigation](https://www.datadoghq.com/blog/bits-ai-sre/)
- [S5 · Square — September 2023 incident summary](https://developer.squareup.com/blog/incident-summary-2023-09-07/)

The public repository deck shows a text summary. The original owner screenshot remains in the local downloadable demo bundle and is not published here.
