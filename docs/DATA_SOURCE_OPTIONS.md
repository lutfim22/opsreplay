# Data-source fit for the device investigation demo

Researched: 28 October 2026. Proposal only: no new provider, adapter, dependency mapping or live verification is implemented by this documentation change.

## Why GitHub did not fit the retail story

The current simulator emits smart-plug power readings and offline/online events. GitHub supplies public repository commits, pull requests and workflow activity. There is no mapping from a device to a deployed application, firmware version, repository or deployment. Placing those records on one timeline does not establish operational relevance or causation.

GitHub remains useful for a future software-managed-device scenario with that mapping. It remains implemented as an optional source; it is not presented as evidence explaining the recorded offline event. The verified AI request contained three simulated IoT events and zero GitHub events.

## Alternatives

| Source | Best scenario | What it adds | Required relationship and limitation |
| --- | --- | --- | --- |
| [Particle Status API](https://status.particle.io/api) | A device stops reporting through an IoT cloud service | Provider-reported component status, incidents and maintenance | Map the device to the actual provider/component. The current simulator has no Particle dependency. Status reports do not establish a local-device, power or network failure. |
| [ThingSpeak public channel feeds](https://www.mathworks.com/help/thingspeak/readdata.html) | Read actual IoT telemetry through a public API | Timestamped sensor readings from a selected public channel; documented public reads need no Read API key | Choose a suitable channel with known ownership, units, provenance and permitted reuse. An unrelated public sensor is not evidence about the simulated shop. A second telemetry stream does not by itself explain an outage. |
| [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) | Investigate cooling or energy behavior alongside outdoor conditions | Time- and location-specific historical weather context from gridded reanalysis/models | Needs a coherent equipment scenario and matching coordinates/time window. Outdoor model data is not an indoor sensor reading. Hourly weather cannot explain a five-second power spike or establish why a device went offline. |
| [BMKG forecast API](https://data.bmkg.go.id/prakiraan-cuaca/) | Indonesian weather-aware planning | Three-day village-level forecasts in three-hour intervals | Suitable for forecast context, not historical observed weather for the fixed 2025 simulator replay. Preserve forecast issue time and valid time; display attribution. |

## Recommendation for the existing offline question

Prefer a device-cloud status integration, with Particle Status API as the researched candidate. It directly addresses a useful operator question: is there a reported problem in a cloud dependency, or should local-device investigation continue?

A proposed illustrative scenario is a small business monitoring connected equipment. A monitor stops reporting. OpsReplay reconstructs local event history and displays relevant provider-reported status alongside it. The operator can see what supports each hypothesis and what remains unknown. This is a proposed scenario; it is not the current simulator's verified environment or a customer deployment.

The documented public status endpoints include:

- `https://status.particle.io/api/v2/summary.json`
- `https://status.particle.io/api/v2/components.json`
- `https://status.particle.io/api/v2/incidents.json`

These status endpoints are distinct from the authenticated Particle Device Cloud API. The research checked official documentation, not endpoint availability, payload freshness, quotas or an integrated application flow. Documentation response examples are illustrative and must not become incident evidence.

Before showing this as working functionality, implement a server-side adapter, an explicit device/provider/component association and normalized events retaining original timestamps, source links and provenance. Use a documented real incident snapshot and an explicitly simulated device replay, label both, and preserve their original time basis. Do not shift a real incident onto the existing fixture's date. A fresh endpoint may return no relevant incidents; an empty result must remain empty.

The data contract, source filters, AI input/validation and failure handling also need updates and meaningful tests. Reuse the timeline, replay and evidence UI where their contracts still fit. A mixed-source AI success must be separately verified; the old IoT-only response does not verify a new integration. No new Gemini call is authorized by this research.

## If the business problem changes

For a food-retail cooling scenario, Open-Meteo is a stronger context source than GitHub. The story would ask whether equipment temperature and power behavior are unusual given outdoor conditions, with a risk of goods warming. This needs temperature telemetry and an appropriately paced replay; current metrics only support power, voltage, current and energy. The free Open-Meteo service supports non-commercial evaluation/prototyping, with attribution and published rate limits; commercial service access has separate terms. This is a larger scope change than adding cloud-status context to the offline story.

For demonstrating real sensor ingestion first, choose ThingSpeak and a documented suitable channel. Treat it as a real telemetry adapter, not a causal link to unrelated simulated equipment.

## Official references

- [Particle status API](https://status.particle.io/api) and [provider component status page](https://status.particle.io/).
- [MathWorks: read channel feeds](https://www.mathworks.com/help/thingspeak/readdata.html) and [channel access control](https://www.mathworks.com/help/thingspeak/channel-control.html).
- [Open-Meteo historical weather](https://open-meteo.com/en/docs/historical-weather-api) and [service pricing/usage terms](https://open-meteo.com/en/pricing).
- [BMKG forecast API and attribution](https://data.bmkg.go.id/prakiraan-cuaca/).
