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
