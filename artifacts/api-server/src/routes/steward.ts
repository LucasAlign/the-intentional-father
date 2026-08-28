import { Router, Request, Response } from "express";
import { db, withUserSession } from "@workspace/db";
import { journalEntries, chatMessages, tasks, taskCompletions, commits, jobs, comingUp, profile as profileTable, pulseChecks } from "@workspace/db";
import { eq, desc, asc, gte, lte, and, isNull, inArray, sql } from "drizzle-orm";
import { fetchGoogleCalendarEventsForUser, type CalendarEvent } from "./googleCalendar";
import { normalizeProfileData, isToneVoice, DEFAULT_TONE_VOICE, type ProfileData, type ToneVoice } from "../lib/profile";
import { aiRateLimit } from "../middlewares/aiRateLimit";
import { SCRIPTURE_GROUNDING, getVerseOfTheDay } from "../lib/verses";
import { computeCurrentPeriodStats, computeStreak, isSlipping, type RecurrencePeriod } from "../lib/priorityPeriods";
import { buildTodayContext } from "../lib/stewardContext";
import { isPulseCategory, isPulseState } from "../lib/pulseCheck";

const MAX_PULSE_NOTE_LENGTH = 500;

const router = Router();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const MAX_CHAT_MESSAGE_LENGTH = 4000;

type OpenAIResponsesApiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

function getOpenAIMessage(data: OpenAIResponsesApiResponse): string | undefined {
  if (data.output_text) return data.output_text;

  return data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => Boolean(text));
}

// Delivery only — the brother/Pastor-Joby-Martin identity and the "no
// flattery, no softening the truth" guideline above never change per tone.
const TONE_DELIVERY: Record<ToneVoice, string> = {
  straight_talk: "",
  middle_of_the_road: "Lead with a brief, genuine acknowledgment before the direct point — don't overdo it. Still point straight at the truth without sugarcoating; just less blunt in how you get there.",
  take_it_easy: "Invite reflection rather than confronting immediately, but don't take long to get to the truth — this isn't a license to stall. Honesty still outranks empathy; empathy has its place but never becomes flattery or avoidance.",
};

