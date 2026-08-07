export interface RelationshipProfile {
  name?: string | null;
  type?: string | null;
  notes?: string | null;
  commitments?: string | null;
  biggest_challenge?: string | null;
}

export interface CoreIdentity {
  worldview?: string | null;
  top_priority?: string | null;
  values?: string[];
}

export interface BusinessProfile {
  name?: string | null;
  role?: string | null;
  rhythm?: string | null;
  common_blockers?: string[];
  key_metrics?: string[];
}

export interface PlanningProfile {
  decision_drain?: string | null;
  common_failure_point?: string | null;
  ideal_rhythm?: string | null;
  where_ai_helps_most?: string | null;
}

export interface ProfileData {
  name?: string | null;
  season_of_life?: string | null;
  core_identity?: CoreIdentity | null;
  businesses?: BusinessProfile[];
  relationships?: RelationshipProfile[];
  planning_profile?: PlanningProfile | null;
  guardrails?: { do_not_suggest?: string[]; always_remind_of?: string | null };
  voice?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRelationship(raw: unknown): RelationshipProfile | null {
  if (!isRecord(raw)) return null;
  return {
    name: typeof raw.name === "string" ? raw.name : null,
    type: typeof raw.type === "string" ? raw.type : null,
    notes: typeof raw.notes === "string" ? raw.notes : null,
    commitments: typeof raw.commitments === "string" ? raw.commitments : null,
    biggest_challenge: typeof raw.biggest_challenge === "string" ? raw.biggest_challenge : null,
  };
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

function normalizeBusiness(raw: unknown): BusinessProfile | null {
  if (!isRecord(raw)) return null;
  return {
    name: typeof raw.name === "string" ? raw.name : null,
    role: typeof raw.role === "string" ? raw.role : null,
    rhythm: typeof raw.rhythm === "string" ? raw.rhythm : null,
    common_blockers: stringArray(raw.common_blockers),
    key_metrics: stringArray(raw.key_metrics),
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

// Profiles onboarded before the "relationships" array replaced the fixed
// "family" object are still stored in the old shape — map them forward.
function legacyFamilyToRelationships(family: unknown): RelationshipProfile[] {
  if (!isRecord(family)) return [];
  const relationships: RelationshipProfile[] = [];
  if (typeof family.spouse_name === "string" || family.marriage_commitments || family.biggest_challenge) {
    relationships.push({
      name: typeof family.spouse_name === "string" ? family.spouse_name : null,
      type: "spouse",
      notes: null,
      commitments: typeof family.marriage_commitments === "string" ? family.marriage_commitments : null,
      biggest_challenge: typeof family.biggest_challenge === "string" ? family.biggest_challenge : null,
    });
  }
  return relationships;
}

/**
 * Coerces raw jsonb `profile.data` (LLM-extracted, never schema-validated) into
 * a shape every consumer can trust — malformed fields become null/[] instead
 * of throwing downstream, and pre-migration "family"-shaped rows still work.
 */
export function normalizeProfileData(raw: unknown): ProfileData | null {
  if (!isRecord(raw)) return null;

  const rawRelationships = Array.isArray(raw.relationships)
    ? raw.relationships.map(normalizeRelationship).filter((r): r is RelationshipProfile => r !== null)
    : legacyFamilyToRelationships(raw.family);

  const rawGuardrails = isRecord(raw.guardrails) ? raw.guardrails : null;
  const doNotSuggest = Array.isArray(rawGuardrails?.do_not_suggest)
    ? rawGuardrails.do_not_suggest.filter((v): v is string => typeof v === "string")
    : [];

  const rawBusinesses = Array.isArray(raw.businesses)
    ? raw.businesses.map(normalizeBusiness).filter((b): b is BusinessProfile => b !== null)
    : [];

  return {
    name: typeof raw.name === "string" ? raw.name : null,
    season_of_life: typeof raw.season_of_life === "string" ? raw.season_of_life : null,
    core_identity: normalizeCoreIdentity(raw.core_identity),
    businesses: rawBusinesses,
    relationships: rawRelationships,
    planning_profile: normalizePlanningProfile(raw.planning_profile),
    guardrails: {
      do_not_suggest: doNotSuggest,
      always_remind_of: typeof rawGuardrails?.always_remind_of === "string" ? rawGuardrails.always_remind_of : null,
    },
    voice: typeof raw.voice === "string" ? raw.voice : null,
  };
}
