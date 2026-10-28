# OpsReplay — Study Guide & Speaker Notes

Suggested delivery: around three minutes. Use the short Speaker script for delivery; the longer Study notes are reference material, not a three-minute script. Use recorded evidence, not a new live request.

## 1. The store is open. A device goes offline.

### Speaker script

Imagine a store that is open when a connected device goes offline. The person investigating needs to know what happened beforehand: a power symptom, a connection problem, or a device issue? OpsReplay helps reconstruct that sequence.

### Study notes

The retail setting is illustrative, with no connected customer hardware. Do not present firmware, commits or weather as a cause without an established relationship.

## 2. The offline alert is only the last clue.

### Speaker script

The offline alert only shows the last known state. Here are two power readings before the device goes offline. We need the sequence, but events being close in time does not prove a cause. That is the investigation problem this prototype addresses.

### Study notes

Power readings come from the original simulator fixture. The sequence is a fact about the simulated input; causation is unconfirmed.

## 3. Useful approaches already exist.

### Speaker script

Records can be reviewed manually. PagerDuty adds recent-change context; Datadog offers AI-assisted investigation. OpsReplay explores a small workflow to replay device events and inspect the evidence behind an AI response. There is no competitive benchmark.

### Study notes

The comparison uses vendor documentation [S2, S3], not hands-on tests, pricing analysis or evidence of superiority.

## 4. OpsReplay turns events into an investigation.

### Speaker script

The verified path sends simulated IoT events into a Unified Timeline, filters them by Source and Severity, and investigates with Gemini. The response contains facts, hypotheses and Evidence chips. A GitHub adapter also exists, but software-to-device mapping is not implemented. GitHub does not explain this incident.

### Study notes

GitHub reads public repository activity without device/deployment dependency mapping. It remains implemented in the app. This diagram shows the verified IoT subset and does not claim a new adapter is active.

## 5. What the prototype implements.

### Speaker script

The prototype implements a simulator, GitHub adapter, timeline, Gemini adapter, validation and quota. Separate modules give new integrations a clear place to happen. GitHub is an additional capability, not a required explanation for every IoT scenario.

### Study notes

The schema currently allows simulator, shelly and github providers, with powerW, voltageV, currentA and energyWh metrics. A shelly enum is not a physical adapter. A new public API requires implementation, contracts, provenance, validation, error handling and tests, not just a changed URL.

## 6. Demo: replay one device going offline.

### Speaker script

The verified demo contains three simulated events: 1850 watts, 1720 watts, then offline. It uses Source IoT, Severity Critical and Demo Time Alignment OFF. There are no GitHub events in this request. This presentation uses saved evidence.

### Study notes

Event IDs are sim-0021, sim-0022 and sim-0036, at 09:01:45, 09:01:50 and 09:03:00 UTC. Fixture date: 1 January 2025; device: sim-plug-01; 230 V on both readings. The Critical filter uses derived timeline severity; original power-event severity is info. Do not make another AI request.

## 7. The saved AI result is inspectable.

### Speaker script

The original result contains facts and a possible device or connection issue, with low confidence. The root cause remains unconfirmed. Evidence IDs were checked against the input. The 1.623-second value measures the provider stage for one request, not an application benchmark.

### Study notes

The gemini-3.5-flash-lite response was generated on 28 October 2026 at 01:11:40 UTC. Provider-stage log: HTTP 200, attempts 1, eventCount 3, durationMs 1623. Evidence-ID membership is not semantic truth validation. Only visible screenshot content was reviewed; it does not directly demonstrate Redis release.

## 8. A prototype with visible boundaries.

### Speaker script

The verified path is simulated IoT and one successful AI request in protected Preview. Physical hardware and mapped external context remain future work. Broader public AI access also needs additional access and cost controls.

### Study notes

Public Production AI remains OFF. Application accounts, persistent incident archives and automatic remediation are not implemented. No customer reliability or ROI is measured. Protected Preview uses deployment protection, not application authentication.

## 9. Next: connect the right operational context.

### Speaker script

Next choose context that fits the incident. For an offline device, cloud-service status can help if the device depends on that service. Implement the adapter and dependency mapping, then evaluate replay cases. Real hardware and optional 3D can follow when useful.

### Study notes

Particle Status API is the researched recommendation for an offline scenario, conditional on device-to-service/component mapping. The current simulator has no Particle dependency. Provider-reported status does not prove a device or local-network failure. ThingSpeak is better for actual IoT telemetry; Open-Meteo fits cooling/energy scenarios with suitable sensors and matching time/location. No new adapter is implemented in this documentation revision.

## Timing

1: 15 s · 2: 20 s · 3: 20 s · 4: 25 s · 5: 20 s · 6: 20 s · 7: 25 s · 8: 20 s · 9: 15 s

## Sources

- [S2 · PagerDuty — Recent Changes](https://docs.pagerduty.com/ai-automation/aiops/recent-changes)
- [S3 · Datadog — Bits Investigation](https://www.datadoghq.com/blog/bits-ai-sre/)

Vendor documentation is not a competitive benchmark. No new live request was made for this revision.
