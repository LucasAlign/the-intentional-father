// #75 — daily commitment-reminder digest. Two entry points share the
// bucketing/formatting logic below:
//   - runReminderScan: the secret-keyed cron endpoint, scans every user with
//     reminders enabled. Needs an elevated, bypass_rls connection (same
//     pattern as lib/db/migrations.ts) since it's not scoped to one
//     request's user.
//   - sendTestReminderDigest: the authenticated "send me a test reminder"
//     endpoint, scoped to the calling user via their normal RLS-scoped `db`.
//     Always shows the commitments currently in each window and never
//     touches remindedDueAt/remindedOverdueAt — a test send must not use up
//     a real reminder's one-shot.

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";
import { commits, profile as profileTable, usersTable, pool as poolExport, type Commit } from "@workspace/db";
import { resolveCommitWhoLabels } from "./stewardContext";
import { isRecord } from "./profile";
import { sendReminderDigest, isReminderDigestEmpty, type ReminderDigest } from "./email";
import { logger } from "./logger";

type DbClient = NodePgDatabase<typeof schema>;
type Pool = typeof poolExport;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dueDate: string, today: string): number {
  return Math.round((new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000);
}

interface CommitBuckets {
  overdue: Commit[];
  dueToday: Commit[];
  dueTomorrow: Commit[];
}

function bucketByDueDate(openCommits: Commit[], today: string): CommitBuckets {
  const overdue: Commit[] = [];
  const dueToday: Commit[] = [];
  const dueTomorrow: Commit[] = [];
  for (const c of openCommits) {
    if (!c.dueDate) continue;
    const days = daysUntil(c.dueDate, today);
    if (days < 0) overdue.push(c);
    else if (days === 0) dueToday.push(c);
    else if (days === 1) dueTomorrow.push(c);
  }
  return { overdue, dueToday, dueTomorrow };
}

async function toDigest(dbClient: DbClient, buckets: CommitBuckets): Promise<ReminderDigest> {
  const all = [...buckets.overdue, ...buckets.dueToday, ...buckets.dueTomorrow];
  const whoByCommit = await resolveCommitWhoLabels(dbClient, all);
  const attach = (list: Commit[]) => list.map((commit) => ({ commit, who: whoByCommit.get(commit.id) ?? "someone" }));
  return { overdue: attach(buckets.overdue), dueToday: attach(buckets.dueToday), dueTomorrow: attach(buckets.dueTomorrow) };
}

// Always previews the current state — ignores the once-per-transition
// reminded markers, and never sets them, so it can't suppress tomorrow's
// real reminder for the same commitment.
export async function sendTestReminderDigest(dbClient: DbClient, userId: string, userEmail: string): Promise<ReminderDigest> {
  const today = todayUTC();
  const openCommits = await dbClient.select().from(commits)
    .where(and(eq(commits.userId, userId), eq(commits.done, false), eq(commits.deleted, false)));
  const digest = await toDigest(dbClient, bucketByDueDate(openCommits, today));
  await sendReminderDigest(userEmail, digest);
  return digest;
}

export interface ReminderScanResult {
  usersScanned: number;
  digestsSent: number;
  errors: number;
}

// Called by the secret-keyed /api/reminders/run endpoint, meant to be hit
// once a day by an external scheduler (the app has no persistent process to
// run this itself — see #75's resolution). "Today" is server UTC, not each
// user's local calendar day.
export async function runReminderScan(pool: Pool): Promise<ReminderScanResult> {
  const client = await pool.connect();
  let usersScanned = 0;
  let digestsSent = 0;
  let errors = 0;
  try {
    await client.query("SELECT set_config('app.bypass_rls', 'true', false)");
    const dbClient = drizzle(client, { schema });
    const today = todayUTC();

    const users = await dbClient.select({ id: usersTable.id, email: usersTable.email, profileData: profileTable.data })
      .from(usersTable)
      .leftJoin(profileTable, eq(profileTable.userId, usersTable.id));

    for (const u of users) {
      if (!u.email) continue;
      const remindersEnabled = !(isRecord(u.profileData) && u.profileData.remindersEnabled === false);
      if (!remindersEnabled) continue;
      usersScanned++;

      try {
        const openCommits = await dbClient.select().from(commits)
          .where(and(eq(commits.userId, u.id), eq(commits.done, false), eq(commits.deleted, false)));
        const buckets = bucketByDueDate(openCommits, today);
        const unreminded: CommitBuckets = {
          overdue: buckets.overdue.filter((c) => !c.remindedOverdueAt),
          dueToday: buckets.dueToday.filter((c) => !c.remindedDueAt),
          dueTomorrow: buckets.dueTomorrow.filter((c) => !c.remindedDueAt),
        };
        const digest = await toDigest(dbClient, unreminded);
        if (isReminderDigestEmpty(digest)) continue;

        await sendReminderDigest(u.email, digest);

        const now = new Date();
        const dueIds = [...unreminded.dueToday, ...unreminded.dueTomorrow].map((c) => c.id);
        const overdueIds = unreminded.overdue.map((c) => c.id);
        if (dueIds.length > 0) await dbClient.update(commits).set({ remindedDueAt: now }).where(inArray(commits.id, dueIds));
        if (overdueIds.length > 0) await dbClient.update(commits).set({ remindedOverdueAt: now }).where(inArray(commits.id, overdueIds));

        digestsSent++;
      } catch (err) {
        errors++;
        logger.error({ err, userId: u.id }, "Failed to send reminder digest");
      }
    }
  } finally {
    await client.query("RESET app.bypass_rls").catch(() => undefined);
    client.release();
  }

  return { usersScanned, digestsSent, errors };
}