function buildStewardSystemPrompt(profileData: ProfileData | null, fallbackName: string): string {
  const name = profileData?.name || fallbackName || "friend";
  const season = profileData?.season_of_life ? `\nTheir season of life: ${profileData.season_of_life}.` : "";
  const topPriority = profileData?.core_identity?.top_priority
    ? `\nTheir #1 priority: ${profileData.core_identity.top_priority}.`
    : "";
  const values = profileData?.core_identity?.values?.length
    ? `\nWhat they value: ${profileData.core_identity.values.join(", ")}.`
    : "";
  const businesses = profileData?.businesses?.length
    ? `\nTheir work: ${profileData.businesses
        .map((b) => {
          const label = [b.name, b.role].filter(Boolean).join(" — ") || "a business they run";
          const blockers = b.common_blockers?.length ? ` — common blockers: ${b.common_blockers.join(", ")}` : "";
          const metrics = b.key_metrics?.length ? ` — tracks: ${b.key_metrics.join(", ")}` : "";
          return `${label}${blockers}${metrics}`;
        })
        .join("; ")}.`
    : "";
  const planning = profileData?.planning_profile
    ? [
        profileData.planning_profile.decision_drain
          ? `decisions drain them: ${profileData.planning_profile.decision_drain}`
          : null,
        profileData.planning_profile.common_failure_point
          ? `plans usually break down at: ${profileData.planning_profile.common_failure_point}`
          : null,
        profileData.planning_profile.ideal_rhythm
          ? `ideal rhythm: ${profileData.planning_profile.ideal_rhythm}`
          : null,
        profileData.planning_profile.where_ai_helps_most
          ? `where you help most: ${profileData.planning_profile.where_ai_helps_most}`
          : null,
      ]
        .filter(Boolean)
        .join("; ")
    : "";
  const planningBlock = planning ? `\nHow they plan: ${planning}.` : "";
  const relationships = profileData?.relationships?.length
    ? `\nKey relationships: ${profileData.relationships
        .map((r) => {
          const label = r.name || r.notes || r.type || "someone close to them";
          const commitment = r.commitments ? ` — committed to: ${r.commitments}` : "";
          const friction = r.biggest_challenge ? ` — friction: ${r.biggest_challenge}` : "";
          return `${label}${commitment}${friction}`;
        })
        .join("; ")}.`
    : "";
  const doNotSuggest = profileData?.guardrails?.do_not_suggest?.length
    ? `\nNever suggest: ${profileData.guardrails.do_not_suggest.join(", ")}.`
    : "";
  const alwaysRemind = profileData?.guardrails?.always_remind_of
    ? `\nAlways keep in view: ${profileData.guardrails.always_remind_of}.`
    : "";
  const tone: ToneVoice = isToneVoice(profileData?.voice) ? profileData.voice : DEFAULT_TONE_VOICE;
  const toneDelivery = TONE_DELIVERY[tone] ? `\nDelivery for this user (Straight Talk is the baseline; this adjusts pacing only, never the honesty): ${TONE_DELIVERY[tone]}` : "";

  return `You are Steward, a personal accountability partner and brother to ${name}. Your voice is direct, gospel-centered, in the style of Pastor Joby Martin.

${name}'s core challenge: they're a strong executor but get to the starting line without a full picture (budget, materials, time, contingencies). Reality hits and tasks stall at ~80%. Your job is to help them plan ahead of the work, with them.${season}${topPriority}${values}${businesses}${planningBlock}${relationships}

Guidelines:
- No flattery. No softening hard truths.
- Root things in Scripture where it fits naturally — not forced. Quote only from the approved verses below, verbatim.
- Cut through excuses with pointed questions.
- Warm but honest — a brother who loves them enough to tell the truth.
- Default to 1-3 short paragraphs. Be concise unless ${name} explicitly asks for depth or the situation warrants more.
- Prefer one clear next action or one pointed question over a long list.
- Use memory: call back to what they said before, name patterns, notice when a commitment hasn't moved.
- If an open task is marked stuck, or has sat open several days without being flagged, ask about it directly by name rather than letting it pass unmentioned.
- If a recurring priority is flagged slipping (its streak just broke), mention it directly when relevant — but only when it's genuinely notable, not as routine commentary on ordinary progress.
- Hold them accountable to commitments they've made to the people who matter most to them, by name where you know it — the same way you'd hold a brother to a promise.
- Encourage real relationships and real action, never foster dependence on the app.${doNotSuggest}${alwaysRemind}${toneDelivery}
- If ${name}'s current message clearly signals they want your delivery adjusted right now (e.g. "can you ease up" or "just give it to me straight"), say so in your reply, then end it with a tag on its own line: [SUGGEST_TONE:straight_talk], [SUGGEST_TONE:middle_of_the_road], or [SUGGEST_TONE:take_it_easy] — whichever they're asking for. Only include this tag when the signal is clear and it differs from their current setting; never include it as routine commentary.

You are a tool, not a pastor, counselor, or substitute for the people in their life.

${SCRIPTURE_GROUNDING}`;
}

// GET /api/verse
router.get('/verse', async (req: Request, res: Response) => {
  try {
    const [profileRow] = await db.select().from(profileTable).where(eq(profileTable.userId, req.user!.id)).limit(1);
    const profileData = normalizeProfileData(profileRow?.data ?? null);
    res.send(getVerseOfTheDay(profileData));
  } catch (err) {
    req.log?.error({ err }, 'Error fetching verse of the day');
    res.send(getVerseOfTheDay(null));
  }
});

