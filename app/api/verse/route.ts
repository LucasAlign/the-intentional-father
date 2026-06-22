import { NextResponse } from 'next/server';
import { getVerseOfTheDay } from '@/lib/supabase';

// Recompute per request so the verse rotates daily instead of freezing at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const verse = await getVerseOfTheDay();
    return new NextResponse(verse);
  } catch (error) {
    console.error('Error fetching verse:', error);
    return NextResponse.json({ error: 'Failed to fetch verse' }, { status: 500 });
  }
}
