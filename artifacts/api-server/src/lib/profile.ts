export interface RelationshipProfile {
  name?: string | null;
  type?: string | null;
  notes?: string | null;
  commitments?: string | null;
  biggest_challenge?: string | null;
}

export interface ProfileData {
  name?: string | null;
  season_of_life?: string | null;
  relationships?: RelationshipProfile[];
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

  return {
    name: typeof raw.name === "string" ? raw.name : null,
    season_of_life: typeof raw.season_of_life === "string" ? raw.season_of_life : null,
    relationships: rawRelationships,
    guardrails: {
      do_not_suggest: doNotSuggest,
      always_remind_of: typeof rawGuardrails?.always_remind_of === "string" ? rawGuardrails.always_remind_of : null,
    },
    voice: typeof raw.voice === "string" ? raw.voice : null,
  };
}
