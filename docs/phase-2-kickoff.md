# Phase 2 — Kickoff (ready to run)

> Phase 1 is code-complete and builds clean. When you're ready, paste the prompt
> below into Claude Code to start Phase 2. We'll decide "separate app vs. integrated"
> during the build — it doesn't block starting.

---

## Before you start Phase 2 (Phase 1 sign-off)

Run the app locally once and confirm the daily loop actually works end to end:

1. `npm install` → `npm run dev` → open http://localhost:3000
2. See the verse, your marriage intention, top-3 tasks, reflection box.
3. Send Arlo a message — it replies in the accountability voice.
4. Add a journal note, reload — it persisted.
5. Reopen tomorrow (or add an entry, then chat) — Arlo references your recent
   journal/tasks. That's the "it remembers" criterion.

If all five hold, Phase 1 is done. Then run Phase 2.

---

## The Phase 2 kickoff prompt

```
Read CLAUDE.md. Phase 1 (Today screen) is done and verified. Start Phase 2 — the
Onboarding Interview — and ONLY Phase 2. Don't touch Phase 3/4 features.

Build a one-time conversational interview where Arlo interviews the user and stores
a permanent profile that every other feature reads. Full design is in
docs/arlo-onboarding-design.md if present; otherwise follow this:

1. Gate: on app load, read profile (singleton row). If profile.onboarded is false,
   route to /interview. After completion, route back to / (Today screen).

2. /interview — conversational, NOT a form. Arlo asks 6-7 questions over multiple
   turns, one at a time, conversational, with a progress indicator ("3 of 7").
   Cover: name + season of life; top priority; businesses (name, rhythm, common
   blockers); family/marriage (spouse name, key commitments, biggest challenge);
   planning profile (where projects stall, what drains decisions); guardrails
   (what should Arlo never suggest); voice preference.

3. /api/interview — multi-turn. Maintains the conversation, and when the questions
   are answered, extracts a STRUCTURED profile (see schema below) and upserts it to
   the `profile` table (data jsonb, onboarded=true). Returns Arlo's reply + progress.

4. Profile schema (store in profile.data jsonb):
   { name, season_of_life,
     core_identity: { worldview, top_priority, values[] },
     businesses: [ { name, role, rhythm, common_blockers[], key_metrics[] } ],
     family: { spouse_name, children, marriage_commitments, biggest_challenge },
     planning_profile: { decision_drain, common_failure_point, ideal_rhythm,
                         where_ai_helps_most },
     guardrails: { do_not_suggest[], always_remind_of } }

5. Personalize Phase 1 from the profile (same screen, smarter content — NO new cards):
   - Header greets by name with a one-line read of the day.
   - Verse card picks verses matching core_identity.worldview (biblical default).
   - Her card uses spouse_name + marriage_commitments; notices stale commitments.
   - Top-3 flags businesses[].common_blockers on matching tasks.
   - Arlo chat system prompt is built from the full profile + guardrails.

6. Confirmation step: before saving, Arlo reads the profile back ("Here's how I
   understand you...") with Confirm / Edit. Don't save until confirmed.

Verify model names against current Anthropic docs (use the claude-api skill) — the
interview can use Opus for the extraction reasoning, Sonnet for the chat turns.
Keep the locked design system. Build it, run the dev server, test the flow.
```

---

## Decisions deferred to during the build

- **Separate app vs. integrated mode** — start integrated (one app, `/interview`
  route + profile gate). Splitting later is cheap; deciding now isn't needed.
- **Multi-user** — Phase 2 stays single-user (one `profile` singleton row), matching
  the current schema. Multi-tenant comes only if/when you productize (Phase 5).

---

## Notes carried over from Phase 1 (for transparency)

- **Verse source:** the schema has no `verses` table, so Phase 1 uses a small curated
  rotating array of verses (rotates by day-of-year). If you want a real verse library
  or an API source, that's a quick add — say so and we'll wire it.
- **Model:** the Arlo chat uses `claude-sonnet-4-6` (cost-appropriate for frequent
  chat, per CLAUDE.md "Sonnet for cost, Opus for reasoning"). The retired
  `claude-3-5-sonnet-20241022` string was replaced.
- **Auth/RLS:** still single-user dev mode (anon key, no RLS), exactly as the schema's
  security note describes. Lock this down at Phase 5 / before any real deployment.
