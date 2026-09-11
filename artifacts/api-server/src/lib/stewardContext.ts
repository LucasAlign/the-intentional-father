import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, journalEntries, tasks, taskCompletions, pulseChecks, commits, commitRelationshipTargets, relationships, type Relationship, sphereChecks } from "@workspace/db";
import { isSlipping, type RecurrencePeriod } from "./priorityPeriods";
import { PULSE_STATE_LABEL, type PulseState } from "./pulseCheck";
import { SPHERE_CATEGORIES, SPHERE_CATEGORY_LABEL, SPHERE_STATE_LABEL, getWeekStart, summarizeFlaggedSphereAnswers, type SphereCategory, type SphereState } from "./sphere";

export const RELATIONSHIP_CATEGORY_LABEL: Record<string, string> = { spouse: "Spouse", child: "Child", family: "Family", friend: "Friend", other: "Other" };
function relationshipLabel(r: Pick<Relationship, "name" | "type" | "category">): string {
  return r.name || r.type || RELATIONSHIP_CATEGORY_LABEL[r.category] || r.category;
}

type DbLike = typeof db;

// Batch-resolves the "who" display string for a set of commits — 1+ Tribe
// people via commitRelationshipTargets (#72), or the ad-hoc one-time
// name+category fallback. Shared by buildTodayContext below and by the
// reminder digest (#75, lib/reminders.ts) so the two don't drift on how a
// commitment's target gets displayed.
export async function resolveCommitWhoLabels(
  dbClient: DbLike,
  userCommits: { id: number; adHocName: string | null; adHocCategory: string | null }[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (userCommits.length === 0) return result;

  const targets = await dbClient.select({ commitId: commitRelationshipTargets.commitId, relationshipId: commitRelationshipTargets.relationshipId })
    .from(commitRelationshipTargets)
    .where(inArray(commitRelationshipTargets.commitId, userCommits.map((c) => c.id)));
  const relIdsByCommit = new Map<number, number[]>();
  for (const t of targets) {
    const list = relIdsByCommit.get(t.commitId);
    if (list) list.push(t.relationshipId);
    else relIdsByCommit.set(t.commitId, [t.relationshipId]);
  }
  const allRelIds = [...new Set(targets.map((t) => t.relationshipId))];
  const rels = allRelIds.length > 0 ? await dbClient.select().from(relationships).where(inArray(relationships.id, allRelIds)) : [];
  const relById = new Map(rels.map((r) => [r.id, r]));

  for (const c of userCommits) {
    const names = (relIdsByCommit.get(c.id) ?? []).map((id) => relById.get(id)).filter((r): r is Relationship => Boolean(r)).map(relationshipLabel);
    const who = names.length > 0 ? names.join(', ') : c.adHocName ? `${c.adHocName} (${RELATIONSHIP_CATEGORY_LABEL[c.adHocCategory ?? ''] ?? c.adHocCategory})` : 'someone';
    result.set(c.id, who);
  }
  return result;
}

// Single source of the "what's going on with this person today" text block
// the AI reads. Extracted out of the /chat route so it's one well-defined
// thing rather than logic embedded in a handler — /chat is the only caller
// today (see #12/#22's resolution: interview.ts isn't wired in yet, and
// relationships context is dropped until #13 ships real data).
export async function buildTodayContext(userId: string, today: string): Promise<string> {
  const currentWeekStart = getWeekStart(new Date(today));
  // 5 completed weeks strictly before this one, for a short trend line —
  // separate from thisWeekSphere below so "this week" (with notes) never
  // duplicates into the trend, and vice versa.
  const SPHERE_TREND_WEEKS = 5;
  const earliestTrendDate = new Date(currentWeekStart);
  earliestTrendDate.setUTCDate(earliestTrendDate.getUTCDate() - SPHERE_TREND_WEEKS * 7);
  const earliestTrendWeekStart = getWeekStart(earliestTrendDate);

  const [recentJournal, openTasks, todayPulse, openCommits, thisWeekSphere, priorSphereWeeks] = await Promise.all([
    db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(desc(journalEntries.date)).limit(3),
    db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.done, false), eq(tasks.deleted, false))).orderBy(desc(tasks.createdAt)).limit(5),
    db.select().from(pulseChecks).where(and(eq(pulseChecks.userId, userId), eq(pulseChecks.date, today))),
    db.select().from(commits).where(and(eq(commits.userId, userId), eq(commits.done, false), eq(commits.deleted, false))).orderBy(desc(commits.createdAt)).limit(5),
    db.select().from(sphereChecks).where(and(eq(sphereChecks.userId, userId), eq(sphereChecks.weekStart, currentWeekStart))),
    db.select().from(sphereChecks).where(and(
      eq(sphereChecks.userId, userId),
      gte(sphereChecks.weekStart, earliestTrendWeekStart),
      lt(sphereChecks.weekStart, currentWeekStart),
    )),
  ]);

  let context = '';
  if (recentJournal.length > 0) {
    context += '## Recent journal entries:\n';
    recentJournal.forEach((entry) => {
      if (entry.reflect) context += `- (${entry.date}) Reflect: ${entry.reflect}\n`;
      if (entry.commitText) context += `- (${entry.date}) Commit: ${entry.commitText}\n`;
    });
    context += '\n';
  }

  if (openTasks.length > 0) {
    const recurringOpenIds = openTasks.filter((t) => t.recurrencePeriod).map((t) => t.id);
    const completionsByTask = new Map<number, string[]>();
    if (recurringOpenIds.length > 0) {
      const comps = await db.select({ taskId: taskCompletions.taskId, completedDate: taskCompletions.completedDate })
        .from(taskCompletions).where(inArray(taskCompletions.taskId, recurringOpenIds));
      for (const c of comps) {
        if (!completionsByTask.has(c.taskId)) completionsByTask.set(c.taskId, []);
        completionsByTask.get(c.taskId)!.push(c.completedDate);
      }
    }
    context += '## Open tasks:\n';
    openTasks.forEach((task) => {
      let status = '';
      if (task.recurrencePeriod) {
        const createdKey = task.createdAt.toISOString().split('T')[0];
        const completions = completionsByTask.get(task.id) ?? [];
        if (isSlipping(task.recurrencePeriod as RecurrencePeriod, task.recurrenceTarget ?? 1, completions, today, createdKey)) {
          status = '[SLIPPING — streak broke]';
        }
      } else {
        const daysOpen = Math.floor((Date.now() - task.createdAt.getTime()) / 86400000);
        status = task.partial ? '[STUCK — they flagged this]' : daysOpen >= 3 ? `[OPEN ${daysOpen} DAYS, not yet flagged stuck]` : '';
      }
      const note = task.notes ? ` — note: "${task.notes.slice(0, 150)}"` : '';
      context += `- ${task.text} (${task.category})${status ? ' ' + status : ''}${note}\n`;
    });
    context += '\n';
  }

  if (todayPulse.length > 0) {
    context += "## Today's Pulse Check:\n";
    todayPulse.forEach((p) => {
      const note = p.note ? ` — note: "${p.note.slice(0, 150)}"` : '';
      context += `- ${p.category}: ${PULSE_STATE_LABEL[p.state as PulseState] ?? p.state}${note}\n`;
    });
    context += '\n';
  }

  if (thisWeekSphere.length > 0) {
    context += "## This week's Sphere check-in:\n";
    thisWeekSphere.forEach((s) => {
      const note = s.note ? ` — note: "${s.note.slice(0, 150)}"` : '';
      context += `- ${SPHERE_CATEGORY_LABEL[s.category as SphereCategory] ?? s.category}: ${SPHERE_STATE_LABEL[s.state as SphereState] ?? s.state}${note}\n`;
      // Itemized "Walk through this" answers, when they used it — only the
      // ones worth flagging (not a clean up/agree) and only their own
      // words, never the canned follow-up prompt text.
      summarizeFlaggedSphereAnswers(s.category as SphereCategory, s.answers).forEach((line) => {
        context += `  ↳ ${line}\n`;
      });
    });
    context += '\n';
  }

  if (priorSphereWeeks.length > 0) {
    // Compact state-only trend (no notes — those would bloat the prompt
    // fast) so the model can notice a pattern building or breaking over
    // time, not just react to a single week in isolation. Oldest first;
    // "this week" (above) is deliberately the next point after this.
    const byCategory = new Map<string, Map<string, SphereState>>();
    for (const s of priorSphereWeeks) {
      if (!byCategory.has(s.category)) byCategory.set(s.category, new Map());
      byCategory.get(s.category)!.set(s.weekStart, s.state as SphereState);
    }
    const trendLines: string[] = [];
    for (const category of SPHERE_CATEGORIES) {
      const weekMap = byCategory.get(category);
      if (!weekMap || weekMap.size === 0) continue;
      const sequence = [...weekMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, state]) => SPHERE_STATE_LABEL[state] ?? state);
      trendLines.push(`- ${SPHERE_CATEGORY_LABEL[category]}: ${sequence.join(' → ')}`);
    }
    if (trendLines.length > 0) {
      context += `## Sphere trend (up to ${SPHERE_TREND_WEEKS} prior weeks, oldest → newest, leading into this week above):\n${trendLines.join('\n')}\n\n`;
    }
  }

  if (openCommits.length > 0) {
    // #72 — a commitment can name 1+ Tribe people via the join table now,
    // not just the old single relationshipId (which new/edited commits no
    // longer write to).
    const whoByCommit = await resolveCommitWhoLabels(db, openCommits);

    context += '## Commitments made to others:\n';
    openCommits.forEach((c) => {
      const who = whoByCommit.get(c.id) ?? 'someone';

      let status = '';
      if (c.dueDate) {
        const dueInDays = Math.round((new Date(c.dueDate).getTime() - new Date(today).getTime()) / 86400000);
        if (dueInDays < 0) status = `[OVERDUE — was due ${c.dueDate}]`;
        else if (dueInDays <= 3) status = `[DUE SOON — ${c.dueDate}]`;
      } else {
        const daysOld = Math.floor((Date.now() - c.createdAt.getTime()) / 86400000);
        if (daysOld >= 7) status = `[NO DUE DATE — LOGGED ${daysOld} DAYS AGO]`;
      }
      const note = c.notes ? ` — note: "${c.notes.slice(0, 150)}"` : '';
      context += `- To ${who}: ${c.text} (said ${c.madeDate})${status ? ' ' + status : ''}${note}\n`;
    });
    context += '\n';
  }

  return context;
}
