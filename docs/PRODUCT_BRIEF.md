# OpsReplay — Product Brief and Pilot Proposal

Prepared: 28 October 2026. Proposed retail pilot; not a production offer.

## 1. The problem and the proposed buyer

When a branch device stops working, an operator may need to check device records, network information and software-change history in different tools. The first challenge is knowing which records matter and what they actually support. An unsupported diagnosis can send people to check the wrong thing.

Our proposed first buyer is a team supporting connected equipment across retail branches. This is a positioning hypothesis, not a validated customer segment. We have not completed customer interviews or connected a retail fleet.

The proposed value is simple: bring the relevant records together, help the operator review possible explanations, and show the records behind an answer. The system should help answer “what do we know?” and “what should we check next?” before a person decides on action.

This is a pilot proposal based on a working hackathon prototype. It is not a production tender response with certified service levels, committed delivery dates or a price quote. Those require discovery and technical/security review.

## 2. Why the problem matters: one real example

Microsoft estimated that the 2024 CrowdStrike update incident affected 8.5 million Windows devices. Its report describes substantial business and societal impact despite the affected systems representing less than one percent of Windows machines. [S1]

This is evidence that software changes can have consequences for device-dependent operations. It is not evidence that the incident was caused by fragmented records, that it was an IoT incident, or that OpsReplay would have prevented or resolved it.

For a retail pilot, possible business effects to investigate with the customer include interrupted branch work, time spent checking separate tools, and delays in deciding who should investigate. These are proposed discovery topics, not measured customer losses.

Before claiming a business benefit, record the customer's existing workflow, the number and types of sources they consult, and the decisions they struggle to make. Avoid assigning a downtime cost or improvement percentage without customer data and a stated method.

## 3. Existing approaches and a fair comparison

| Approach | Documented capability / current scope | What we still need to learn |
| --- | --- | --- |
| PagerDuty Recent Changes | Change events and incident context, including correlation by time, related service or intelligence [S2] | Fit, integration effort and terms for the proposed pilot |
| Datadog Bits Investigation | AI investigation using operational context and evidence references [S3] | Fit, data availability and terms for the proposed pilot |
| OpsReplay | Prototype timeline for simulated device events plus public GitHub activity; one protected IoT-only AI request verified | Customer demand, real-data integration, deployed robustness and sustained quality |

This is a feature/context comparison from official documentation checked on 28 October 2026, not a hands-on benchmark or exhaustive procurement assessment. No pricing comparison, competitive accuracy score or speed advantage has been established. Vendor statements are not independent evaluation results.

Our proposed focus is a small, inspectable investigation workflow connecting device evidence with software activity. We have not established that this is unique or underserved. An existing platform may be the better answer for a particular customer; discovery should allow that conclusion.

## 4. What exists now, and what is only proposed

| Status | Capability |
| --- | --- |
| Implemented | Deterministic smart-plug simulator, public GitHub activity loading, Unified Timeline, Source/Severity filters and display-only Demo Time Alignment |
| Implemented | Explicit Gemini investigation, local result/evidence-ID checks, server-side feature gate and Redis request controls |
| Observed working | One protected Preview request with three simulated IoT events: HTTP 200, one attempt, 1623 ms Gemini stage |
| Proposed pilot | Real-device adapter, approved customer data, explicit site/device context, repeatable case evaluation and pilot report |
| Future option | Interactive 3D site/device map and richer replay/snapshot workflows |

The observed UI request contained two power readings and an offline event; it included zero GitHub events. It does not prove a software-to-device causal link or a working multi-branch deployment. The smart-plug records are simulated; the 3D illustration is an AI-generated concept, not a screenshot of implemented software or a customer site.

Source code is modular, but changes still need validation. Effective timeline anomaly severity is derived for display/filtering; original events sent to AI retain their original severity. Evidence-ID validation checks reference membership, not the truth of every model statement. Current Production AI remains OFF.

## 5. A pilot benchmark we can actually defend

Use the same recorded cases in three modes: **A** separate source records (manual baseline), **B** Unified Timeline without AI, **C** Unified Timeline with AI. Keep the available evidence equivalent across modes, rotate task order to reduce learning effects, and give people the same questions. Report participant count, case count, failures and variation, not only the best run.

| Measure | How to record it |
| --- | --- |
| Time to relevant evidence | Time until the person finds the records required by a predefined answer key |
| Fact correctness | Compare their stated facts with the case records, reviewed by a person |
| Reference validity | Count unknown event references and rejected outputs separately |
| Unsupported cause claims | Count causal statements that the available evidence cannot support |
| Useful next checks | Review whether the suggested read-only checks address missing evidence |
| AI operation | Record latency, attempts, failed/rejected requests and cost where available |

Use cases with unrelated software activity, missing data, device-only symptoms and source failure—not only an easy success case. Datadog's engineering account describes why repeatable scenarios need surrounding signals and ground truth; our proposed evaluation borrows that principle, not its results. [S4]

Agree on success criteria with the pilot owner before testing. Do not promise a numeric improvement first and design the test around it. Current evidence is one UI happy path, not a benchmark distribution. The supplied case/measurement CSVs are planning templates with blank results.

New live AI requests, customer data submission and workflow runs need their own approved scope/cost. Preparing this plan does not execute them. The earlier one-request allowance is consumed.

