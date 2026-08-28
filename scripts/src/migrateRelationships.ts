// One-time backfill for #28: moves relationships out of the profile.data
// jsonb blob (either the current "relationships" array shape, or the older
// pre-migration "family" shape) into the dedicated `relationships` table.
// Safe to re-run — any user who already has rows in `relationships` is
// skipped, so a second run is a no-op for already-migrated users.
//
// Reads/writes across every user, so it needs the same app.bypass_rls
// escape hatch ensureAuthTables() uses (api-server/src/index.ts) — RLS
// (#26) is fail-closed, and this script has no per-request user session to
// scope it, so without the bypass it would silently see zero rows.
//
// Run with: pnpm --filter @workspace/scripts run migrate-relationships

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool, profile, relationships } from "@workspace/db";

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

async function main() {
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

  console.log(`Migrated ${migratedRelationships} relationship(s) across ${migratedUsers} user(s). Skipped ${skippedAlreadyMigrated} already-migrated user(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
