import { sql, type SQL } from "drizzle-orm";
import { relationships } from "@workspace/db";

export const RELATIONSHIP_CATEGORIES = ["spouse", "child", "family", "friend", "other"] as const;
export type RelationshipCategory = (typeof RELATIONSHIP_CATEGORIES)[number];
export function isRelationshipCategory(value: unknown): value is RelationshipCategory {
  return typeof value === "string" && (RELATIONSHIP_CATEGORIES as readonly string[]).includes(value);
}

// Best-effort classifier for free text (onboarding's AI-extracted `type`, or
// a legacy profile's pre-migration shape) into the fixed category the sort
// order actually keys on. Used at write time only — once a relationship has
// a category, sorting is exact, never guessed again.
export function guessRelationshipCategory(rawType: string | null | undefined): RelationshipCategory {
  const t = (rawType || "").toLowerCase();
  if (/spouse|wife|husband/.test(t)) return "spouse";
  if (/child|son|daughter|kid/.test(t)) return "child";
  if (/friend|mentee|colleague/.test(t)) return "friend";
  return "family";
}

// Sort order this whole feature promises: spouse, then children, then other
// family, then friends — exact because `category` is a fixed enum, not
// guessed. Within a category, oldest-created first (onboarding/add order).
export const RELATIONSHIP_RANK_SQL: SQL = sql`CASE ${relationships.category}
  WHEN 'spouse' THEN 0
  WHEN 'child' THEN 1
  WHEN 'family' THEN 2
  WHEN 'friend' THEN 3
  WHEN 'other' THEN 4
  ELSE 5
END`;

// Same ranking as RELATIONSHIP_RANK_SQL, for JS-side use (#65's
// insertIntoOrderedGroup) — one source of truth for the category order.
export const RELATIONSHIP_CATEGORY_RANK: Record<RelationshipCategory, number> = {
  spouse: 0, child: 1, family: 2, friend: 3, other: 4,
};
