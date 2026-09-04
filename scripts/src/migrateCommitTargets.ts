// One-time backfill for #72 — CLI entry point. Core logic lives in
// @workspace/db's migrations.ts (shared with the admin-triggered route
// pattern established by #28/#29's migrations) so both callers stay in sync.
//
// Run with: pnpm --filter @workspace/scripts run migrate-commit-targets

import { pool } from "@workspace/db";
import { migrateCommitTargets } from "@workspace/db/migrations";

async function main() {
  const { targetsCreated } = await migrateCommitTargets(pool);
  console.log(`Migrated ${targetsCreated} commit-relationship target(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