// GET /api/tasks
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, req.user!.id), eq(tasks.done, false)))
      .orderBy(desc(tasks.createdAt))
      .limit(50);
    const todayKey = typeof req.query.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.today)
      ? req.query.today : new Date().toISOString().split('T')[0];
    const recurringIds = rows.filter(r => r.recurrencePeriod).map(r => r.id);
    let completedToday = new Set<number>();
    let slippingIds = new Set<number>();
    if (recurringIds.length > 0) {
      const comps = await db.select({ taskId: taskCompletions.taskId, completedDate: taskCompletions.completedDate })
        .from(taskCompletions).where(inArray(taskCompletions.taskId, recurringIds));
      const completionsByTask = new Map<number, string[]>();
      for (const c of comps) {
        if (c.completedDate === todayKey) completedToday.add(c.taskId);
        if (!completionsByTask.has(c.taskId)) completionsByTask.set(c.taskId, []);
        completionsByTask.get(c.taskId)!.push(c.completedDate);
      }
      for (const r of rows) {
        if (!r.recurrencePeriod) continue;
        const createdKey = r.createdAt.toISOString().split('T')[0];
        const completions = completionsByTask.get(r.id) ?? [];
        if (isSlipping(r.recurrencePeriod as RecurrencePeriod, r.recurrenceTarget ?? 1, completions, todayKey, createdKey)) {
          slippingIds.add(r.id);
        }
      }
    }
    res.json(rows.map(r => ({ ...r, completedToday: completedToday.has(r.id), slipping: slippingIds.has(r.id) })));
  } catch (err) {
    req.log?.error({ err }, 'Error fetching tasks');
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/completed
router.get('/tasks/completed', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.id;
    const [items, [{ count: openCount }]] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.userId, uid), eq(tasks.done, true), isNull(tasks.recurrencePeriod)))
        .orderBy(desc(tasks.doneAt)).limit(200),
      db.select({ count: sql<number>`count(*)::int` }).from(tasks)
        .where(and(eq(tasks.userId, uid), eq(tasks.done, false), isNull(tasks.recurrencePeriod))),
    ]);
    const doneCount = items.length;
    const total = doneCount + Number(openCount);
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    res.json({ items, doneCount, totalCount: total, pct });
  } catch (err) {
    req.log?.error({ err }, 'Error fetching completed tasks');
    res.status(500).json({ error: 'Failed to fetch completed tasks' });
  }
});

// POST /api/tasks
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { text, category, notes } = req.body;
    if (!text?.trim()) {
      res.status(400).json({ error: 'Task text is required' });
      return;
    }
    const [row] = await db
      .insert(tasks)
      .values({ userId: req.user!.id, text: text.trim(), category: category?.trim() || '', notes: notes?.trim() || '', partial: false, done: false })
      .returning();
    res.json(row);
  } catch (err) {
    req.log?.error({ err }, 'Error creating task');
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /api/tasks/:id
router.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }
    const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, req.user!.id))).limit(1);
    if (!existing) { res.status(404).json({ error: 'Task not found' }); return; }
    const { done, partial, notes, recurrencePeriod, recurrenceTarget } = req.body;
    const updates: Partial<{ done: boolean; doneAt: Date | null; partial: boolean; notes: string;
      recurrencePeriod: string | null; recurrenceTarget: number | null }> = {};

    if (recurrencePeriod !== undefined) {
      if (recurrencePeriod === null) {
        updates.recurrencePeriod = null;
        updates.recurrenceTarget = null;
      } else if (['daily', 'weekly', 'monthly'].includes(recurrencePeriod)) {
        const target = Number.isInteger(recurrenceTarget) && recurrenceTarget > 0 ? recurrenceTarget : 1;
        updates.recurrencePeriod = recurrencePeriod;
        updates.recurrenceTarget = recurrencePeriod === 'daily' ? 1 : target;
      } else {
        res.status(400).json({ error: 'Invalid recurrencePeriod' });
        return;
      }
    }
    const stillRecurring = recurrencePeriod !== undefined ? recurrencePeriod !== null : Boolean(existing.recurrencePeriod);
    if (typeof done === 'boolean') {
      if (done === true && stillRecurring) {
        res.status(400).json({ error: 'Recurring priorities cannot be marked fully done — remove recurrence first, or log a completion for today.' });
        return;
      }
      updates.done = done;
      updates.doneAt = done ? new Date() : null;
    }
    if (typeof partial === 'boolean') {
      if (partial === true && stillRecurring) {
        res.status(400).json({ error: 'Recurring priorities use an automatic slipping signal instead of manual stuck — remove recurrence first if you need this.' });
        return;
      }
      updates.partial = partial;
    }
    if (typeof notes === 'string') updates.notes = notes;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    await db.update(tasks).set(updates).where(and(eq(tasks.id, id), eq(tasks.userId, req.user!.id)));
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, 'Error updating task');
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, req.user!.id)));
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, 'Error deleting task');
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/tasks/:id/complete
router.post('/tasks/:id/complete', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }
    const { date } = req.body;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
      return;
    }
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, req.user!.id))).limit(1);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    if (!task.recurrencePeriod) { res.status(400).json({ error: 'Task is not recurring' }); return; }
    const inserted = await db.insert(taskCompletions)
      .values({ userId: req.user!.id, taskId: id, completedDate: date })
      .onConflictDoNothing({ target: [taskCompletions.taskId, taskCompletions.completedDate] })
      .returning();
    res.json({ success: true, alreadyCompleted: inserted.length === 0 });
  } catch (err) {
    req.log?.error({ err }, 'Error logging task completion');
    res.status(500).json({ error: 'Failed to log completion' });
  }
});

