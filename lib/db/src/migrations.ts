// Shared migration logic for #28/#29's one-time backfills, callable both from
// the standalone CLI scripts (scripts/src/migrateRelationships.ts,
// migratePursuits.ts) and from a request handler (e.g. an admin-triggered
// route) — anywhere that has its own long-lived `pool` it doesn't want ended
// after one run. Each function opens and releases its own client; neither
// touches `pool.end()`, so the caller decides the pool's lifecycle.
//
// Both need the same app.bypass_rls escape hatch ensureAuthTables() uses —
// RLS (#26) is fail-closed and neither has a per-request user session to
// scope it, so without the bypass they'd silently see zero rows.

import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { jobs, profile, pursuits, relationships } from "./index";

const RELATIONSHIP_CATEGORIES = ["spouse", "child", "family", "friend"] as const;
type RelationshipCategory = (typeof RELATIONSHIP_CATEGORIES)[number];

function isRelationshipCategory(value: unknown): value is RelationshipCategory {
  return typeof value === "string" && (RELATIONSHIP_CATEGORIES as readonly string[]).includes(value);
}

function guessRelationshipCategory(rawType: string | null | undefined): RelationshipCategory {
  const t = (rawType || "").toLowerCase();
  if (/spouse|wife|husband/.test(t)) return "spouse";
  if (/child|son|daughter|kid/.test(t)) return "child";
  if (/friend|mentee|colleague/.test(t)) return "friend";
  return "family";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface RelationshipInsert {
  name: string | null;
  category: RelationshipCategory;
  type: string;
  notes: string;
  commitments: string;
  biggestChallenge: string;
}

function fromRelationshipsArray(raw: unknown[]): RelationshipInsert[] {
  return raw.filter(isRecord).map((r) => ({
    name: typeof r.name === "string" ? r.name : null,
    category: isRelationshipCategory(r.category) ? r.category : guessRelationshipCategory(typeof r.type === "string" ? r.type : null),
    type: typeof r.type === "string" ? r.type : "",
    notes: typeof r.notes === "string" ? r.notes : "",
    commitments: typeof r.commitments === "string" ? r.commitments : "",
    biggestChallenge: typeof r.biggest_challenge === "string" ? r.biggest_challenge : "",
  }));
}

// Profiles onboarded before the "relationships" array existed stored a
// single fixed "family" object instead — the only shape worth carrying
// forward from it is the spouse.
function fromLegacyFamily(family: unknown): RelationshipInsert[] {
  if (!isRecord(family)) return [];
  if (typeof family.spouse_name !== "string" && !family.marriage_commitments && !family.biggest_challenge) return [];
  return [{
    name: typeof family.spouse_name === "string" ? family.spouse_name : null,
    category: "spouse",
    type: "spouse",
    notes: "",
    commitments: typeof family.marriage_commitments === "string" ? family.marriage_commitments : "",
    biggestChallenge: typeof family.biggest_challenge === "string" ? family.biggest_challenge : "",
  }];
}

export interface MigrateRelationshipsResult {
  migratedUsers: number;
  migratedRelationships: number;
  skippedAlreadyMigrated: number;
}

// Moves relationships out of the profile.data jsonb blob (either the current
// "relationships" array shape, or the older pre-migration "family" shape)
// into the dedicated `relationships` table. Safe to re-run — any user who
// already has rows in `relationships` is skipped, so a second run is a
// no-op for already-migrated users (and for users who added relationships
// directly through the live Tribe tab before this ever ran).
export async function migrateRelationships(pool: Pool): Promise<MigrateRelationshipsResult> {
  const client = await pool.connect();
  let migratedUsers = 0;
  let migratedRelationships = 0;
  let skippedAlreadyMigrated = 0;
  try {
    await client.query("SELECT set_config('app.bypass_rls', 'true', false)");
    const db = drizzle(client);

    const profiles = await db.select().from(profile);

    for (const row of profiles) {
      if (!isRecord(row.data)) continue;

      const toInsert = Array.isArray(row.data.relationships)
        ? fromRelationshipsArray(row.data.relationships)
        : fromLegacyFamily(row.data.family);
      if (toInsert.length === 0) continue;

      const [existing] = await db.select({ id: relationships.id }).from(relationships).where(eq(relationships.userId, row.userId)).limit(1);
      if (existing) {
        skippedAlreadyMigrated++;
        continue;
      }

      for (const r of toInsert) {
        await db.insert(relationships).values({ userId: row.userId, ...r });
        migratedRelationships++;
      }
      migratedUsers++;
    }
  } finally {
    await client.query("RESET app.bypass_rls").catch(() => undefined);
    client.release();
  }

  return { migratedUsers, migratedRelationships, skippedAlreadyMigrated };
}

export interface MigratePursuitsResult {
  pursuitsCreated: number;
  jobsRetagged: number;
}

// Turns each user's existing distinct `jobs.biz` values into real `pursuits`
// rows (category "business", since that's what `biz` always meant), then
// re-tags their jobs to point at the new pursuit_id. Safe to re-run — any
// job that already has a pursuit_id is left alone, so a second run only
// picks up jobs added since the first.
export async function migratePursuits(pool: Pool): Promise<MigratePursuitsResult> {
  const client = await pool.connect();
  let pursuitsCreated = 0;
  let jobsRetagged = 0;
  try {
    await client.query("SELECT set_config('app.bypass_rls', 'true', false)");
    const db = drizzle(client);

    const unmigrated = await db.select().from(jobs).where(isNull(jobs.pursuitId));

    // Group unmigrated jobs by (userId, biz), skipping jobs with no biz set.
    const groups = new Map<string, { userId: string; biz: string; jobIds: number[] }>();
    for (const job of unmigrated) {
      if (!job.biz) continue;
      const key = `${job.userId} ${job.biz}`;
      const group = groups.get(key);
      if (group) group.jobIds.push(job.id);
      else groups.set(key, { userId: job.userId, biz: job.biz, jobIds: [job.id] });
    }

    for (const { userId, biz, jobIds } of groups.values()) {
      let [pursuit] = await db.select().from(pursuits).where(and(eq(pursuits.userId, userId), eq(pursuits.name, biz))).limit(1);
      if (!pursuit) {
        [pursuit] = await db.insert(pursuits).values({ userId, name: biz, category: "business" }).returning();
        pursuitsCreated++;
      }
      for (const jobId of jobIds) {
        await db.update(jobs).set({ pursuitId: pursuit.id }).where(eq(jobs.id, jobId));
        jobsRetagged++;
      }
    }
  } finally {
    await client.query("RESET app.bypass_rls").catch(() => undefined);
    client.release();
  }

  return { pursuitsCreated, jobsRetagged };
}
