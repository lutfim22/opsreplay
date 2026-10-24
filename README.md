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
