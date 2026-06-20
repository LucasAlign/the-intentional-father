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

- `artifacts/arlo/src/pages/Home.tsx` — main app UI: full 5-tab mobile redesign (Today / Her / Work / Arlo / Week), inline-style maps (R/S/M), woodgrain theme
- `artifacts/arlo/src/index.css` — global CSS (palette `:root` vars, fonts)
- `artifacts/arlo/public/woodgrain.png` — woodgrain background image (referenced via `import.meta.env.BASE_URL`)
- `artifacts/api-server/src/routes/arlo.ts` — all API routes (verse, tasks, chat, journal)
- `lib/db/src/schema/arlo.ts` — DB schema (journal_entries, tasks, chat_messages)

## Architecture decisions

- This app was migrated from Next.js to Vite + React + Express (Replit pnpm workspace pattern)
- All data was previously stored in Supabase; now uses Replit's built-in PostgreSQL via Drizzle ORM
- Verse of the day is computed deterministically from day-of-year — no DB needed
- Anthropic API called directly from Express route (no SDK, just fetch)
- The home page is a single-file 5-tab mobile app (graduated from the approved canvas mockup). Styles are inline `CSSProperties` maps (`R` root/nav, `S` screens, `M` modal) to preserve exact mockup fidelity — woodgrain + brass/parchment theme

## Product

Arlo is Bryant's daily personal OS, a 5-tab mobile app:
- **Today** — greeting, verse of the day, editable marriage intention (journal `commit_text`), Top 3 priorities (tasks: tap number to complete, dashed button to add), Coming Up (today's `coming_up` events), daily journal prompt (Write reveals `reflect` textarea), and a Message Arlo bar that jumps to the Arlo tab
- **Her** — commitments CRUD (`commits` table: log + tap dot to mark kept) so promises to his wife don't disappear
- **Work** — active jobs grouped by business (`jobs` table) with progress bars + a multi-step "Add new job" intake modal
- **Arlo** — chat with an AI accountability partner that knows Bryant's tasks, journal, and conversation history
- **Week** — Mon–Sun overview derived from `coming_up` events in the current week, today highlighted

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `ANTHROPIC_API_KEY` must be set as a Replit secret for AI chat to work
- Tasks must be added directly to the `tasks` table in the DB (no UI for task creation yet)
- Journal and chat save on blur / form submit

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