// GET /api/tasks/:id/history
router.get('/tasks/:id/history', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, req.user!.id))).limit(1);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    const rows = await db.select({ completedDate: taskCompletions.completedDate }).from(taskCompletions)
      .where(and(eq(taskCompletions.taskId, id), eq(taskCompletions.userId, req.user!.id)))
      .orderBy(desc(taskCompletions.completedDate));
    const completions = rows.map(r => r.completedDate);
    const todayKey = typeof req.query.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.today)
      ? req.query.today : new Date().toISOString().split('T')[0];

    let streak = 0;
    let currentPeriod: { key: string; completedCount: number; target: number; pct: number } | null = null;
    let slipping = false;
    const completedToday = completions.includes(todayKey);
    if (task.recurrencePeriod) {
      const period = task.recurrencePeriod as RecurrencePeriod;
      const target = task.recurrenceTarget ?? 1;
      const createdKey = task.createdAt.toISOString().split('T')[0];
      currentPeriod = computeCurrentPeriodStats(period, target, completions, todayKey);
      streak = computeStreak(period, target, completions, todayKey, createdKey);
      slipping = isSlipping(period, target, completions, todayKey, createdKey);
    }
    res.json({ task, completions, streak, currentPeriod, completedToday, slipping });
  } catch (err) {
    req.log?.error({ err }, 'Error fetching task history');
    res.status(500).json({ error: 'Failed to fetch task history' });
  }
});

// GET /api/chat-history
router.get('/chat-history', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, req.user!.id), eq(chatMessages.date, today)))
      .orderBy(asc(chatMessages.createdAt));
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, 'Error fetching chat history');
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// GET /api/journal
router.get('/journal', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.select().from(journalEntries).where(and(eq(journalEntries.userId, req.user!.id), eq(journalEntries.date, today))).limit(1);
    res.json(rows[0] || null);
  } catch (err) {
    req.log?.error({ err }, 'Error fetching journal entry');
    res.status(500).json({ error: 'Failed to fetch journal entry' });
  }
});

// POST /api/journal
router.post('/journal', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { reflect, commit_text } = req.body;
    await db
      .insert(journalEntries)
      .values({ userId: req.user!.id, date: today, reflect: reflect || '', commitText: commit_text || '' })
      .onConflictDoUpdate({
        target: [journalEntries.userId, journalEntries.date],
        set: { reflect: reflect || '', commitText: commit_text || '' },
      });
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, 'Error saving journal entry');
    res.status(500).json({ error: 'Failed to save journal entry' });
  }
});

// GET /api/pulse-checks?date=YYYY-MM-DD
router.get('/pulse-checks', async (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : new Date().toISOString().split('T')[0];
    const rows = await db.select().from(pulseChecks).where(and(eq(pulseChecks.userId, req.user!.id), eq(pulseChecks.date, date)));
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, 'Error fetching pulse checks');
    res.status(500).json({ error: 'Failed to fetch pulse checks' });
  }
});

