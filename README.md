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

## AI investigation (Gemini, read-only)
**Investigate with AI** on `/timeline` sends the events currently shown (after filters) to
`POST /api/investigate`, which asks Google Gemini for a structured investigation: summary, observed facts,
hypotheses (confidence low/medium/high, supporting events, reasoning, missing evidence), recommended read-only
checks and limitations. It never runs commands and never changes repositories or devices.

### How it stays grounded
- Requests are validated with Zod (`OpsEvent` schema, max 200 events, max 512 KB, JSON only, same-origin only).
- Gemini uses structured JSON output; the response is re-validated with Zod and **every referenced event id
  (and any id-shaped text such as `sim-0001` or `github:owner/repo:commit:sha`) must belong to the submitted events**.
  Otherwise the response is discarded and an error is shown. There is no fake or fallback analysis.
- Each event is labelled `real_github` or `simulated_iot` and sent with its **original** timestamp. Demo Time
  Alignment is only a display option and is never sent as evidence.
- Event text (commit messages, titles, payloads) is untrusted: it is passed as escaped, size-bounded data inside a
  delimited block, and the instructions live only in the server-side system prompt (`lib/investigation/prompt.ts`).
- Secrets, prompts and model configuration stay on the server. Diagnostics log only the HTTP status,
  fixed error category, elapsed time, attempts, model id and event count—never keys or event content.

### Configuration
| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Server-only Gemini API key (create one in [Google AI Studio](https://aistudio.google.com/apikey)). |
| `GEMINI_MODEL` | no | Model id, default `gemini-2.5-flash`. Must match `gemini-*`; must support structured JSON output. |
| `GEMINI_TIMEOUT_MS` | no | Total upstream deadline, default `25000` (max `55000`; the route allows 60 seconds). |
| `UPSTASH_REDIS_REST_URL` | production | HTTPS REST endpoint of an Upstash Redis database. |
| `UPSTASH_REDIS_REST_TOKEN` | production | Server-only REST token for that database. |
| `INVESTIGATE_LOCAL_DEV_BYPASS` | local only | Set to `1` to run locally without Redis. Production ignores it. |

- **Local:** `cp .env.example .env.local`, set `GEMINI_API_KEY` and either both Upstash values or `INVESTIGATE_LOCAL_DEV_BYPASS=1`, then restart `pnpm dev`. The local bypass uses a per-process limiter only. `.env.local` is git-ignored.
- **Vercel:** Create an Upstash Redis database, set `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` as server-side Vercel environment variables, and redeploy. Use separate Redis databases for Production and Preview so previews cannot consume production allowance. Mark secrets Sensitive. Do **not** use a `NEXT_PUBLIC_` prefix. Requests fail closed with 503 if Redis configuration is missing or the service is unavailable.
- Without a key the UI shows a "not set up" state and the endpoint returns `503`. CI and `pnpm test` use mocked
  Gemini responses and need no key.

### Quota and spending controls
The server reserves a request in Upstash Redis before calling Gemini. One atomic Redis script enforces 100 requests globally per UTC day, 5 per client per minute, 15 per client per UTC day, and 3 concurrent Gemini calls globally. Denials return 429 and `Retry-After`. Redis uses its own clock. A failed Gemini call still spends one request allowance; up to three Gemini attempts may occur within one accepted request. Input is capped at 512 KiB/200 events, the prompt at 256 KiB, output at 8192 tokens, and the upstream deadline at 55 seconds. These are **request allowances, not a guaranteed cost cap**.

On direct Vercel deployments, the app uses the platform-supplied `X-Forwarded-For` address for client buckets. Do not place an untrusted proxy in front of Vercel without reviewing its forwarded-header behavior. Missing or ambiguous addresses use one shared anonymous bucket; the global allowance always applies. Origin checks only reduce cross-site browser requests and are not authentication. Anonymous visitors can still share an IP, rotate addresses, or make direct requests. Use Google AI Studio/Cloud project quotas and billing alerts appropriate to the demo; billing alerts do not enforce a hard spending cap. If a provider hard cap is unavailable, remaining spend risk is bounded only by request allowances, token/deadline limits, and provider quota. Upstash REST calls add one reservation and one lease release per accepted request; monitor Redis availability and quota usage. No paid Upstash resource is created by this code.

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

**Schema matrix (HTTP 400 on structured output):** set `mode` = `schema_matrix` (same `model` / `timeout_seconds` inputs, per case). From a phone: GitHub app → repository → *Actions* → *Gemini diagnostics* → *Run workflow* → branch `main`, choose `schema_matrix`, enter the model (for example `gemini-3.5-flash`), run, then open the run and expand the *Run Gemini schema matrix* step. It runs `pnpm diagnose:gemini:schema-matrix` (separate from the three probes above) with identical model and generation settings:

| Case | Schema | Prompt |
| --- | --- | --- |
| `A_simple_json_no_schema` | none (control) | trivial |
| `B_minimal_schema_one_string` | one required string property | trivial |
| `C_essential_investigation_schema` | investigation structure and required fields, no length/count bounds or descriptions | full investigation |
| `D_full_investigation_schema` | existing `investigationResponseJsonSchema` | full investigation |
| `E_full_schema_without_string_length_bounds` | D without `minLength`/`maxLength` | full investigation |
| `F_essential_schema_with_descriptions` | C plus only `description` fields from D at matching paths | full investigation |
| `G_essential_schema_with_array_bounds` | C plus only `minItems`/`maxItems` from D at matching paths | full investigation |

Each line reports `httpStatus`, `category`, `schemaKeywords` and `undocumentedKeywords` (keywords the installed `@google/genai` `responseJsonSchema` docs do not list as supported; currently `minLength` and `maxLength`, used only by D). For HTTP 400 it adds `errorDetails` from a strict allowlist: the Google error `status` enum, `reason` enums, `fieldViolations` field paths and which schema keyword names the message mentions. Raw errors, messages, headers, prompts, model output and the key are never printed. Reading it: if A passes, B passes, C passes and D fails, the extra constraints in D (`minLength`/`maxLength` are the prime suspects, then `description` text and the `minItems`/`maxItems` bounds) are plausible causes; if B or C fail too, the structure (nested arrays of objects, `enum`) or `responseJsonSchema` itself for that model is implicated. These are hypotheses until a live run confirms them. Reading F/G (both start from passing C, no `minLength`/`maxLength`): F fails → `description` triggers the 400; G fails → `minItems`/`maxItems` trigger it; both fail → either alone is enough; both pass → neither keyword alone is the cause (look at combinations or the sizes/interaction in D/E).

**Relation to the production investigation request (PR #7):** the schema (`investigationResponseJsonSchema`), system instruction and user prompt are verbatim copies in `scripts/gemini-diagnostics-contract.ts`, so they must be kept in sync until the feature lands. Differences: the diagnostics default to `gemini-3.8-flash` while PR #7's app default is `gemini-2.5-flash` (the model is never changed silently; pass `model` to match); events come from the simulator rather than user selection, with Demo Time Alignment off; there is no request validation, rate limiting or evidence-id check; one attempt only (no retries); the timeout is configurable up to 55 s versus 25 s in the app; and output is only validated against the result schema.
