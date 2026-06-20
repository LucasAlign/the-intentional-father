import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { journalEntries, chatMessages, tasks } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";

const router = Router();

const VERSES = [
  'Ephesians 5:25 — Husbands, love your wives, just as Christ loved the church and gave himself up for her.',
  'Proverbs 29:25 — Fear of man will prove to be a snare, but whoever trusts in the Lord is kept safe.',
  'Philippians 4:8 — Finally, brothers and sisters, whatever is true, whatever is noble, whatever is right, whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or praiseworthy—think about such things.',
  'Colossians 3:17 — And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.',
  'Proverbs 27:12 — The prudent see danger and take refuge, but the simple keep going and pay the penalty.',
  'Proverbs 6:6-8 — Go to the ant, you sluggard; consider its ways and be wise! It has no commander, no overseer or ruler, yet it stores its provisions in summer and gathers its food at harvest.',
];

function getVerseOfTheDay(): string {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return VERSES[dayOfYear % VERSES.length];
}

// GET /api/verse
router.get('/verse', (_req: Request, res: Response) => {
  res.send(getVerseOfTheDay());
});

// GET /api/tasks
router.get('/tasks', async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.done, false))
      .orderBy(desc(tasks.createdAt))
      .limit(3);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/chat-history
router.get('/chat-history', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.date, today))
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
    const rows = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.date, today))
      .limit(1);
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
      .values({ date: today, reflect: reflect || '', commitText: commit_text || '' })
      .onConflictDoUpdate({
        target: journalEntries.date,
        set: { reflect: reflect || '', commitText: commit_text || '' },
      });
    res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, 'Error saving journal entry');
    res.status(500).json({ error: 'Failed to save journal entry' });
  }
});

// POST /api/chat
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const [recentJournal, openTasks, todayChat] = await Promise.all([
      db.select().from(journalEntries).orderBy(desc(journalEntries.date)).limit(3),
      db.select().from(tasks).where(eq(tasks.done, false)).orderBy(desc(tasks.createdAt)).limit(5),
      db.select().from(chatMessages).where(eq(chatMessages.date, today)).orderBy(asc(chatMessages.createdAt)),
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
      context += '## Open tasks:\n';
      openTasks.forEach((task) => {
        const status = task.partial ? '[STUCK AT 80%]' : '';
        context += `- ${task.text} (${task.category}) ${status}\n`;
      });
      context += '\n';
    }

    const ARLO_SYSTEM_PROMPT = `You are Arlo, a personal accountability partner and brother to Bryant. Your voice is direct, gospel-centered, in the style of Pastor Joby Martin.

Bryant's core challenge: he's a strong executor but gets to the starting line without a full picture (budget, materials, time, contingencies). Reality hits and tasks stall at ~80%. Your job is to help him plan ahead of the work, with him.

Guidelines:
- No flattery. No softening hard truths.
- Root things in Scripture. Hold him to Ephesians 5:25 — love his wife as Christ loved the church, sacrificially, without keeping score.
- Cut through excuses with pointed questions.
- Warm but honest — a brother who loves him enough to tell the truth.
- Conversational, not sermon-length.
- Use memory: call back to what he said before, name patterns, notice when a commitment hasn't moved.
- Encourage real relationships and real action, never foster dependence on the app.

You are a tool, not a pastor or counselor or substitute for his wife.`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
      return;
    }

    const apiMessages = [
      ...todayChat.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: ARLO_SYSTEM_PROMPT + (context ? `\n\n## Today's context:\n${context}` : ''),
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      req.log?.error({ error }, 'Anthropic API error');
      res.status(500).json({ error: 'Failed to get response from Arlo' });
      return;
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    const assistantMessage = data.content[0].text;

    await Promise.all([
      db.insert(chatMessages).values({ role: 'user', content: message, date: today }),
      db.insert(chatMessages).values({ role: 'assistant', content: assistantMessage, date: today }),
    ]);

    res.json({ message: assistantMessage });
  } catch (err) {
    req.log?.error({ err }, 'Chat error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