// POST /api/pulse-checks
router.post('/pulse-checks', async (req: Request, res: Response) => {
  try {
    const { date, category, state, note } = req.body;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
      return;
    }
    if (!isPulseCategory(category)) { res.status(400).json({ error: 'Invalid category' }); return; }
    if (!isPulseState(state)) { res.status(400).json({ error: 'Invalid state' }); return; }
    const cleanNote = typeof note === 'string' ? note.slice(0, MAX_PULSE_NOTE_LENGTH) : '';
    await db.insert(pulseChecks)
      .values({ userId: req.user!.id, date, category, state, note: cleanNote })
      .onConflictDoUpdate({
        target: [pulseChecks.userId, pulseChecks.date, pulseChecks.category],
        set: { state, note: cleanNote },
      });
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, 'Error saving pulse check');
    res.status(500).json({ error: 'Failed to save pulse check' });
  }
});

// GET /api/commits
router.get('/commits', async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(commits).where(eq(commits.userId, req.user!.id)).orderBy(desc(commits.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commits' });
  }
});

// POST /api/commits
router.post('/commits', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) { res.status(400).json({ error: 'Commit text is required' }); return; }
    const madeDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const [row] = await db.insert(commits).values({ userId: req.user!.id, text: text.trim(), madeDate, done: false }).returning();
    res.json(row);
  } catch (err) {
    req.log?.error({ err }, 'Error creating commit');
    res.status(500).json({ error: 'Failed to create commit' });
  }
});

// PATCH /api/commits/:id
router.patch('/commits/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    const { done } = req.body;
    if (typeof done === 'boolean') await db.update(commits).set({ done }).where(and(eq(commits.id, id), eq(commits.userId, req.user!.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update commit' });
  }
});

// DELETE /api/commits/:id
router.delete('/commits/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    await db.delete(commits).where(and(eq(commits.id, id), eq(commits.userId, req.user!.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete commit' });
  }
});

