import { NextResponse } from 'next/server';
import { getChatMessages } from '@/lib/supabase';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const messages = await getChatMessages(today);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }
}
