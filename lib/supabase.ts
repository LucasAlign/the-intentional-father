import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getVerseOfTheDay(): Promise<string> {
  const verses = [
    'Ephesians 5:25 — Husbands, love your wives, just as Christ loved the church and gave himself up for her.',
    'Proverbs 29:25 — Fear of man will prove to be a snare, but whoever trusts in the Lord is kept safe.',
    'Philippians 4:8 — Finally, brothers and sisters, whatever is true, whatever is noble, whatever is right, whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or praiseworthy—think about such things.',
    'Colossians 3:17 — And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.',
    'Proverbs 27:12 — The prudent see danger and take refuge, but the simple keep going and pay the penalty.',
    'Proverbs 6:6-8 — Go to the ant, you sluggard; consider its ways and be wise! It has no commander, no overseer or ruler, yet it stores its provisions in summer and gathers its food at harvest.',
  ];

  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return verses[dayOfYear % verses.length];
}

export async function getTodayEntry() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function saveTodayEntry(data: {
  reflect?: string;
  commit_text?: string;
}) {
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('journal_entries')
    .upsert({
      date: today,
      reflect: data.reflect || '',
      commit_text: data.commit_text || '',
    }, { onConflict: 'date' });

  if (error) throw error;
}

export async function getTopTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('done', false)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) throw error;
  return data || [];
}

export async function getRecentJournalEntries(limit = 5) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getChatMessages(date: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('date', date)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveChatMessage(message: {
  role: 'user' | 'assistant';
  content: string;
  date: string;
}) {
  const { error } = await supabase
    .from('chat_messages')
    .insert(message);

  if (error) throw error;
}
