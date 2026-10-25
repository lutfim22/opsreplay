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
- IoT data is simulated only; no real hardware, database or authentication. AI analysis is opt-in (see below).

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
| `INVESTIGATE_RATE_LIMIT_PER_MINUTE` | no | Per-IP limit, default `10`. |

- **Local:** `cp .env.example .env.local`, set `GEMINI_API_KEY`, restart `pnpm dev`. `.env.local` is git-ignored.
- **Vercel:** Project → Settings → Environment Variables → add `GEMINI_API_KEY` (and optionally the others) for
  Production/Preview, mark the key *Sensitive*, then redeploy. Do **not** use a `NEXT_PUBLIC_` prefix.
- Without a key the UI shows a "not set up" state and the endpoint returns `503`. CI and `pnpm test` use mocked
  Gemini responses and need no key.

### Local Gemini diagnostics
For operators diagnosing upstream latency, run `pnpm diagnose:gemini` in a trusted local shell after making
`GEMINI_API_KEY` available through a secret manager or the shell environment. It reads the same `GEMINI_MODEL`
and `GEMINI_TIMEOUT_MS` settings, makes three sequential direct SDK requests, and reports only probe name, model,
duration, HTTP status/category, prompt byte count and event count. It never prints the key, prompt, event IDs, payload
or model response. It does not add an API route and does not use the production endpoint.

The probes compare simple JSON without the response schema, simple JSON with the investigation schema, and the real
investigation system/user prompt with three simulator events. An `upstream_http_504` is a Google HTTP response;
`client_deadline_abort` means the local timeout elapsed without an HTTP status. If probe A fails, investigate model,
account, region/network or upstream availability; if A succeeds but B fails, investigate schema compatibility; if B
succeeds but C fails, investigate full prompt/context size or model workload. These comparisons narrow the cause but
do not prove a provider-side root cause.

#### Run from GitHub Actions (mobile-friendly)
1. In the repository, open **Settings → Secrets and variables → Actions → New repository secret**.
   Add `GEMINI_API_KEY`; do not put the key in workflow inputs or logs.
2. Open **Actions → Gemini diagnostics → Run workflow**. GitHub only offers manual dispatch for workflows
   present on the repository's default branch, so this workflow must first reach `main`.
3. Keep the branch set to `main`, optionally enter a `gemini-*` model id and a timeout from 1 to 55 seconds,
   then tap **Run workflow**. The default model is `gemini-3.8-flash` and the default per-probe timeout is 45 seconds.
4. Open the workflow run and inspect the three sanitized JSON result lines. Each probe can take up to the selected
   timeout; the job is limited to five minutes. Runs are serialized to prevent concurrent Gemini calls.

The workflow checks out `main` and only runs on `main`; dispatches targeting other branches are skipped. This avoids
passing the repository secret to pull-request branch code. If no repository secret is configured, the diagnostic
script exits without sending requests.

### Cost, quota and abuse considerations
- Requests accept at most 200 events and a 512 KiB body; the serialized model prompt is capped at 256 KiB.
  Transient HTTP 503/504 failures receive up to two retries with exponential backoff and jitter inside the
  configured total deadline. The SDK's own retries are disabled so they cannot extend that deadline.
- For Gemini 3 model IDs, the request uses the SDK-supported `thinkingLevel: "low"` option and leaves temperature
  at the model default; Gemini 2.x retains its supported `temperature: 0.2` setting. Evidence instructions,
  original timestamps, IDs and strict response validation are unchanged.
- The free tier has low rate limits and quota errors are shown as such (HTTP 429); paid usage is billed per token
  by Google.
- Events are sent to Google Gemini. Do not use it with data you are not allowed to share with that service.
- The endpoint has no authentication. Protections: bounded body/event count, same-origin check, per-IP in-memory
  rate limiting and a request timeout. Remaining risks: the limiter is per serverless instance (best effort) and trusts
  `x-forwarded-for`, so a determined caller can exceed it or spend your quota; add authentication, a shared store
  (e.g. Vercel KV/Upstash) or a WAF rule and a Google Cloud budget/quota cap before exposing it widely.
- The server cannot verify that submitted events are authentic (there is no database); it only guarantees the analysis
  refers to the events it was given.

### Limitations
- Hypotheses are not confirmed root causes; simulated telemetry is not real hardware evidence; temporal proximity,
  including aligned time, is not causation.
- LLM output can still misread or over-interpret valid events. Id checks prove traceability, not correctness; verify
  against the linked records.
- Long text values are truncated (500 chars) and deep payloads are trimmed before analysis; results are not stored.
- Retries can reduce transient 503/504 failures but cannot resolve persistent Google service or model availability
  problems. Mocked tests and local checks cannot verify the configured model's live structured-output support or
  preview-service availability; confirm those with a real Preview deployment and request.
