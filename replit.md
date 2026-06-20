# Arlo

Personal OS for the ADD entrepreneur — a daily dashboard featuring a scripture verse, marriage intention, top 3 task priorities, daily reflection journal, and an AI accountability chat partner powered by Claude.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/arlo run dev` — run the Arlo frontend (port 22384)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `ANTHROPIC_API_KEY` — for the Arlo AI chat

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/arlo)
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- AI: Anthropic Claude 3.5 Sonnet (direct API calls)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle for server)

## Where things live

- `artifacts/arlo/src/pages/Home.tsx` — main app UI (all cards)
- `artifacts/arlo/src/pages/Home.module.css` — CSS Module styles
- `artifacts/arlo/src/index.css` — global CSS (colors, scrollbars)
- `artifacts/api-server/src/routes/arlo.ts` — all API routes (verse, tasks, chat, journal)
- `lib/db/src/schema/arlo.ts` — DB schema (journal_entries, tasks, chat_messages)

## Architecture decisions

- This app was migrated from Next.js to Vite + React + Express (Replit pnpm workspace pattern)
- All data was previously stored in Supabase; now uses Replit's built-in PostgreSQL via Drizzle ORM
- Verse of the day is computed deterministically from day-of-year — no DB needed
- Anthropic API called directly from Express route (no SDK, just fetch)
- CSS Modules used for the main page to preserve exact original styles

## Product

Arlo is Bryant's daily personal OS:
- **Verse card** — rotating scripture verse for daily grounding
- **Her card** — daily marriage intention input (persisted to journal)
- **Top 3** — top open tasks from the DB (not done, most recent 3)
- **Reflect** — daily journal textarea (persisted on blur)
- **Message Arlo** — chat with an AI accountability partner that knows Bryant's tasks, journal, and conversation history

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `ANTHROPIC_API_KEY` must be set as a Replit secret for AI chat to work
- Tasks must be added directly to the `tasks` table in the DB (no UI for task creation yet)
- Journal and chat save on blur / form submit

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
