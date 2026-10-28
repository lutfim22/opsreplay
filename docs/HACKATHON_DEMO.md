# OpsReplay — Demo Deck

Prepared: October 28, 2026.

## 1. The incident is visible. The context is scattered.

## OpsReplay

An evidence timeline for investigating device incidents alongside software activity.

**For operations teams managing connected devices and the software around them.** A device can go offline while its readings, repository changes and workflow activity sit in separate views. Before taking action, an operator needs a defensible picture of what the records actually show.

OpsReplay brings these records into one view, preserves their sources, and adds optional AI investigation with evidence references.

**One guiding question:** What happened in our records, and what should we check next?

## 2. Three investigation problems, three concrete responses

| Investigation problem | What we built | Practical value |
| --- | --- | --- |
| Device and software records are separated | Unified Timeline combining simulated IoT and public GitHub activity | Compare the available records in one view |
| Too much information obscures the incident window | Source and Severity filters with original timestamps | Narrow the evidence the operator wants to inspect |
| An explanation is hard to trust without a basis | Observed facts, Hypotheses (unconfirmed), evidence chips and explicit uncertainty | Trace an answer to input and see what remains unproven |

This is support for investigation, not an automatic diagnosis. The prototype makes context and traceability inspectable; faster incident resolution is an intended benefit, not a measured result.

## 3. A workflow that keeps the operator in control

## Inspect → Focus → Investigate → Verify

1. **Unified Timeline:** compare source-labelled device and software records.
2. **Source / Severity:** narrow the visible event set instead of copying scattered records manually.
3. **Investigate with AI:** explicitly request an explanation of that input.
4. **Evidence chips:** check the cited events and distinguish facts from possible explanations.

**Why these features belong together:** a timeline provides context, filters define scope, and citations let the operator challenge the AI's answer. Removing any one of those weakens the investigation story.

The public API integration reads GitHub commits, pull requests and workflow activity. The device input is a deterministic IoT simulator. Both keep provenance; a nearby software event is not automatically the cause of a device symptom.

## 4. A concrete incident, not a generic chat prompt

## Start with the device evidence

| Original simulator time (UTC) | Observed record |
| --- | --- |
| 09:01:45 | sim-plug-01: 1850 W / 230 V |
| 09:01:50 | sim-plug-01: 1720 W / 230 V |
| 09:03:00 | sim-plug-01 went offline |

**Operator question:** What do these records show, which explanations are still possible, and what evidence would help distinguish them?

The completed AI run used these three SIMULATED events. The wider product can display public GitHub activity alongside device records, but this run contained zero GitHub events. We have not demonstrated that a software change caused this offline event.

Demo Time Alignment is display-only. Original evidence timestamps are preserved.

## 5. A result you can inspect and challenge

## Observed facts

The result restated the two power readings and offline status, each with a SIMULATED evidence reference.

## Hypotheses (unconfirmed)

**Device failure or loss of connectivity** — low confidence; not a confirmed root cause.

The operator can follow the references and ask what evidence is missing. A valid reference does not make the model's wording or interpretation automatically correct.

| Completed protected Preview request | Observed result |
| --- | --- |
| Model / input | gemini-3.5-flash-lite / 3 simulated events |
| Provider response / attempts | HTTP 200 / 1 attempt |
| Gemini stage | 1.623 s; not total browser latency |

Owner screenshot and deployment-scoped logs support this completed happy path. This presentation uses that recorded result.

## 6. From scattered signals to a reviewable investigation

## What the prototype demonstrates

- One place to inspect simulated device records and public software activity.
- An operator-controlled investigation scope defined by the current filters.
- AI findings that distinguish facts from hypotheses and point back to submitted events.
- Clear simulation labels and uncertainty, instead of an unsupported causal story.

## What comes next

Physical-device adapters, stronger access controls and more deployed failure testing are future work. The prototype does not perform automatic remediation. Public Production AI remains OFF; the verified live result came from a protected Preview.

**OpsReplay's proposition:** help an operator move from “these signals are in different places” to “here is the evidence, here is what we know, and here is what we still need to check.”

No incident-resolution time reduction or accuracy percentage has been measured.

