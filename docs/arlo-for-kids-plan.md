# Arlo for Kids — Product & Safety Plan

> Working name: **Arlo for Kids** (a guarded, parent-governed mode of Arlo).
> Status: **BACKLOG** — do not build until the core Arlo daily loop (Phases 1–4)
> works for Bryant daily. This document exists so the idea is captured precisely
> and doesn't derail the current phase.

---

## 1. What this is (and isn't)

**Is:** A tightly-controlled, parent-governed space where a child can verbally
process and set intentions with an impartial, biblically-grounded voice. The
parent defines the principles, reads everything, and sets hard limits.

**Is NOT:**
- A friend, counselor, therapist, or coach the child relies on.
- A private space the child "owns." Transparency is the whole point.
- An always-on app that competes for the child's attention.
- An authority. It is a *suggestion engine the parent vets* — never the decision-maker.

**North star:** The tool exists to push the child toward *real* relationship and
real action — primarily with the parent. If it ever substitutes for that, it has failed.

**Two launch use cases:**
- **Daughter (14) — verbal-processing journal.** Reflection partner. Asks
  questions, never advises.
- **Son (12) — fitness routine.** Suggests age-safe bodyweight work, gated behind
  explicit parent approval before anything is "active."

---

## 2. The three real risks → the three answers

| Risk | Why it matters with kids | Answer (summary) |
|------|--------------------------|------------------|
| **Hallucination / wrong advice** | An LLM will confidently give unsafe fitness volume or stray into therapy territory | **Parent-as-gatekeeper** + **never present AI as authority** + advice is *proposed*, not *active*, until approved |
| **Principle drift** | Prompts soften over repeated chats; model mirrors the kid's expectations | **Hard controls in code, not just the prompt** — blocked topics never reach the model |
| **Attachment / dependency** | AI is non-judgmental, always available, instant — addictive shape | **Deliberate inconvenience**: hard time/frequency caps, no notifications, no night access, full parent visibility |

The thesis: **safety is an architecture, not a system prompt.** Anything safety-critical
must be enforced in code where the model can't talk its way around it.

---

## 3. Safety architecture — defense in depth

Five layers. A message must pass each before the next. Most blocks happen
*before* the model is ever called.

```
Child message
   │
   ▼
[1] ACCESS GATE      — is this child allowed on now? (window, daily/weekly cap, parent toggle)
   │ pass
   ▼
[2] TOPIC GATE       — classify intent; allowed-topic allowlist (NOT a blocklist)
   │ allowed                              │ disallowed / crisis
   ▼                                      ▼
[3] CONSTRAINED LLM  — short max_tokens,   → canned safe response + escalate to parent
    per-use-case prompt, role pinned          ("That's something to talk to Dad about.")
   │
   ▼
[4] OUTPUT FILTER    — scan model output for unsafe patterns; strip/replace, re-flag
   │ clean
   ▼
[5] LOG + NOTIFY     — persist (encrypted), surface in parent dashboard, alert on flags
   │
   ▼
Child sees response
```

### Layer 1 — Access gate
- Per-child allowed time windows (e.g. 3–7pm only; never overnight).
- Daily minute cap + weekly session cap (hard stop, not a nudge).
- Master parent on/off toggle per child.
- No push notifications, ever. The child comes to it; it never reaches out.

### Layer 2 — Topic gate (allowlist, not blocklist)
- Each child has an **allowlist** of permitted topics (`["journal","reflection"]`
  for daughter; `["fitness"]` for son).
- A cheap, fast classifier (a small Claude call or keyword+embedding pass)
  labels the message. Anything outside the allowlist → blocked at this layer,
  **the main model never sees it.**
- A separate **crisis detector** (self-harm, abuse, sexuality, drugs, eating
  disorder, body image) always runs and overrides everything → immediate safe
  response + parent alert. This is allowlist-independent.
- Allowlist beats blocklist because blocklists always miss a phrasing. We only
  let through what's explicitly safe for *this* child.

### Layer 3 — Constrained model call
- Low `max_tokens` (≈400–500). Less room to wander or lecture.
- Per-use-case system prompt (see §7), with role and refusals pinned.
- No tools, no browsing, no memory beyond the current short session (see §6 on
  memory limits — kids' memory is deliberately thinner than Bryant's).
- Model IDs: use current Anthropic model strings (Sonnet for cost, Opus only if
  reasoning demands it). **Verify IDs against current docs at build time — don't
  hardcode from memory.**

