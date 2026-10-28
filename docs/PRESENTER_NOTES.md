# OpsReplay — Hackathon Presenter Notes

Prepared: 28 October 2026.

## 1. A three-minute story for hackathon judges

The opening should explain the idea in one sentence before the problem, competitors or technical detail. Suggested opening: **“OpsReplay brings device records and software activity into one timeline so people can investigate an incident, assisted by AI that cites the evidence.”**

| Time | Slides | Short talk track |
| --- | --- | --- |
| 0:00–0:20 | 1 — Idea | “This prototype combines simulated IoT, the public GitHub API and Gemini. Our question is: when a device goes offline, what happened before it?” |
| 0:20–0:55 | 2–3 — Context/problem | “Imagine a small IT team in a retail business. Device records and software changes live in separate places. They need to reconstruct the sequence before choosing what to check.” |
| 0:55–1:15 | 4 — Existing approaches | “Manual review, PagerDuty and Datadog already help. We do not claim superiority. This hackathon tests a small flow with visible sources and a reviewable basis for its answer.” |
| 1:15–1:45 | 5–6 — Solution/build | “We combined the timeline, input filters, and structured AI facts/hypotheses with references. The device scope is a simulator.” |
| 1:45–2:30 | 7–8 — Scenario/result | “The completed test used one smart plug and three events: two readings and offline. The displayed result cites the records while leaving the cause unconfirmed.” |
| 2:30–3:00 | 9 — Limits/next | “One bounded path worked. Next are a real-device adapter and more case evaluation. 3D is a future option, not an implemented feature in this demo.” |

If time is short, mention Square only as supporting context and focus on the prototype. Do not lead with enterprise outage statistics, a commercial pilot ask or future 3D artwork before explaining the idea.

## 2. Demonstrate without overstating the evidence

Use the saved screenshot/recording of the successful request. Do not click Investigate with AI again for rehearsal, filming or presentation recovery. The prior request allowance is consumed; extra live execution needs a separate scope/cost decision.

Completed scenario: Source IoT, Severity Critical, Demo Time Alignment OFF, exactly three SIMULATED events. Readings were 1850 W and 1720 W at 230 V, five seconds apart, followed later by offline. The request contained no GitHub events. Filters select all visible events, not individual rows.

GitHub loading and AI submission are separate operations. Public GitHub records can appear in the timeline, but the displayed AI run was IoT-only. Do not shift display times and claim a deploy caused the offline event. Demo Time Alignment does not change evidence timestamps.

The AI Preview requires Vercel login. Use the owner's normal access or saved evidence; do not weaken protection or share sessions. Public AI remains OFF. If GitHub is unavailable, show the warning honestly and continue with the recorded result; do not fabricate replacement records.

Keep three distinctions explicit: **Square is a real incident from an official report; the small/medium retail business is an illustrative use case; the smart-plug result is our actual bounded prototype test.** This prevents an impression that retail customers or payment integration are already connected.

## 3. Judge questions and keeping the story focused

| Question | Short answer |
| --- | --- |
| What is the idea? | One timeline for inspecting device/software records, with an AI investigation that references its input. |
| Why small/medium businesses? | It is a proposed starting use case that makes the operational example understandable, not validated segment research. |
| Is the company case real? | Square is the public real-world example. The retail scenario is illustrative, not our customer. |
| What did you implement? | Normalized event flow, deterministic simulator, GitHub ingestion, timeline/filters, Gemini adapter, result/evidence validation, quotas and gating. |
| How is it better than large products? | It is a small inspectable prototype. Market/performance superiority is not established; an existing product may be more appropriate. |
| Why not output a root cause directly? | Evidence may be insufficient. Facts and unconfirmed hypotheses are separated for human review. |
| Do citations guarantee correctness? | No. Input reference membership is checked; the interpretation can still be wrong. |
| What is the benchmark? | One recorded successful path, not a comparative benchmark. Future work compares identical cases with manual, timeline and timeline+AI modes. |
| Is 3D implemented? | No. Concept artwork and future options are separate from implementation evidence. |

The Demo Deck is for judges; these notes are for the speaker; the Technical Handbook is for implementation. The business-oriented Product Brief/pilot proposal is retained as reference, not the main hackathon story.

## Sources — checked 28 October 2026

- [S2 · PagerDuty — Recent Changes](https://docs.pagerduty.com/ai-automation/aiops/recent-changes) — Documented change-event context; not a hands-on comparison.
- [S3 · Datadog — Bits Investigation](https://www.datadoghq.com/blog/bits-ai-sre/) — Vendor description of AI-assisted investigation; no competitive performance result.
- [S5 · Square Engineering — Incident Summary: 2023-09-07](https://developer.squareup.com/blog/incident-summary-2023-09-07/) — Published 15 September 2023. A real service outage affecting sellers; not an OpsReplay case or proof that fragmented records caused the outage.
