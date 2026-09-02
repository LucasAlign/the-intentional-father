// One-time backfill for #28 — CLI entry point. Core logic lives in
// @workspace/db's migrations.ts (shared with the admin-triggered route in
// api-server/src/routes/admin.ts) so both callers stay in sync.
//
// Run with: pnpm --filter @workspace/scripts run migrate-relationships

import { pool } from "@workspace/db";
import { migrateRelationships } from "@workspace/db/migrations";

async function main() {
  const { migratedRelationships, migratedUsers, skippedAlreadyMigrated } = await migrateRelationships(pool);
  console.log(`Migrated ${migratedRelationships} relationship(s) across ${migratedUsers} user(s). Skipped ${skippedAlreadyMigrated} already-migrated user(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
