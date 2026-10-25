# OpsReplay

AI-powered Incident Investigation.

Built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui and pnpm.

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Scripts

- `pnpm lint` – ESLint
- `pnpm typecheck` – TypeScript type check
- `pnpm test` – unit tests (Vitest)
- `pnpm build` – production build
- `pnpm start` – serve the production build

See [AGENTS.md](AGENTS.md) for contribution guidelines.

## GitHub activity (read-only)

`/github` shows recent commits, pull requests and GitHub Actions runs of a public repository
(default `lutfim22/opsreplay`) as normalized `OpsEvent`s, labelled **LIVE GITHUB DATA** and kept
distinct from **SIMULATED** IoT data. Data comes from the server-side Route Handler
`GET /api/github/events?repo=owner/repo`.

### Configuration
- `GITHUB_TOKEN` (optional, server-only): raises the GitHub rate limit. Never exposed to the browser.
  Public repositories work without it. Set it in `.env.local`.

### Limitations
- Unauthenticated GitHub API limit is 60 requests/hour per IP; each load uses 3 requests. Rate limits are shown in the UI.
- Private, missing or inaccessible repositories return a "not found" state; no mock data is substituted on failure.
- Only the latest 30 commits, PRs and workflow runs are fetched; no pagination, no webhooks, no OAuth, no storage.
- If Actions is disabled, commits and PRs are still shown with a warning.
- Events close in time to IoT incidents are not evidence of causation. Correlation is not implemented yet.

## Unified timeline (read-only)
`/timeline` (nav: **Unified Timeline**, also linked from an incident page) merges the deterministic
**SIMULATED** virtual smart plug events with **LIVE GITHUB DATA** into one chronological list. Both sides
use the existing `OpsEvent` model: events are validated, ordered (timestamp, then id) and deduplicated
(first id wins) by `lib/events`; anomalies come from the existing rule-based detector. Domain logic lives in
`lib/timeline` (merge, filter, summary, alignment) and is independent of React.

### Usage
- Filter by source (All / IoT / GitHub) and severity (Critical / Warning / Info). The effective severity is the
  higher of the event severity and any rule-based anomaly severity on it.
- Each entry shows a source label, severity, description, its original UTC timestamp and, for GitHub events,
  a link to the original record on github.com.
- The summary card shows total events, anomalies, source breakdown and the visible time range for the current filters.
- GitHub data is loaded through `GET /api/github/events?repo=owner/repo` (see above); the repository can be changed on the page.

### Demo Time Alignment (OFF by default)
The simulator replays a fixed 2025 scenario, so it normally never overlaps real GitHub activity. When the
toggle is on, simulated events get a **display-only** aligned timestamp: the end of the simulated window is
placed on the latest GitHub event and the original spacing is kept. Original and aligned timestamps are both
shown; original `OpsEvent` timestamps are never modified and GitHub timestamps are never shifted. Alignment is
for demonstration only and does not mean the simulated events happened at that time.

### Limitations
- If GitHub is empty, rate-limited or unavailable, a warning is shown with simulated events only; GitHub events are never fabricated.
- Only the latest 30 commits, PRs and workflow runs are loaded; GitHub timestamps are commit date, PR `updated_at` and workflow run `updated_at`.
- Temporal proximity (including aligned time) is not evidence of causation; no correlation is performed.
- IoT data is simulated only; no real hardware, database, authentication or AI analysis.

## Gemini diagnostics (manual, no API endpoint)

A manual GitHub Actions workflow runs three live Gemini probes so API problems (for example HTTP 504s) can be diagnosed without a local machine. It is `workflow_dispatch` only, runs on `main`, has read-only permissions and exposes no public endpoint. CI never calls Gemini.

**Set up the secret (smartphone, GitHub app or mobile web):** repository *Settings → Secrets and variables → Actions → New repository secret*, name `GEMINI_API_KEY`.

**Discover available models first (default mode):** *Actions → Gemini diagnostics → Run workflow*, branch `main`, leave `mode` = `list_models`. It runs `pnpm diagnose:gemini:models` only (all pages of the SDK `models.list`). The log prints one JSON line per model (`id`, `displayName`, `supportedActions`, `generateContent`: `yes` / `no` / `unknown` when the API gave no capability data) and a final `summary` line with counts and `generateContentIds`. Pick an id with `generateContent: yes` and pass it as `model` in `run_probes` mode. On failure the summary shows `outcome: failure`, `httpStatus` and `category` (`upstream_http_<status>`, e.g. 403 = key problem, or `client_error`); raw errors and the key are never printed.

**Run probes:** set `mode` = `run_probes`. *Actions → Gemini diagnostics → Run workflow*, branch `main`. Inputs: `model` (default `gemini-3.8-flash`, must match `gemini-*`) and `timeout_seconds` (default `45`, 1–55, per probe).

**Read the results:** the log prints one JSON line per probe with `probe`, `model`, `durationMs`, `httpStatus`, `category`, `outcome`, `promptBytes`, `eventCount`. Prompts, event ids and model output are never printed.

| Probe | What it tests |
| --- | --- |
| `simple_json_without_schema` | Basic connectivity, key and model with a trivial JSON reply |
| `simple_json_with_investigation_schema` | Same, plus the investigation response schema |
| `three_simulated_events_full_investigation` | Full investigation system prompt with three simulator events (power spike, offline, online) and the schema |

`category` values: `success`; `invalid_json_response` / `schema_validation_failed` (reply received but unusable); `upstream_http_<status>` (Gemini returned an HTTP error, e.g. `upstream_http_504`, `403` for key problems); `client_deadline_abort` (our timeout fired first); `client_error` (other). If probe 1 passes and 3 fails, the prompt/schema size or latency is the likely cause; if all fail, check the key, model and quota.

**Relation to the production investigation request (PR #7):** the schema (`investigationResponseJsonSchema`), system instruction and user prompt are verbatim copies in `scripts/gemini-diagnostics-contract.ts`, so they must be kept in sync until the feature lands. Differences: the diagnostics default to `gemini-3.8-flash` while PR #7's app default is `gemini-2.5-flash` (the model is never changed silently; pass `model` to match); events come from the simulator rather than user selection, with Demo Time Alignment off; there is no request validation, rate limiting or evidence-id check; one attempt only (no retries); the timeout is configurable up to 55 s versus 25 s in the app; and output is only validated against the result schema.
