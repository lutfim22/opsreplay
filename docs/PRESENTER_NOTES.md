# OpsReplay — Study Guide & Speaker Notes

Solo voice: I / my. Suggested delivery: around three minutes. Use the short Speaker script for delivery; the longer Study notes are reference material, not a three-minute script. Use recorded evidence, not a new live request.

## 1. Open with the incident, then introduce the idea

### Speaker script

Imagine a store that is open for business when a connected device goes offline. The person investigating needs to know what happened first: a power symptom, a connection issue, or a software change? That question led me to build OpsReplay.

### Study notes

Imagine a small store using connected devices in its operations. The store is open when one device goes offline. I want to know what happened before it stopped responding: was there a power symptom, a connection issue, or a software change worth checking? This is an illustrative scenario, not a customer deployment or interview result. I built this hackathon project solo. The implementation uses a smart-plug simulator, not connected retail hardware.

## 2. The problem: reconstructing a sequence across sources

### Speaker script

Device records show symptoms. Software activity shows changes. When those records are separate, a person has to reconstruct the sequence. Technical outages can disrupt real businesses; Square’s 2023 outage is one public example, although it is not an OpsReplay test case.

### Study notes

Investigation requires reading device records and software activity. When those records are separate, a person has to reconstruct the sequence. The GitHub activity labels show record types the adapter can read; they are not evidence that a commit caused the offline event. As real-world context, Square reported a September 2023 outage affecting payment services for sellers [S5]. That illustrates operational impact. OpsReplay was not tested on that incident, and I do not claim fragmented records caused Square’s outage.

## 3. Existing approaches

### Speaker script

Useful approaches already exist. We can review records manually. PagerDuty Recent Changes and Datadog Bits Investigation also help with incident context. My experiment is a small workflow bringing device and software evidence together. I have not benchmarked it against those products.

### Study notes

Manual investigation remains useful: open each source, read the records and reconstruct the sequence. PagerDuty Recent Changes puts changes into incident context [S2]. Datadog Bits Investigation describes AI-assisted investigation with operational context [S3]. The category already exists. My experiment is a small workflow for device and software evidence with visible provenance and limits. This is a functional comparison based on vendor documentation. I have not run a competitive benchmark, compared pricing, or demonstrated superiority.

## 4. Explain the OpsReplay flow

### Speaker script

OpsReplay brings events into a Unified Timeline. A user selects Source and Severity, then investigates with Gemini. The result separates Observed facts from Hypotheses and links back through Evidence chips. AI helps with review; the operator makes the decision.

### Study notes

OpsReplay brings SIMULATED IoT and public GitHub activity into a Unified Timeline. The user selects Source and Severity, then uses Investigate with AI on the displayed events. Gemini produces Observed facts and Hypotheses (unconfirmed), with Evidence chips referencing events. The server validates the output shape and evidence IDs. Temporal proximity and valid IDs do not establish causation; the operator still reviews the evidence. Derived timeline severity from anomaly rules also differs from the original event severity submitted to AI.

## 5. What I implemented

### Speaker script

For this solo hackathon project, I built six parts: simulator, GitHub adapter, timeline, Gemini adapter, validation and quota. Separate modules give data-source and model changes a clear place to happen. The device data is still simulated.

### Study notes

I built the simulator, public GitHub adapter, timeline and filters, Gemini adapter, output validation, feature gate, and Redis quota. Source adapters separate data acquisition from a shared event format. The Gemini adapter separates provider calls from the view. These boundaries provide places to change data sources or model configuration; a new integration still needs implementation and testing. There is no physical-device adapter, application user account, persistent incident archive, multi-site inventory, or automatic remediation. Protected Preview uses Vercel deployment protection, not application authentication.

## 6. The bounded demo that was actually verified

### Speaker script

The successful verified scenario contains three events from one device: 1850 watts, 1720 watts, then offline. This request used simulated IoT only, with no GitHub events. I am showing saved evidence so the demo needs no additional AI request.

### Study notes

Use saved evidence; do not submit another Investigate with AI request. The recorded successful test used Source IoT, Severity Critical and Demo Time Alignment OFF. Its three SIMULATED events from sim-plug-01 are 1850 W / 230 V at 09:01:45 UTC, 1720 W / 230 V at 09:01:50 UTC, then offline at 09:03:00 UTC; the fixture date is 1 January 2025. That AI request contained zero GitHub events. Public GitHub integration is implemented separately; a successful mixed-source AI request has not been demonstrated. Original power-event severity is info; the Critical filter uses derived timeline severity.

## 7. Describe the result precisely

### Speaker script

This is the original result. AI gives facts and a possible device or connection issue, marked low confidence. The cause remains unconfirmed. Evidence IDs were checked against the input. The 1.623-second value measures the provider stage for one request, not an application benchmark.

### Study notes

The original screenshot shows a gemini-3.5-flash-lite response generated on 28 October 2026 at 01:11:40 UTC. It includes Observed facts and Hypotheses (unconfirmed), including Device failure or loss of connectivity with low confidence and not a confirmed root cause. The provider-adapter log records HTTP 200, one attempt, three events and durationMs 1623. The 1.623 s value measures the provider stage for one request, not full browser latency, an average, or a competitive benchmark. Evidence IDs were checked against the input; that does not prove every interpretation correct. Only the visible screenshot content was reviewed. It does not directly demonstrate Redis lease release.

## 8. Limits and access

### Speaker script

The verified path is a bounded prototype in protected Preview. Real hardware, mixed-source evaluation and controls for public AI access remain future work. Evidence references make the response inspectable; they do not establish the root cause.

### Study notes

This is a working, bounded investigation prototype, not an operations-ready product. The successful live AI test was in protected Preview. Public Production AI remains OFF. Broader access needs work on access boundaries, forwarded-IP trust, negative quota/outage/release verification, and wider evaluation cases. There is no measured time saving, ROI, root-cause accuracy, or customer-scale reliability result. Keep three labels explicit: SIMULATED, unconfirmed and prototype.

## 9. Next steps and the role of 3D

### Speaker script

Next, connect real data and evaluate replay cases with expected results. An optional 3D view could later help locate devices and inspect their status. The purpose stays simple: reconstruct the sequence, check the evidence, then decide what to do.

### Study notes

First connect one real data source through a hardware adapter and test the event contract. Then create replay cases with expected facts and evidence for consistent evaluation. An optional 3D view could show device location and status if it helps users investigate. That is a future direction, not an implemented application feature or digital twin. Close with: OpsReplay helps understand what happened before guessing why.

## Timing

1: 15 s · 2: 20 s · 3: 20 s · 4: 25 s · 5: 20 s · 6: 20 s · 7: 25 s · 8: 20 s · 9: 15 s

## Sources

- [S2 · PagerDuty — Recent Changes](https://docs.pagerduty.com/ai-automation/aiops/recent-changes)
- [S3 · Datadog — Bits Investigation](https://www.datadoghq.com/blog/bits-ai-sre/)
- [S5 · Square — September 2023 incident summary](https://developer.squareup.com/blog/incident-summary-2023-09-07/)

Vendor documentation is not a competitive benchmark. No new live request was made for this revision.
