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