// GET /api/jobs
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(jobs).where(eq(jobs.userId, req.user!.id)).orderBy(asc(jobs.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// POST /api/jobs
router.post('/jobs', async (req: Request, res: Response) => {
  try {
    const { biz, name, stage, due, pct } = req.body;
    if (!biz || !name) { res.status(400).json({ error: 'biz and name are required' }); return; }
    const [row] = await db.insert(jobs).values({ userId: req.user!.id, biz, name, stage: stage || '', due: due || '', pct: pct ?? 0 }).returning();
    res.json(row);
  } catch (err) {
    req.log?.error({ err }, 'Error creating job');
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// PATCH /api/jobs/:id
router.patch('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    const { biz, name, stage, due, pct } = req.body;
    const updates: Partial<{ biz: string; name: string; stage: string; due: string; pct: number }> = {};
    if (biz !== undefined) updates.biz = biz;
    if (name !== undefined) updates.name = name;
    if (stage !== undefined) updates.stage = stage;
    if (due !== undefined) updates.due = due;
    if (typeof pct === 'number') updates.pct = pct;
    if (Object.keys(updates).length > 0) await db.update(jobs).set(updates).where(and(eq(jobs.id, id), eq(jobs.userId, req.user!.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// DELETE /api/jobs/:id
router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, req.user!.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// GET /api/coming-up  (optional ?start=YYYY-MM-DD&end=YYYY-MM-DD for a date range)
router.get('/coming-up', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    let rows;
    let rangeStart: string;
    let rangeEnd: string;
    if (typeof start === 'string' && typeof end === 'string') {
      rangeStart = start;
      rangeEnd = end;
      rows = await db
        .select()
        .from(comingUp)
        .where(and(eq(comingUp.userId, req.user!.id), gte(comingUp.date, start), lte(comingUp.date, end)))
        .orderBy(asc(comingUp.date), asc(comingUp.createdAt));
    } else {
      const today = new Date().toISOString().split('T')[0];
      rangeStart = today;
      rangeEnd = today;
      rows = await db.select().from(comingUp).where(and(eq(comingUp.userId, req.user!.id), eq(comingUp.date, today))).orderBy(asc(comingUp.createdAt));
    }
    let calendarRows: CalendarEvent[] = [];
    try {
      calendarRows = await fetchGoogleCalendarEventsForUser(req.user!.id, rangeStart, rangeEnd);
    } catch (err) {
      req.log?.warn({ err }, 'Failed to merge Google Calendar events');
    }
    res.json([...rows, ...calendarRows].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coming up' });
  }
});

// POST /api/coming-up  (optional date in body, defaults to today)
router.post('/coming-up', async (req: Request, res: Response) => {
  try {
    const { time, title, sub, tag, kind, date } = req.body;
    if (!time || !title) { res.status(400).json({ error: 'time and title are required' }); return; }
    const day = (typeof date === 'string' && date) || new Date().toISOString().split('T')[0];
    const [row] = await db.insert(comingUp).values({ userId: req.user!.id, date: day, time, title, sub: sub || '', tag: tag || '', kind: kind || 'work' }).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create coming up event' });
  }
});

// DELETE /api/coming-up/:id
router.delete('/coming-up/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    await db.delete(comingUp).where(and(eq(comingUp.id, id), eq(comingUp.userId, req.user!.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete coming up event' });
  }
});

// POST /api/chat
router.post('/chat', aiRateLimit, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Message must be under ${MAX_CHAT_MESSAGE_LENGTH} characters` });
      return;
    }
    const userId = req.user!.id;
    const today = new Date().toISOString().split('T')[0];

    const [context, todayChat, profileRow] = await Promise.all([
      buildTodayContext(userId, today),
      db.select().from(chatMessages).where(and(eq(chatMessages.userId, userId), eq(chatMessages.date, today))).orderBy(asc(chatMessages.createdAt)),
      db.select().from(profileTable).where(eq(profileTable.userId, userId)).limit(1),
    ]);

    const profileData = normalizeProfileData(profileRow[0]?.data ?? null);
    const STEWARD_SYSTEM_PROMPT = buildStewardSystemPrompt(profileData, req.user!.firstName ?? "");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
      return;
    }

    const apiMessages = [
      ...todayChat.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Commit the ambient per-request DB session before the slow OpenAI call
    // rather than holding a pooled connection idle-in-transaction for it —
    // the writes below open their own short-lived session instead.
    await req.dbSession?.commit();

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: STEWARD_SYSTEM_PROMPT + (context ? `\n\n## Today's context:\n${context}` : ''),
        input: apiMessages,
        max_output_tokens: 350,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      req.log?.error({ error, model: OPENAI_MODEL }, 'OpenAI API error');
      res.status(500).json({ error: 'Failed to get response from Steward', detail: error, model: OPENAI_MODEL });
      return;
    }

    const data = await response.json() as OpenAIResponsesApiResponse;
    const assistantMessage = getOpenAIMessage(data);

    if (!assistantMessage) {
      req.log?.error({ data, model: OPENAI_MODEL }, 'OpenAI response missing assistant message');
      res.status(500).json({ error: 'Failed to get response from Steward' });
      return;
    }

    // Strip the [SUGGEST_TONE:...] tag before saving/returning — it must not
    // leak into stored history or future context, and the chip it drives is
    // relevant only to this turn.
    const currentTone = profileData?.voice ?? DEFAULT_TONE_VOICE;
    const toneMatch = assistantMessage.match(/\[SUGGEST_TONE:(straight_talk|middle_of_the_road|take_it_easy)\]\s*$/);
    const suggestTone = toneMatch && toneMatch[1] !== currentTone ? (toneMatch[1] as ToneVoice) : null;
    const cleanMessage = toneMatch ? assistantMessage.slice(0, toneMatch.index).trimEnd() : assistantMessage;

    await withUserSession(userId, () =>
      Promise.all([
        db.insert(chatMessages).values({ userId, role: 'user', content: message, date: today }),
        db.insert(chatMessages).values({ userId, role: 'assistant', content: cleanMessage, date: today }),
      ]),
    );

    res.json({ message: cleanMessage, suggestTone });
  } catch (err) {
    req.log?.error({ err }, 'Chat error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
