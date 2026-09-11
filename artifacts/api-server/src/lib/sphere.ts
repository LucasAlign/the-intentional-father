// #82 — "The Sphere": Protect (Family/Yourself/Community) / Provide / Lead.
// A fixed category set, same pattern as PULSE_CATEGORIES/RELATIONSHIP_CATEGORIES —
// the specific "how to protect/provide/lead" bullet points from the grilled
// spec live in each week's free-text note, not as separate tracked fields.
export const SPHERE_CATEGORIES = ["family", "yourself", "community", "provide", "lead"] as const;
export type SphereCategory = (typeof SPHERE_CATEGORIES)[number];
export function isSphereCategory(value: unknown): value is SphereCategory {
  return typeof value === "string" && (SPHERE_CATEGORIES as readonly string[]).includes(value);
}

export const SPHERE_CATEGORY_LABEL: Record<SphereCategory, string> = {
  family: "Family", yourself: "Yourself", community: "Community", provide: "Provide", lead: "Lead",
};
// "Family"/"Yourself"/"Community" render grouped under a "Protect" heading in
// the UI; "Provide" and "Lead" each get their own single-item section
// heading the same way, so every category sits under a visible heading.
export const SPHERE_CATEGORY_GROUP: Record<SphereCategory, string> = {
  family: "Protect", yourself: "Protect", community: "Protect", provide: "Provide", lead: "Lead",
};

export const SPHERE_STATES = ["up", "mid", "down"] as const;
export type SphereState = (typeof SPHERE_STATES)[number];
export function isSphereState(value: unknown): value is SphereState {
  return typeof value === "string" && (SPHERE_STATES as readonly string[]).includes(value);
}
// Same vocabulary as PULSE_STATE_LABEL — "steady" for mid, not "mid".
export const SPHERE_STATE_LABEL: Record<SphereState, string> = { up: "up", mid: "steady", down: "down" };
export const SPHERE_STATE_SCORE: Record<SphereState, number> = { up: 1, mid: 0.5, down: 0 };

// Monday of the ISO week containing `date`, as YYYY-MM-DD. The client is the
// source of truth for "what week is it" (same reasoning as tasks/pulse-checks'
// `?today=` param — no per-user timezone anywhere in this schema, see
// CLAUDE.md's Gotchas), so this exists mainly to validate a client-supplied
// value server-side and for any one-off server-side default.
export function getWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().split('T')[0];
}
