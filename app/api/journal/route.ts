import { NextRequest, NextResponse } from 'next/server';
import { getTodayEntry, saveTodayEntry } from '@/lib/supabase';

export async function GET() {
  try {
    const entry = await getTodayEntry();
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entry' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    await saveTodayEntry(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving journal entry:', error);
    return NextResponse.json({ error: 'Failed to save journal entry' }, { status: 500 });
  }
}
