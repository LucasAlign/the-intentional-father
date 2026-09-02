import { and, desc, eq, inArray } from "drizzle-orm";
import { db, journalEntries, tasks, taskCompletions, pulseChecks } from "@workspace/db";
import { isSlipping, type RecurrencePeriod } from "./priorityPeriods";
import { PULSE_STATE_LABEL, type PulseState } from "./pulseCheck";

// Single source of the "what's going on with this person today" text block
// the AI reads. Extracted out of the /chat route so it's one well-defined
// thing rather than logic embedded in a handler — /chat is the only caller
// today (see #12/#22's resolution: interview.ts isn't wired in yet, and
// relationships context is dropped until #13 ships real data).
export async function buildTodayContext(userId: string, today: string): Promise<string> {
  const [recentJournal, openTasks, todayPulse] = await Promise.all([
    db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(desc(journalEntries.date)).limit(3),
    db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.done, false), eq(tasks.deleted, false))).orderBy(desc(tasks.createdAt)).limit(5),
    db.select().from(pulseChecks).where(and(eq(pulseChecks.userId, userId), eq(pulseChecks.date, today))),
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

  return context;
}
