# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arlo — personal OS for the ADD entrepreneur: a daily dashboard with a scripture verse, marriage intention, top-3 task priorities, daily reflection journal, and an AI accountability chat partner.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/arlo run dev` — run the Arlo frontend (port 22384)
- `pnpm run typecheck` — full typecheck across all packages (builds `lib/*` project references first, then typechecks `artifacts/*` and `scripts`)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push Drizzle schema changes to Postgres (dev only; `push-force` if it complains about data loss)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate the Zod schemas and react-query client from `lib/api-spec/openapi.yaml` (runs `typecheck:libs` afterward)
- Required env: `DATABASE_URL` (Postgres), `OPENAI_API_KEY` (Arlo AI chat)
- Auth env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; optional `GOOGLE_ISSUER_URL` (defaults to `https://accounts.google.com`)
- No test suite exists yet — correctness is verified via `typecheck` plus manual exercise of the running app.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9, project references (`tsc --build`) across `lib/*`
- Frontend: React 19 + Vite (`artifacts/arlo`), wouter for routing, Tailwind v4, Radix UI primitives, `@tanstack/react-query`
- API: Express 5 (`artifacts/api-server`), pino/pino-http for logging
- DB: PostgreSQL + Drizzle ORM, `drizzle-zod` for schema-derived validation
- AI: OpenAI GPT-5.4-mini (`OPENAI_MODEL` env override) via the Responses API, called with raw `fetch` — no SDK
- Build: esbuild produces a CJS-free ESM bundle for the server (`artifacts/api-server/build.mjs`)

## Architecture

**API-spec-first codegen pipeline.** `lib/api-spec/openapi.yaml` is the hand-maintained source of truth for the HTTP API. `orval` (config in `lib/api-spec/orval.config.ts`) generates two downstream packages from it:
- `lib/api-zod/src/generated/` — Zod request/response schemas + TS types, imported by the server routes (e.g. `GetCurrentAuthUserResponse` in `routes/auth.ts`) for response typing/validation.
- `lib/api-client-react/src/generated/` — a react-query client (base URL `/api`), consumed by the frontend via a custom fetch mutator (`lib/api-client-react/src/custom-fetch.ts`).

Whenever the API surface changes, update `openapi.yaml` first, then run the `codegen` script — don't hand-edit files under either package's `generated/` directory.

**Request flow.** `artifacts/api-server/src/app.ts` wires: pino request logging → CORS → cookie/JSON parsing → `authMiddleware` (loads the user from the session cookie onto `req.user` for every request) → `/api` router. `routes/index.ts` mounts `health` and `auth` publicly, and gates `googleCalendar`, `arlo`, and `interview` routers behind `requireAuth` (401 if no session).

**Auth.** Google OIDC via `openid-client`, PKCE flow (`login` → `callback` in `routes/auth.ts`), session stored server-side (session table + cookie, see `lib/auth.ts`). There's also a mobile authorization-code exchange endpoint (`/mobile-auth/logout`, `ExchangeMobileAuthorizationCode*`) for a native client, and `beta_invites`/`email_login_codes` tables (`index.ts` bootstrap SQL) supporting an invite/email-code path alongside Google login. All app data tables are scoped by `user_id` — this is a multi-user app, not single-user (despite older docs saying otherwise).

**Schema bootstrap, not migrations.** `artifacts/api-server/src/index.ts` runs idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements on boot to ensure auth/session tables exist. Day-to-day schema changes for app tables go through Drizzle (`lib/db/src/schema/arlo.ts`, `auth.ts`) + `pnpm --filter @workspace/db run push`.

**Where things live:**
- `artifacts/arlo/src/pages/Home.tsx` — the entire app UI: a 5-tab mobile layout (Today / Her / Work / Arlo / Week), styled with inline `CSSProperties` maps (`R` root/nav, `S` screens, `M` modal) to preserve exact mockup fidelity — woodgrain + brass/parchment theme. `artifacts/arlo/src/index.css` holds the palette/font `:root` vars.
- `artifacts/api-server/src/routes/arlo.ts` — verse/tasks/chat/journal/commits/jobs/coming-up routes
- `artifacts/api-server/src/routes/auth.ts` — Google OIDC + mobile auth exchange
- `artifacts/api-server/src/routes/googleCalendar.ts` — Google Calendar OAuth connect/events (feeds the "Coming Up" tab)
- `artifacts/api-server/src/routes/interview.ts` — AI-driven onboarding interview, backed by `profile`/`interview_messages`
- `artifacts/api-server/src/middlewares/authMiddleware.ts` / `requireAuth.ts` — session-load vs. 401-gate, applied at different layers (see Request flow above)
- `lib/replit-auth-web/` — browser `useAuth()` hook (login/logout/user state)
- `lib/db/src/schema/arlo.ts` — app data tables; `schema/auth.ts` — session/user/beta-invite tables
- `artifacts/mockup-sandbox/` — scratch Vite app for iterating on UI mockups before they graduate into `arlo`

## Gotchas

- A composite TS project (like `lib/replit-auth-web`) that uses `import.meta.env` needs its own `src/env.d.ts` declaring `ImportMetaEnv`/`ImportMeta` — it has no Vite dependency, so `vite/client` types won't resolve. Skipping this breaks `typecheck:libs`, which `api-spec`'s `codegen` script runs at the end.
- `OPENAI_API_KEY` must be set (as a Replit secret in deployed envs) for AI chat/interview features to work.
- Journal and chat save on blur / form submit, not live.
