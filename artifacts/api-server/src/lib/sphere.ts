// #82 — "The Sphere": Protect (Family/Yourself/Community) / Provide / Lead.
// A fixed category set, same pattern as PULSE_CATEGORIES/RELATIONSHIP_CATEGORIES —
// the specific "how to protect/provide/lead" bullet points from the grilled
// spec live in each week's free-text note, not as separate tracked fields.
export const SPHERE_CATEGORIES = ["family", "yourself", "community", "provide", "lead"] as const;
export type SphereCategory = (typeof SPHERE_CATEGORIES)[number];
export function isSphereCategory(value: unknown): value is SphereCategory {
  return typeof value === "string" && (SPHERE_CATEGORIES as readonly string[]).includes(value);
}

// "provide"/"lead" stay the internal category ids (schema, API, storage) —
// only the display label changed to "Provision"/"Leadership".
export const SPHERE_CATEGORY_LABEL: Record<SphereCategory, string> = {
  family: "Family", yourself: "Yourself", community: "Community", provide: "Provision", lead: "Leadership",
};
// "Family"/"Yourself"/"Community" render grouped under a "Protect" heading in
// the UI; "Provision" and "Leadership" each get their own single-item section
// heading the same way, so every category sits under a visible heading.
export const SPHERE_CATEGORY_GROUP: Record<SphereCategory, string> = {
  family: "Protect", yourself: "Protect", community: "Protect", provide: "Provision", lead: "Leadership",
};

export const SPHERE_STATES = ["up", "mid", "down"] as const;
export type SphereState = (typeof SPHERE_STATES)[number];
export function isSphereState(value: unknown): value is SphereState {
  return typeof value === "string" && (SPHERE_STATES as readonly string[]).includes(value);
}
// Same vocabulary as PULSE_STATE_LABEL — "steady" for mid, not "mid".
export const SPHERE_STATE_LABEL: Record<SphereState, string> = { up: "up", mid: "steady", down: "down" };
export const SPHERE_STATE_SCORE: Record<SphereState, number> = { up: 1, mid: 0.5, down: 0 };

// Question text per category, index-matched to artifacts/arlo/src/pages/
// Home.tsx's SPHERE_QUESTIONS — duplicated here (not shared) because the
// full branching content (answer sets, follow-up copy) is UI-only and
// lives client-side, but stewardContext.ts needs at least the question
// text to summarize a flagged walkthrough answer for the AI. Same
// duplication trade-off this codebase already makes for category
// vocabularies (e.g. relationship categories are separately defined in
// lib/relationships.ts and inline in Home.tsx).
const SPHERE_QUESTION_TEXT: Record<SphereCategory, string[]> = {
  family: [
    "Is your family physically healthy and taken care of right now?",
    "Is your family doing okay emotionally?",
    "Do you feel your family is safe — physically, financially, otherwise?",
  ],
  yourself: [
    "Are you eating well, exercising, and getting enough sleep?",
    "Are you spending time in the Bible?",
    "Are you watching what you consume on your phone, TV, music, podcasts, social media, etc.?",
    "Are you taking breaks, and avoiding excess stress or toxic people?",
    "Do you have appropriate boundaries in your life with other people?",
    "Are you prioritizing God first, marriage 2nd, yourself and your children 3rd, and everything else 4th?",
    "Are you struggling with any addictions, resentments, anger, or struggles in your life?",
  ],
  community: [
    "Are you mentoring anyone?",
    "Is someone mentoring you?",
    "Are you serving others?",
    "Are you making time for close male friends or a band of brothers?",
  ],
  provide: [
    "Are you tithing?",
    "Are you helping those less fortunate than you?",
    "Are you managing your money well?",
    "Are you out of, or working to eliminate, debt?",
    "Are you working as if working for the Lord?",
    "Are you working to improve both your situation and those within your sphere of influence?",
  ],
  lead: [
    "Are you leading at home?",
    "Are you leading at work?",
    "Are you leading at church or in your community?",
    "Leading means owning your piece and doing your best with it — whether or not you're in charge.",
  ],
};

interface RawSphereAnswer { questionIndex?: unknown; answer?: unknown; note?: unknown; followup?: unknown; }

// One line per walkthrough answer worth flagging to the AI — anything that
// wasn't a clean "up"/"agree" with nothing to add. Only the question text
// plus whatever the user actually typed (note and/or followup) — never the
// canned follow-up prompt text itself, since that's UI copy, not the user's
// own words. Capped so one category's walkthrough can't dominate the prompt.
const MAX_FLAGGED_SPHERE_ANSWERS = 3;
export function summarizeFlaggedSphereAnswers(category: SphereCategory, rawAnswers: unknown): string[] {
  if (!Array.isArray(rawAnswers)) return [];
  const questions = SPHERE_QUESTION_TEXT[category];
  const lines: string[] = [];
  for (const entry of rawAnswers) {
    if (lines.length >= MAX_FLAGGED_SPHERE_ANSWERS) break;
    const a = entry as RawSphereAnswer;
    if (typeof a.questionIndex !== 'number' || typeof a.answer !== 'string') continue;
    if (a.answer !== 'down' && a.answer !== 'mid') continue; // "up"/"agree" needs no flagging
    const text = [a.note, a.followup].filter((v): v is string => typeof v === 'string' && v.length > 0).join(' — ');
    if (!text) continue;
    const question = questions[a.questionIndex];
    if (!question) continue;
    lines.push(`"${question}" — ${text.slice(0, 200)}`);
  }
  return lines;
}

// Sunday of the week containing `date` (UTC), as YYYY-MM-DD — the Sphere
// week runs Sunday through Saturday, resetting Saturday night at 11:59pm in
// the user's own timezone. The client (Home.tsx's weekStartYmd, using plain
// local Date methods) is the source of truth for "what week is it" — this
// UTC version exists only to validate a client-supplied value server-side
// and for one-off server-side defaults (the dashboard/history rollups),
// same reasoning as tasks/pulse-checks' `?today=` param (no per-user
// timezone anywhere in this schema, see CLAUDE.md's Gotchas).
export function getWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // getUTCDay(): 0 = Sunday
  return d.toISOString().split('T')[0];
}