## 6. What can change without rebuilding the whole idea?

| Need | Existing boundary | Work still required |
| --- | --- | --- |
| Different device data | Shared OpsEvent and source normalization modules | Build the source adapter, map timestamps/provenance and test malformed input |
| Different anomaly policy | Separate anomaly-rule module | Agree on thresholds with the domain owner and update regression tests; not a runtime settings screen today |
| Different Gemini model | Server-side model configuration | Confirm availability, response compatibility, deadlines and usage limits |
| Another AI provider | Generator/service boundary | New provider adapter and config validation; not a drop-in environment change |
| Different output fields | Result schema, evidence validation and UI | Coordinate schema/prompt/UI changes and re-evaluate responses |
| Site/device view | Current events have device IDs | Add a trustworthy site/device inventory and event-to-inventory mapping |

This separation makes adaptation easier to reason about; it does not remove integration work or guarantee a schedule. Keep read-only data access and source provenance as defaults while the workflow is being evaluated.

For a pilot, choose one missing capability that the customer needs to answer the task. Do not build every adapter, dashboard and AI feature at once. Confirm what data exists, what may leave the customer's environment, and which output a person needs to trust.

## 7. 3D: a useful future view, not the first dependency

The supplied 3D image is a concept illustration: retail branches, devices and an investigation workspace. It is AI-generated and does not represent a live monitoring console, implemented multi-site feature or real customer deployment.

A useful future interaction would be: select a branch → select a device → open the same timeline/evidence. A 3D view should answer “where is the issue?” while the timeline answers “what do the records show?” A coloured connection must not imply a proven causal link.

Before implementation, we need reliable site/device inventory, location/relationship data, and stable links between events and devices. The current prototype lacks that site model. A scene alone is not a digital twin.

Compare a simple 2D list/map and a 3D view on the same location-finding task. Measure correct device selection, task time and mobile usability. Keep a keyboard-accessible list/timeline fallback and respect reduced-motion preferences. Make 3D optional if it adds load or confusion.

Recommended order: use the concept in the proposal now; establish the site/device model and useful tasks during discovery; implement the smallest 3D view only if the comparison shows value. No website 3D feature was added in this documentation task.

## 8. Proposed pilot delivery and decision gates

| Step | Input / deliverable | Decision before moving on |
| --- | --- | --- |
| Discover | One team, incident type, existing workflow and permitted data sources | Is this a real problem for that team? |
| Define | Recorded cases, answer keys, measures, access and spending limits | Are the scope and success criteria agreed? |
| Connect | Only the needed read-only source adapter and mapping | Are provenance, permissions and data handling correct? |
| Evaluate | Baseline/mode comparison and a report including failures | Does the result help the operator on the agreed task? |
| Decide | Gaps, risks and next capability to build | Continue, change direction, use an existing tool, or stop |

No price, delivery date, service-level agreement, compliance certification or availability commitment is offered here. Those depend on requirements and review. Production access, database isolation, provider cost and deployed negative cases remain open work.

Ask a potential pilot owner: Which incident is hardest to reconstruct? Which records do you open? Which devices/services can be linked reliably? What evidence would make the result useful? What may be shared with an AI provider? Who approves usage and the final decision?

For the next project step, revise the story around one proposed buyer/use case, validate that story with users, then implement the highest-value gap. The 3D concept is an option in that discussion, not a substitute for evidence, customer fit or a working data connection.

## 9. Evidence register and sources

| Claim | Evidence status |
| --- | --- |
| Software updates can affect many operational devices | Historical example from Microsoft, S1; not an OpsReplay outcome |
| Similar investigation/change-context products exist | Official vendor documents S2/S3; not a hands-on comparison |
| The prototype can render one validated AI result | Owner screenshot plus deployment log, 28 Oct 2026 01:11:40 UTC; one protected IoT-only request |
| AI stage took 1623 ms | One adapter-stage observation, not total browser latency or average performance |
| Retail multi-site workflow is a good market | Hypothesis to validate; no customer interviews completed |
| OpsReplay is faster, cheaper or more accurate | Not established; no such claim is made |
| Interactive 3D is implemented | False; the supplied image is a future concept only |

Sources were checked on 28 October 2026. Links are provided so readers can check the original context. The technical handbook contains source/module details and historical workflow evidence. The presenter notes contain the talk track; neither is part of the audience pitch slides.



### Sources — checked 28 October 2026

- [S1 · Microsoft — Helping our customers through the CrowdStrike outage](https://blogs.microsoft.com/blog/2024/07/20/helping-our-customers-through-the-crowdstrike-outage/) — Published 20 July 2024; estimate of affected Windows devices, not an OpsReplay benchmark.
- [S2 · PagerDuty — Recent Changes](https://docs.pagerduty.com/ai-automation/aiops/recent-changes) — Official product documentation on change events and correlation; no hands-on product trial.
- [S3 · Datadog — Introducing Bits Investigation](https://www.datadoghq.com/blog/bits-ai-sre/) — Vendor description of AI investigation and evidence references; not an independent performance test.
- [S4 · Datadog — Evaluation platform for autonomous SRE agents](https://www.datadoghq.com/blog/engineering/bits-ai-eval-platform/) — Engineering discussion of repeatable scenarios, ground truth and surrounding signals; informs the proposed evaluation design.
