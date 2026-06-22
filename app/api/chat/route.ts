import { NextRequest, NextResponse } from 'next/server';
import { supabase, getChatMessages, getRecentJournalEntries, getTopTasks, saveChatMessage } from '@/lib/supabase';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY not set');
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

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    const today = new Date().toISOString().split('T')[0];

    // Get context: recent journal entries + open tasks + today's chat
    const [recentJournal, openTasks, todayChat] = await Promise.all([
      getRecentJournalEntries(3),
      getTopTasks(),
      getChatMessages(today),
    ]);

    // Build context string
    let context = '';
    if (recentJournal.length > 0) {
      context += '## Recent journal entries:\n';
      recentJournal.forEach((entry) => {
        if (entry.reflect) context += `- (${entry.date}) Reflect: ${entry.reflect}\n`;
        if (entry.commit_text) context += `- (${entry.date}) Commit: ${entry.commit_text}\n`;
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

    // Build messages for Claude
    const messages = [
      ...todayChat.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: ARLO_SYSTEM_PROMPT + (context ? `\n\n## Today's context:\n${context}` : ''),
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return NextResponse.json(
        { error: 'Failed to get response from Arlo' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const assistantMessage = data.content[0].text;

    // Save both messages to Supabase
    await Promise.all([
      saveChatMessage({
        role: 'user',
        content: message,
        date: today,
      }),
      saveChatMessage({
        role: 'assistant',
        content: assistantMessage,
        date: today,
      }),
    ]);

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
