# Demo rehearsal and offline browser QA

Recorded: 28 October 2026. Application baseline: `9485fb6500ae105a8e0192ef33d10ac7a80fbbdb`. The accompanying change fixes only Theme keyboard behavior. Audience slides remain in draft PR [#31](https://github.com/lutfim22/opsreplay/pull/31); alternative public APIs are deferred.

## Presenter route

1. Open `/simulator`. Explain that the readings and connection state are SIMULATED.
2. Select `4x`, then Start. The deterministic replay includes a power spike, Offline at 180 simulated seconds and Online at 215 seconds. At 4x, these occur at approximately 45 and 54 seconds of playback. Pause to discuss the state; Reset starts the local playback again.
3. Open `/timeline`. Select Source `IoT`, Severity `Critical`, and leave Demo Time Alignment `OFF`.
4. Confirm three entries: 1850 W at 09:01:45 UTC (`sim-0021`), 1720 W at 09:01:50 (`sim-0022`), and Offline at 09:03:00 (`sim-0036`). The fixture date is 1 January 2025; readings use 230 V.
5. Explain Source labels, original timestamps, rule-based severity and the missing evidence. Time proximity is not proof of cause.
6. Show the saved owner-provided AI result from the local presentation bundle. Do not submit another AI request during rehearsal. Describe Observed facts, Hypotheses (unconfirmed), low confidence and Evidence chips.
7. Close with implementation limits and the next evaluation task. Public Production AI remains OFF.

Simulator playback and Unified Timeline are separate views over the same deterministic fixture. Starting, pausing or resetting the Simulator does not stream playback state into Unified Timeline: the latter uses the full fixture. Do not describe the navigation as a real-device live stream.

The successful saved AI request contained three simulated IoT events and no GitHub events. The existing GitHub adapter is an additional capability; software/firmware/deployment-to-device mapping is not implemented. No replacement API is active.

## Offline verification scope

The existing application ran on loopback with `INVESTIGATE_ENABLED=0`, no local secret files and no bound provider credentials. Playwright intercepted GitHub responses and all successful/error AI response fixtures. Screenshots of those cases are labelled `OFFLINE QA`; the result model is `qa-fixture-not-live-ai`.

One request reached the actual local `/api/investigate` route to check the disabled gate. It returned HTTP 503 with the controlled disabled message before body/quota/provider work. Other investigation responses were intercepted in the browser. No Gemini or Redis request was made; no GitHub upstream request was made. No browser external request or uncaught page error was observed.

These are local UI checks, not deployed integration or security acceptance. The QA success fixture is not the owner's saved response and must not be presented as a real AI result.

## Findings and evidence

| Check | Outcome |
| --- | --- |
| Timeline initial rendering | HTTP 200; 55 simulated entries with empty GitHub fixture |
| Reproduce saved-input selection | IoT / Critical / alignment OFF gives the three expected IDs |
| Actual local disabled gate | Controlled disabled error; no Retry or provider request |
| Empty source selection | Empty-state copy and disabled Investigate button |
| Invalid repository input | Associated validation error; no additional API request |
| GitHub 429 fixture | Explicit fallback warning; IoT events retained, no substituted GitHub data |
| Pending investigation fixture | Duplicate submission disabled while pending |
| QA result rendering | Facts, unconfirmed low-confidence hypothesis and limitations visible |
| Evidence navigation | Chip scrolls to the referenced visible event |
| Changed filters after result | Stale-input warning preserves the originally submitted result |
| Retryable timeout fixture | Error and retry guidance; no automatic retry |
| Malformed response fixture | Controlled invalid-response state; response discarded |
| Mobile navigation | 390 px width, no horizontal overflow; Escape closes menu and returns focus |
| Simulator controls | Start, 4x, Pause, Reset, Offline and recovery verified with accelerated browser clock |
| Theme radio group before fix | **Failed**: arrow keys did not select/focus the next option; all options were tab stops |
| Theme radio group after fix | **Passed** at 1440 px and 390 px: arrows, wraparound, Home/End, one tab stop, Tab/Shift+Tab, Space/Enter and mouse |
| Theme regression checks | Applied HTML theme, reload persistence and System media-preference changes passed |

The first run stopped at the keyboard defect, tracked in [Issue #32](https://github.com/lutfim22/opsreplay/issues/32). After the component fix, verification resumed with focused Theme checks rather than repeating the full scenario matrix. The final component passed local lint, typecheck and all 248 existing tests across 15 files. The standard local build encountered the previously documented Turbopack worker port-binding restriction; the exact PR-head CI normal build must pass before merge.

The keyboard fix retains the existing appearance and provider setup. A selected option is the group's only tab stop; arrow keys select and focus adjacent options with wraparound. Home/End select the first/last option. Native button activation preserves Enter/Space and pointer behavior.

## Failure fallbacks during presentation

- If GitHub is unavailable or rate limited, use Source IoT and say that only simulated device events are shown. Do not fabricate source activity.
- If the timeline is empty, adjust Source and Severity; no events should be submitted.
- If AI is disabled or unavailable, show the existing saved result. Do not change deployment protection, configuration or budgets on stage.
- If filters change after an AI result, explain that the old result covers the captured input and may now be stale. Restore the original selection to inspect its evidence.
- If the network is unavailable, use the offline slides/PDF and the original saved screenshot. The simulator alone runs locally after its page loads; loading the hosted application still needs network access.

## Remaining release boundary

Issue #14 remains open for public-AI access policy, deployed forwarded-header trust, quota/outage/release observations and other recorded security work. This rehearsal neither enables public AI nor verifies those boundaries. It does not establish hardware behavior, causal correctness, production reliability, browser-total latency or a competitive benchmark.

Draft PRs require a separate merge decision. No manual workflow, deployment, secret change or new provider request was performed for this rehearsal.
