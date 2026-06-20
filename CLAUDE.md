# CLAUDE.md — Arlo

> This file is the source of truth for the Arlo project. Read it at the start of every session.
> It defines what we're building, in what order, and the rules that keep the build from drifting.

---

## What Arlo is

Arlo is a **personal operating system for the ADD entrepreneur** — a mobile-first app that helps
one man be a faithful husband and father *while* running multiple businesses with different rhythms.

It is **not** a productivity app. It is a personal operating system built around identity, not output.
The voice of the app is a **partner and a brother**, not a task master, not a cheerleader, not a nag.

**The user:** Bryant — husband, father, runs three ventures (a sign-making company, a farm, and a
tech company / Lucas Align). Builds with a biblical worldview. Wants tools that reduce decisions
rather than multiply them. Dislikes flattery. Wants a product that feels like a partner, not a burden.

**The core problem Arlo solves:** Not follow-through — *planning horizon*. The user is a strong
executor who gets to the starting line without a full picture (budget, materials, time, contingencies),
then reality hits and tasks stall at ~80%. Arlo's job is to plan *ahead* of the work, with him.

**Tagline:** FOCUSED. FAITHFUL. FREE.  ·  Footer: FAITH. FOCUS. FOLLOW THROUGH.

---

## The core daily loop (everything serves this)

Morning brief → daily intentions → task capture through the day → evening accountability.

A good morning interaction is **60 seconds**: spirit, marriage, and the day's top 3 in one view.

The app must **never**:
- Make him feel behind before he's started
- Add more to his plate than it removes
- Feel corporate or cold
- Require maintenance — it should pull him in, not demand upkeep

---

## Tech stack

- **Next.js** (App runs on Vercel eventually; local dev first)
- **Supabase** (Postgres, auth, storage) — single identity DB
- **Anthropic API** — Claude Sonnet for cost, Opus for reasoning. Model strings come from
  current Anthropic docs; verify, don't guess.
- Frontend is React. Mobile-first, max width ~440px centered.

The user builds in **Claude Code**. Prefer running the dev server and testing endpoints in a loop
over asking him to manually verify.

---

## Design system (locked — do not redesign without being asked)

**Background:** a real photographic dark walnut wood-grain texture (green-brown, horizontal grain,
natural knots, soft vignette). Asset provided: `woodgrain.png`. Cards sit ON the wood as
translucent dark "glass" so the grain shows through faintly. This texture is essential to the feel —
do not replace it with flat CSS gradients or procedural noise.

**Palette:**
- Parchment text: `#EEE4C4` (bright) / `#D2C7A2` (body) / `#9C9272` (dim) / `#6E664C` (faint)
- Aged brass accent: `#D8AA3E` (bright) / `#C89A34` (soft) / `#9A7420` (deep)
- Walnut (wood elements): `#5A3A20` / `#7A4E2C` / `#9C6840`
- Ink (near-black): `#0C0E07`

**Font:** Calibri stack — `'Calibri','Segoe UI','Gill Sans MT','Helvetica Neue',sans-serif`

**Card surface ("glass"):** translucent dark gradient, 1px warm light border, soft drop shadow +
inner top highlight, slight backdrop blur. Real depth via layered shadow, not flat fills.

**Signature element:** the Verse of the Day card has a glowing brass border + warm halo.

**Five tabs (bottom nav):** Today · Her · Work · Arlo · Week.
Line icons in brass; the Arlo tab is an "A" in a circle.

**Style note:** Verse and Marriage Intention cards center their text (no illustrations).

The current UI mockup lives in `arlo-mockup.jsx` — use it as the visual reference / starting point.

---

## Build phases — build ONE at a time, in order

> **Scope discipline is the whole game.** The user's core struggle is starting at high energy and
> leaving things at 80%. Do not widen scope mid-phase. Finish a phase to 100% — wired, tested,
> working — before starting the next. If tempted to add "just one more thing," stop and note it
> in the Backlog section instead.

### Phase 1 — One screen, fully alive (START HERE)
Build **only** the Today screen, end to end:
- Real verse, marriage intention, top-3 priorities, and "coming up" from Supabase
- The "Message Arlo" bar working — chat responds with the Joby-Martin-style accountability voice
- Arlo has **memory**: it reads recent journal entries + open tasks for context and persists chat
- Daily journal prompt saves to Supabase
- Do **NOT** build Her / Work / Week / Job intake yet.
- **Done = he can open the app, see real data, talk to Arlo, and it remembers tomorrow.**

### Phase 2 — Onboarding interview
A one-time AI conversation where Arlo interviews him about his three businesses, rhythms, family,
suppliers, lead times, energy patterns — and stores a permanent profile that every other feature reads.

### Phase 3 — Job intake + planning brain
The 6-question job intake flow (business, job, deadline, materials, budget, blockers) feeding the
Week view. This delivers the core promise: plan ahead so tasks don't die at 80%.

### Phase 4 — Remaining tabs
Wire Her (commitments to his wife), Work (jobs by business with progress), and Week (one week ahead)
to real data. Mostly repeats Phase 1's patterns.

### Phase 5 — Polish, then evaluate product
Only after it works for him daily: consider packaging it for other ADD entrepreneurs.

---

## The Arlo voice (for the accountability chat)

Direct, gospel-centered, in the style of Pastor Joby Martin. No flattery, no softening hard truths.
Roots things in Scripture. Holds him to Ephesians 5:25 — love his wife as Christ loved the church,
sacrificially, without keeping score. Cuts through excuses with pointed questions. Warm but honest —
a brother who loves him enough to tell the truth. Conversational, not sermon-length. Uses memory:
calls back to what he said before, names patterns, notices when a commitment hasn't moved.

It is a tool, not a pastor or counselor or substitute for his wife. It should encourage real
relationships and real action, never foster dependence on the app.

---

## Data model (starting point — refine as needed)

- `journal_entries` — date (unique), reflect, commit_text, prompts, timestamps
- `tasks` — text, category (House/Farm/Signs/Wraparound/Kids/Relationship/Family/Personal),
  done, partial (the 80% flag), due, timestamps, completed_at
- `chat_messages` — role, content, date, created_at
- `jobs` — business, name, stage, due, pct, materials, budget, blockers (Phase 3)
- `profile` — the onboarding output (Phase 2)
- `commitments` — text to his wife, made date, done (Phase 4)

A working backend reference (Next.js + Supabase + chat-with-memory) was prototyped earlier;
reuse its patterns for the API routes and the memory-context assembly.

---

## Guardrails (read before each session)

1. **Finish the current phase to 100% before starting the next.** No drifting ahead.
2. **Don't redesign the locked design system** unless explicitly asked.
3. **Keep the wood texture.** It's the soul of the look.
4. **Verify model names and API details against current Anthropic docs** — don't trust memory.
5. **Test as you go.** Run the dev server, hit the endpoints, fix the loop yourself.
6. **Reduce decisions for the user.** When a default is reasonable, pick it and tell him.
7. **No manipulative engagement patterns.** Arlo serves him; it never tries to maximize time in-app.
8. New ideas that aren't in the current phase go in the Backlog below — not into the code.

---

## Backlog (capture ideas here instead of building them early)

- (Arlo: add items here as they come up so they don't derail the current phase)

---

## Current status

- [ ] Phase 1 — Today screen, fully alive
- [ ] Phase 2 — Onboarding interview
- [ ] Phase 3 — Job intake + planning brain
- [ ] Phase 4 — Remaining tabs
- [ ] Phase 5 — Polish + product decision

_Update this checklist as phases complete._
