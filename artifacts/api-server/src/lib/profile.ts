export interface CoreIdentity {
  worldview?: string | null;
  top_priority?: string | null;
  values?: string[];
}

export interface PlanningProfile {
  decision_drain?: string | null;
  common_failure_point?: string | null;
  ideal_rhythm?: string | null;
  where_ai_helps_most?: string | null;
}

export const TONE_VOICES = ["straight_talk", "middle_of_the_road", "take_it_easy"] as const;
export type ToneVoice = (typeof TONE_VOICES)[number];
export const DEFAULT_TONE_VOICE: ToneVoice = "straight_talk";

export function isToneVoice(value: unknown): value is ToneVoice {
  return typeof value === "string" && (TONE_VOICES as readonly string[]).includes(value);
}

export interface ProfileData {
  name?: string | null;
  season_of_life?: string | null;
  core_identity?: CoreIdentity | null;
  planning_profile?: PlanningProfile | null;
  guardrails?: { do_not_suggest?: string[]; always_remind_of?: string | null };
  voice: ToneVoice;
  // Daily commitment-reminder emails (#75) — defaults to on so a user gets
  // the benefit without having to find a setting first; PATCHable the same
  // way voice is.
  remindersEnabled: boolean;
  // Helpful Hints (#83) — a profile-page master switch over the per-hint
  // <FirstVisitTip> close buttons scattered across the tabs. #142/SIM-08:
  // defaults to true here (on unless the user has explicitly turned it
  // off) — a never-configured `hintsEnabled` (null/undefined, the state
  // for anyone who hasn't touched the Profile-menu toggle) reads as on,
  // so hints show without requiring that toggle to be found and flipped
  // first. routes/interview.ts still seeds hintsEnabled: true explicitly
  // at onboarding completion/skip for a brand new user — now redundant
  // with this default, left in place as a harmless, explicit statement of
  // intent rather than relied on as the only place hints turn on.
  hintsEnabled: boolean;
  // Hint ids the user has individually closed while the master switch is
  // on. Turning the switch on (from off) always clears this array — that's
  // the "reset" behavior, not something normalizeProfileData decides.
  dismissedHints: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

function normalizeCoreIdentity(raw: unknown): CoreIdentity | null {
  if (!isRecord(raw)) return null;
  return {
    worldview: typeof raw.worldview === "string" ? raw.worldview : null,
    top_priority: typeof raw.top_priority === "string" ? raw.top_priority : null,
    values: stringArray(raw.values),
  };
}

function normalizePlanningProfile(raw: unknown): PlanningProfile | null {
  if (!isRecord(raw)) return null;
  return {
    decision_drain: typeof raw.decision_drain === "string" ? raw.decision_drain : null,
    common_failure_point: typeof raw.common_failure_point === "string" ? raw.common_failure_point : null,
    ideal_rhythm: typeof raw.ideal_rhythm === "string" ? raw.ideal_rhythm : null,
    where_ai_helps_most: typeof raw.where_ai_helps_most === "string" ? raw.where_ai_helps_most : null,
  };
}

/**
 * Coerces raw jsonb `profile.data` (LLM-extracted, never schema-validated) into
 * a shape every consumer can trust — malformed fields become null/[] instead
 * of throwing downstream. Relationships and pursuits live in their own tables
 * (see #28, #29) and are never read from or written to this blob.
 */
export function normalizeProfileData(raw: unknown): ProfileData | null {
  if (!isRecord(raw)) return null;

  const rawGuardrails = isRecord(raw.guardrails) ? raw.guardrails : null;
  const doNotSuggest = Array.isArray(rawGuardrails?.do_not_suggest)
    ? rawGuardrails.do_not_suggest.filter((v): v is string => typeof v === "string")
    : [];

  return {
    name: typeof raw.name === "string" ? raw.name : null,
    season_of_life: typeof raw.season_of_life === "string" ? raw.season_of_life : null,
    core_identity: normalizeCoreIdentity(raw.core_identity),
    planning_profile: normalizePlanningProfile(raw.planning_profile),
    guardrails: {
      do_not_suggest: doNotSuggest,
      always_remind_of: typeof rawGuardrails?.always_remind_of === "string" ? rawGuardrails.always_remind_of : null,
    },
    voice: isToneVoice(raw.voice) ? raw.voice : DEFAULT_TONE_VOICE,
    remindersEnabled: raw.remindersEnabled !== false,
    // #142/SIM-08: on by default (only an explicit `false` turns it off),
    // same "opt out, not opt in" shape as remindersEnabled above.
    hintsEnabled: raw.hintsEnabled !== false,
    dismissedHints: stringArray(raw.dismissedHints),
  };
}
