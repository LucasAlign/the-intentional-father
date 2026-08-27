# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arlo — personal OS for the ADD entrepreneur: a daily dashboard with a scripture verse, marriage intention, top-3 task priorities, daily reflection journal, and an AI accountability chat partner.

## Run & Operate

The dev servers below are already kept running by the Replit "Project" workflow — don't run them yourself; see **Replit Environment Rules**. Listed here for reference (what's running, on which port) and for non-Replit environments.

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/arlo run dev` — run the Arlo frontend (port 22384)
- `pnpm run typecheck` — full typecheck across all packages (builds `lib/*` project references first, then typechecks `artifacts/*` and `scripts`)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push Drizzle schema changes to Postgres (dev only; `push-force` if it complains about data loss)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate the Zod schemas and react-query client from `lib/api-spec/openapi.yaml` (runs `typecheck:libs` afterward)
- Required env: `DATABASE_URL` (Postgres), `OPENAI_API_KEY` (Arlo AI chat); optional `OPENAI_MODEL` (defaults to `gpt-5.4-mini`)
- Auth env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; optional `GOOGLE_ISSUER_URL` (defaults to `https://accounts.google.com`). Microsoft is a second OIDC provider: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`; optional `MICROSOFT_ISSUER_URL` (defaults to `https://login.microsoftonline.com/common/v2.0`)
- Email env: `RESEND_API_KEY` (approval and login-code emails via Resend); optional `RESEND_FROM_EMAIL` (defaults to `admin@lucasalign.com`). If unset: approval emails are skipped with a warning in every environment; login-code emails are skipped with a warning (code logged to console) in development, but `sendLoginCode` throws in production so `/login/email/start` fails loudly instead of returning a fake `{sent: true}`
- `PUBLIC_URL` (e.g. `https://1arlo.replit.app`): the canonical app origin. Takes priority over request headers (`x-forwarded-proto`/`x-forwarded-host`) everywhere an OAuth `redirect_uri` or an absolute link in an email is built (`lib/origin.ts`, `lib/email.ts`) — unset in a deployment, those fall back to proxy-forwarded headers, which can diverge from what's registered with the OAuth provider and cause `redirect_uri_mismatch`. Set it explicitly in any deployment that sits behind a proxy.
- `ADMIN_EMAILS` (comma-separated, case-insensitive): grants admin access (beta-invite approval, `routes/admin.ts`) and bypasses the beta-invite gate. Defaults to `witeyford@gmail.com` if unset. Read once at server startup (`lib/auth.ts`) — changing it in a running deployment's Secrets requires an actual redeploy/restart, not just a save, to take effect. Note the trailing **S** — a secret named `ADMIN_EMAIL` (singular) is silently ignored and the default applies instead.
- `LOG_LEVEL` (optional, defaults to `info`): pino log level (`lib/logger.ts`).
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

**Request flow.** `artifacts/api-server/src/app.ts` wires: pino request logging → CORS → cookie/JSON parsing → `authMiddleware` (loads the user from the session cookie onto `req.user` for every request) → `/api` router. `routes/index.ts` mounts `health` and `auth` publicly, and gates `googleCalendar`, `arlo`, `interview`, and `admin` routers behind `requireAuth` (401 if no session).

**Auth.** Four login paths, all converging on the same server-side session (session table + cookie, see `lib/auth.ts`) and the same `beta_invites` approval gate (a login only succeeds if the user's email has `status = 'active'`):
  - Google and Microsoft OIDC via `openid-client`, PKCE flow (`makeLoginHandler`/`makeCallbackHandler` in `routes/auth.ts`, keyed by `OidcProvider`). Google keeps the bare `/login`/`/callback` paths (its redirect URI is already registered); Microsoft uses `/login/microsoft`/`/callback/microsoft`. A successful Google login also stores a Google Calendar connection (`storeGoogleCalendarConnection`) when the calendar scope was granted.
  - Email OTP (`/login/email/start`, `/login/email/verify`) — a 6-digit code hashed into `email_login_codes`, emailed via `lib/email.ts`/Resend; works for both first-time registration and returning sign-in.
  - Demo login (`/login/demo`) — creates a throwaway user and session with no OAuth round-trip and deliberately bypasses the beta-invite gate.
  - A mobile authorization-code exchange endpoint (`/mobile-auth/token-exchange`, `/mobile-auth/logout`) for a native client, Google-only.

All app data tables are scoped by `user_id` — this is a multi-user app, not single-user (despite older docs saying otherwise).

**Schema bootstrap, not migrations.** `artifacts/api-server/src/index.ts` runs idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements on boot to ensure auth/session tables exist. Day-to-day schema changes for app tables go through Drizzle (`lib/db/src/schema/arlo.ts`, `auth.ts`) + `pnpm --filter @workspace/db run push`.

**Where things live:**
- `artifacts/arlo/src/pages/Home.tsx` — the entire app UI: a 5-tab mobile layout (Today / Her / Work / Arlo / Week), styled with inline `CSSProperties` maps (`R` root/nav, `S` screens, `M` modal) to preserve exact mockup fidelity — woodgrain + brass/parchment theme. `artifacts/arlo/src/index.css` holds the palette/font `:root` vars.
- `artifacts/api-server/src/routes/arlo.ts` — verse/tasks/chat/journal/commits/jobs/coming-up routes
- `artifacts/api-server/src/routes/auth.ts` — Google/Microsoft OIDC, email-OTP login, demo login, mobile auth exchange
- `artifacts/api-server/src/routes/googleCalendar.ts` — Google Calendar OAuth connect/events (feeds the "Coming Up" tab)
- `artifacts/api-server/src/routes/interview.ts` — AI-driven onboarding interview, backed by `profile`/`interview_messages`
- `artifacts/api-server/src/routes/admin.ts` — beta-invite listing/approval (admin-only); `lib/email.ts` sends the approval email via Resend when a `pending` invite is set to `active`
- `artifacts/api-server/src/middlewares/authMiddleware.ts` / `requireAuth.ts` — session-load vs. 401-gate, applied at different layers (see Request flow above)
- `lib/replit-auth-web/` — browser `useAuth()` hook (login/logout/user state)
- `lib/db/src/schema/arlo.ts` — app data tables; `schema/auth.ts` — session/user/beta-invite tables
- `artifacts/mockup-sandbox/` — scratch Vite app for iterating on UI mockups before they graduate into `arlo`

## Gotchas

- A composite TS project (like `lib/replit-auth-web`) that uses `import.meta.env` needs its own `src/env.d.ts` declaring `ImportMetaEnv`/`ImportMeta` — it has no Vite dependency, so `vite/client` types won't resolve. Skipping this breaks `typecheck:libs`, which `api-spec`'s `codegen` script runs at the end.
- `OPENAI_API_KEY` must be set (as a Replit secret in deployed envs) for AI chat/interview features to work.
- Journal and chat save on blur / form submit, not live.

## Replit Environment Rules

This project runs in Replit. The API server (`artifacts/api-server`, port 8080) and frontend (`artifacts/arlo`, port 22384) are managed by the Replit "Project" workflow (`.replit`'s `[workflows] runButton = "Project"`).

- **Never start or restart the server.** Don't run `pnpm --filter @workspace/api-server run dev`, `pnpm --filter @workspace/arlo run dev`, or any command that binds to port 8080 or 22384. The Replit workflow manages both — not Claude Code.
- **Edit files only.** Make code changes to files but don't try to run or serve the app. Replit handles hot-reloading for frontend changes automatically.
- **Don't use Docker or virtual environments.** Replit uses Nix.
- **Don't modify the root `package.json`, `artifacts/arlo/vite.config.ts`, or `lib/db/drizzle.config.ts`** unless intentional — these are managed by the Replit environment.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `LucasAlign/the-intentional-father`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root, created lazily as terms/decisions are resolved. See `docs/agents/domain.md`.