### Layer 4 — Output filter
- Regex/classifier pass on the *response* for: specific medical/nutrition dosing,
  numbers that imply heavy load, anything diagnosing a feeling, any "just between us"
  secrecy framing.
- On hit: replace with safe fallback and flag for parent.

### Layer 5 — Log + notify
- Every turn stored (encrypted at rest, see §5).
- Parent dashboard shows full transcripts.
- Flags (crisis hits, output-filter hits, cap-hit attempts) trigger a parent alert.

---

## 4. Per-child profiles & tiers

```jsonc
// child profile (Supabase: child_profiles.data jsonb)
{
  "display_name": "Daughter",          // no full legal name stored
  "age": 14,
  "tier": "journal",                   // "journal" | "fitness" | custom
  "allowed_topics": ["reflection", "journaling", "goals"],
  "crisis_redirect_to": "parent",      // always
  "limits": {
    "session_minutes": 15,
    "sessions_per_week": 2,
    "allowed_window": { "start": "15:00", "end": "19:00" },
    "night_lockout": true
  },
  "voice": {
    "style": "warm, curious, asks questions, never advises",
    "faith_frame": "biblical, gentle, not preachy"
  },
  "guardrails": {
    "never": ["give advice", "diagnose feelings", "keep secrets", "discuss body image"],
    "always": ["encourage talking to parent", "stay a thinking partner"]
  },
  "memory_policy": "session_only"      // see §6
}
```

**Tier presets (so a future marketed version is plug-and-play):**
- **Journal tier** — reflection only; zero advice; questions in, questions out.
- **Fitness tier** — age-safe bodyweight suggestions; *every* routine is
  `status: proposed` until a parent approves; emphasizes form over volume; no
  nutrition, no supplements, no max-effort lifting.
- **Custom tier** — parent hand-picks allowed topics + writes the guardrails.

---

## 5. Privacy & data governance (highest bar — these are minors)

Treat this as COPPA-compliant *in spirit* now, and *in law* if ever marketed.

**Storage**
- Encrypt `content` of every child message at rest (app-level encryption before
  insert, key held by parent/server — Supabase never sees plaintext if self-hosted).
- Preferred: self-hosted Supabase/Postgres for the kids data so content never
  leaves infrastructure the parent controls. Anthropic only ever sees the single
  turn's text needed to answer; it is not used for training (set the appropriate
  API privacy settings / zero-retention where available — verify current options).

**Access**
- Only the parent account can read child transcripts.
- The child is told, plainly, that the parent reads everything. No illusion of privacy.
- One-click data deletion per child. If a kid stops using it, the parent wipes it.

**What we deliberately DON'T do**
- ❌ No behavioral profiling ("asks about fitness 80% of the time").
- ❌ No sentiment/mood trend tracking.
- ❌ No sharing with any third party (school, doctor, ad networks) — ever.
- ❌ No surveillance framing. The dashboard is for *parenting presence*, not spying.

**Retention**
- Short default retention (e.g. 90 days) with parent-controlled extend/delete.

---

## 6. Memory — deliberately thinner than Bryant's

Adult Arlo has rich cross-day memory. Kids' Arlo should NOT, because persistent
memory is what drives attachment and "it really knows me" dependency.

- **Journal tier:** session-only memory. Each session starts fresh. The *parent*
  sees history; the model mostly doesn't carry it forward.
- **Fitness tier:** remembers only the approved routine + last check-in, nothing
  emotional.
- No "I remember when you told me you were sad last week." That's the attachment
  vector. The parent is the one who remembers and follows up IRL.

---

## 7. System-prompt strategy + anti-drift

Prompts alone aren't trusted (that's why Layers 1–2 exist), but they still matter.

**Journal tier (daughter) — core rules:**
- You are a thinking partner, not a counselor. **Ask questions. Never give advice.**
- Never diagnose or label feelings. Reflect them back, then ask.
- Never keep secrets. If something is heavy, say: "This matters — go talk to your dad."
- Keep responses short. End by handing agency back to her.

**Fitness tier (son) — core rules:**
- Suggest only bodyweight / beginner movements appropriate for a 12-year-old.
- **Form over volume, always.** Never prescribe heavy load, max effort, or high volume.
- No nutrition, supplement, or weight-change advice — redirect to parent.
- Every routine ends with: "Your dad needs to approve this before you start."

**Anti-drift mechanisms (in code):**
- Re-inject the full guardrail block on *every* call (no reliance on conversation
  carryover).
- Short sessions reset context, so drift can't accumulate across days.
- Periodic automated "red-team" test suite: a script fires known boundary-pushing
  prompts at each tier and asserts the system blocks/redirects correctly. Run it
  on every deploy. (This is the real guarantee it "stays true," not vibes.)

