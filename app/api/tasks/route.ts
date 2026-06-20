import { NextResponse } from 'next/server';
import { getTopTasks } from '@/lib/supabase';

export async function GET() {
  try {
    const tasks = await getTopTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
