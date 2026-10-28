# OpsReplay — Presenter Notes

Prepared: October 28, 2026.

## 1. Delivery plan — keep this out of the audience deck

These are speaker notes, not slides. Use the separate six-page Demo Deck for judges or viewers. Use the Technical Handbook for implementation questions.

| Time | Slide | Talk track |
| --- | --- | --- |
| 0:00–0:25 | 1 — Problem | “A device is offline, but its readings and the software activity live in separate tools. An operator needs context before taking action.” |
| 0:25–0:50 | 2 — Problem/feature mapping | “We built one timeline for context, filters for scope, and evidence-linked AI for a reviewable explanation. These are parts of one investigation workflow.” |
| 0:50–1:15 | 3 — Operator journey | “The operator chooses the visible events, explicitly asks for analysis, and can challenge the result against its input.” |
| 1:15–1:45 | 4 — Concrete incident | “Here are two simulated power readings and an offline event. The question is what they show and what evidence is missing, not whether we can invent a cause.” |
| 1:45–2:15 | 5 — Saved result | “The completed run separated facts from a low-confidence connectivity/device hypothesis and linked the records. It succeeded in one provider attempt.” |
| 2:15–2:45 | 6 — Value and boundary | “This demonstrates context and traceability. Physical hardware and public AI readiness are future work; we do not claim a measured reduction in incident-resolution time.” |

Show the existing successful screenshot or a recording of that result. Another click on Investigate with AI creates new live usage; the previous one-request permission is consumed. Do not click Retry or rerun a workflow while rehearsing.

## 2. Preparation, access and fallback

Before presenting, open the audience PDF and the saved AI screenshot. Keep Source, SIMULATED and uncertainty labels visible. Do not reveal keys, tokens, login state, environment settings or bypass URLs in a recording.

The verified AI Preview requires Vercel access. A judge without access cannot open it anonymously. Use an owner-authenticated presentation or saved evidence; do not disable protection, share a session or generate a bypass link.

The public app is https://opsreplay.vercel.app with AI OFF. It can illustrate the non-AI product. Opening or refreshing GitHub activity may consume public API allowance and may show a warning if unavailable. Do not fabricate replacement GitHub data or pretend a saved result is a new live request.

If GitHub is unavailable, say: “The timeline makes the source failure visible. This saved investigation demonstrates the already-verified IoT input; it is not a fabricated mixed-source analysis.”

If the live page cannot be shown, continue with the audience PDF and screenshot. State that it is recorded evidence from the completed protected Preview test. Avoid promising another AI run to recover the presentation.

## 3. Short answers for likely questions

| Question | Honest short answer |
| --- | --- |
| What problem does it solve? | It makes fragmented device/software records comparable and gives an operator a traceable AI investigation starting point. |
| Is the device physical? | No. It is a deterministic smart-plug simulator, clearly labelled SIMULATED. |
| Where does the public API fit? | The GitHub route reads public commits, PRs and workflow runs into the shared event model and timeline. |
| Did GitHub cause the outage? | Not established. The tested AI request was IoT-only; timing is not causal proof. |
| How is this more than a chatbot? | Input is a filtered event set with provenance and original timestamps; output has structured facts/hypotheses with validated event references. |
| Can the AI be wrong? | Yes. Reference validation checks input membership, not semantic truth or a confirmed root cause. |
| Does it fix incidents automatically? | No. It recommends read-only checks; it does not execute remediation. |
| Is it production-ready? | It is a protected prototype. Access, isolation and deployed negative cases still need decisions/tests before public AI activation. |
| What performance improved? | One request's Gemini stage took 1.623 s. No MTTR reduction or accuracy gain was measured. |

For API, quota, schema, deployment and error details, switch to the Technical Handbook after the presentation rather than adding those details to the audience slides.

