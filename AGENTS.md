# OpsReplay – Agent Guidelines

## Stack
Next.js (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, pnpm.

## Coding guidelines
- Use pnpm only; commit `pnpm-lock.yaml`.
- TypeScript strict mode; avoid `any`.
- Prefer Server Components; add `"use client"` only when needed.
- Use Tailwind utilities and `cn()` from `@/lib/utils`; add UI primitives under `components/ui` via shadcn/ui.
- Use the `@/*` import alias.
- Keep changes small; add dependencies only when necessary.

## Architecture principles
- Routes and layouts live in `app/`; shared UI in `components/`; helpers in `lib/`.
- Keep domain logic separate from UI so it is testable.
- No database, auth, external APIs or IoT integration yet; introduce each behind a clear module boundary when needed.

## Before committing
Run `pnpm lint`, `pnpm typecheck` and `pnpm build`.

## AI commit attribution
- AI attribution follows the model that produced the contribution, regardless
  of which agent or product hosted that model. When the model is known and has
  an owner-approved convention below, every AI-authored code commit must end
  with the corresponding valid Git `Co-authored-by:` trailer.
- For OpenAI GPT/Codex models, including GPT-6 Luna, use
  `Co-authored-by: Codex <codex@openai.com>`. This address is an owner-selected
  convention, not a verified official OpenAI identity.
- For Anthropic Claude models, include the exact model name, for example
  `Co-authored-by: Claude Sonnet 5.5 <noreply@anthropic.com>` or
  `Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>`. This address is an
  owner-selected convention, not a verified official Anthropic identity.
- A hosting agent such as Copilot may add its own attribution under its own
  rules, but this repository does not require an additional agent-specific
  trailer. Do not invent one when the agent has no established convention.
- If the actual model is unavailable, ambiguous or has no owner-approved
  convention, do not guess an attribution. Report the agent, model and reasoning
  effort when known, and say when any are unavailable.
- Mixed-model commits must include the applicable trailer for each model that
  materially contributed.
  Do not rewrite pushed history solely to add attribution.
