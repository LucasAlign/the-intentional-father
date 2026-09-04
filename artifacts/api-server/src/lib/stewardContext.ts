import { and, desc, eq, inArray } from "drizzle-orm";
import { db, journalEntries, tasks, taskCompletions, pulseChecks, commits, commitRelationshipTargets, relationships, type Relationship } from "@workspace/db";
import { isSlipping, type RecurrencePeriod } from "./priorityPeriods";
import { PULSE_STATE_LABEL, type PulseState } from "./pulseCheck";

const RELATIONSHIP_CATEGORY_LABEL: Record<string, string> = { spouse: "Spouse", child: "Child", family: "Family", friend: "Friend", other: "Other" };
function relationshipLabel(r: Pick<Relationship, "name" | "type" | "category">): string {
  return r.name || r.type || RELATIONSHIP_CATEGORY_LABEL[r.category] || r.category;
}

// Single source of the "what's going on with this person today" text block
// the AI reads. Extracted out of the /chat route so it's one well-defined
// thing rather than logic embedded in a handler — /chat is the only caller
// today (see #12/#22's resolution: interview.ts isn't wired in yet, and
// relationships context is dropped until #13 ships real data).
export async function buildTodayContext(userId: string, today: string): Promise<string> {
  const [recentJournal, openTasks, todayPulse, openCommits] = await Promise.all([
    db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(desc(journalEntries.date)).limit(3),
    db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.done, false), eq(tasks.deleted, false))).orderBy(desc(tasks.createdAt)).limit(5),
    db.select().from(pulseChecks).where(and(eq(pulseChecks.userId, userId), eq(pulseChecks.date, today))),
    db.select().from(commits).where(and(eq(commits.userId, userId), eq(commits.done, false), eq(commits.deleted, false))).orderBy(desc(commits.createdAt)).limit(5),
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

  if (openCommits.length > 0) {
    // #72 — a commitment can name 1+ Tribe people via the join table now,
    // not just the old single relationshipId (which new/edited commits no
    // longer write to). Batch-fetch targets the same way the API routes do.
    const targets = await db.select({ commitId: commitRelationshipTargets.commitId, relationshipId: commitRelationshipTargets.relationshipId })
      .from(commitRelationshipTargets)
      .where(inArray(commitRelationshipTargets.commitId, openCommits.map((c) => c.id)));
    const relIdsByCommit = new Map<number, number[]>();
    for (const t of targets) {
      const list = relIdsByCommit.get(t.commitId);
      if (list) list.push(t.relationshipId);
      else relIdsByCommit.set(t.commitId, [t.relationshipId]);
    }
    const allRelIds = [...new Set(targets.map((t) => t.relationshipId))];
    const rels = allRelIds.length > 0 ? await db.select().from(relationships).where(inArray(relationships.id, allRelIds)) : [];
    const relById = new Map(rels.map((r) => [r.id, r]));

    context += '## Commitments made to others:\n';
    openCommits.forEach((c) => {
      const names = (relIdsByCommit.get(c.id) ?? []).map((id) => relById.get(id)).filter((r): r is Relationship => Boolean(r)).map(relationshipLabel);
      const who = names.length > 0 ? names.join(', ') : c.adHocName ? `${c.adHocName} (${RELATIONSHIP_CATEGORY_LABEL[c.adHocCategory ?? ''] ?? c.adHocCategory})` : 'someone';

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