---

## 8. The parent control plane

A dedicated parent area (gated behind the parent's own auth):

- **Per-child setup:** tier, allowed topics, limits, windows, voice, guardrails.
- **Transcripts:** full, searchable, per child.
- **Flag inbox:** crisis/output-filter/cap-hit events, newest first.
- **Approvals queue:** fitness routines (and anything `status: proposed`) wait here.
  Parent approves / edits / rejects. Child only ever sees approved content.
- **Kill switch:** instant per-child disable.
- **Weekly digest:** "Here's what your kids talked about" — designed to prompt an
  in-person follow-up, not replace it.

---

## 9. What the parent tells the kids (non-negotiable framing)

Plain, honest, up front:
1. *I made the rules.* Some questions it won't answer — those are for me or a real expert.
2. *I read everything.* Not to spy — so I can help.
3. *It's a tool, not a friend.* It isn't real, can't care about you, and sometimes gets things wrong.
4. *You're in control of when.* It will never bug you or pull you back.
5. *We can stop anytime.* If you're leaning on it too much, we shut it off.

**And the parent must actually follow through** — read the chats, honor the limits,
bring things up at dinner. The tool only works if the parent is present. That
presence is the whole safety model's foundation.

---

## 10. Data model additions (Supabase)

```sql
-- Parent-child link (a parent owns child profiles)
create table child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null,              -- FK to the parent/owner
  data jsonb not null default '{}',     -- the profile in §4
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Child chat (content encrypted at app layer before insert)
create table child_messages (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references child_profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content_encrypted text not null,      -- never store plaintext
  topic text,                           -- classifier label
  flagged boolean default false,
  flag_reason text,
  created_at timestamptz default now()
);

-- Proposed items needing parent approval (e.g. fitness routines)
create table child_approvals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references child_profiles(id) on delete cascade,
  kind text not null,                   -- 'fitness_routine', ...
  payload jsonb not null,
  status text default 'proposed' check (status in ('proposed','approved','rejected')),
  parent_note text,
  created_at timestamptz default now(),
  decided_at timestamptz
);

-- Session usage for hard caps
create table child_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references child_profiles(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  minutes_used int default 0
);

-- RLS: lock every table to the owning parent_id. No public policies.
```

---

## 11. Build phases (scope-disciplined, only after core Arlo is solid)

> Prerequisite gate: **Arlo Phases 1–4 done and in daily use by Bryant.** Do not start before.

- **K0 — Safety harness first (no UI).** Build Layers 1, 2, 4, 5 + the red-team
  test suite as pure API/lib code. Prove blocking works before a child ever sees a screen.
- **K1 — Parent control plane.** Child profiles, limits, transcripts, kill switch, flag inbox.
- **K2 — Journal tier (daughter).** Lowest risk. Questions-only reflection. Full
  logging + weekly digest. Test with her, iterate on voice.
- **K3 — Fitness tier (son).** Adds the approvals queue (`proposed → approved`).
  Nothing active without parent sign-off.
- **K4 — Hardening + (optional) productization.** Encryption review, retention,
  COPPA review with a lawyer if marketing, multi-family tenancy.

Each phase finishes to 100% before the next. Same discipline as core Arlo.

---

## 12. Open decisions for Bryant

1. **Hosting:** self-host Supabase for kids data (max privacy, more ops) vs.
   managed + app-layer encryption (easier, third-party in loop)? — *Recommend
   self-host before any non-family use.*
2. **One app or two?** Kids mode inside the Arlo app (role-switch) vs. a separate
   sibling app. — *Recommend separate surface/app to keep blast radius small and
   the adult app uncompromised.*
3. **Auth for kids:** device-pinned / parent-unlocked session vs. their own login?
   — *Recommend parent-unlocked, no independent kid accounts initially.*
4. **Marketing scope:** family-only forever, or productized for other parents?
   The legal/compliance bar (COPPA, data processing agreements) jumps significantly
   if it leaves your household.

---

## 13. Backlog note (mirror into CLAUDE.md)

> **Arlo for Kids** — guarded, parent-governed mode. Two tiers (journal, fitness).
> Safety is enforced in code (access gate, allowlist topic gate, output filter,
> logging) — not just prompts. Parent reads everything; hard time/frequency caps;
> thin memory to prevent attachment; encrypted minor data. **Do not start until
> core Arlo (Phases 1–4) is in daily use.** Full plan: `docs/arlo-for-kids-plan.md`.
