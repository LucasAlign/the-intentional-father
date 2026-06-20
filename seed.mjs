import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tbktawcbejolrfbkuqgq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRia3Rhd2NiZWpvbHJmYmt1cWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjE3MTcsImV4cCI6MjA5NzEzNzcxN30.-R1HuRhb9JlQgZggfOcbrYDcJA6VpcaHds27Z7IP23U';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('🌱 Seeding test data...');

  const today = new Date().toISOString().split('T')[0];

  try {
    // Add test tasks
    const tasks = [
      {
        text: 'Review customer quotes for sign job',
        category: 'Signs',
        done: false,
        partial: false,
      },
      {
        text: 'Check soil moisture on north field',
        category: 'Farm',
        done: false,
        partial: true, // stuck at 80%
      },
      {
        text: 'Plan date night with wife',
        category: 'Relationship',
        done: false,
        partial: false,
      },
      {
        text: 'Review Lucas Align sprint metrics',
        category: 'Wraparound',
        done: false,
        partial: false,
      },
    ];

    console.log('Adding test tasks...');
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .insert(tasks);

    if (tasksError) throw tasksError;
    console.log('✓ Added', tasks.length, 'test tasks');

    // Add journal entry for today
    console.log('Adding today journal entry...');
    const { error: journalError } = await supabase
      .from('journal_entries')
      .upsert({
        date: today,
        reflect: 'Made good progress on sign quotes today. Need to follow up with materials supplier about lead times.',
        commit_text: 'Show my wife I care by planning a meaningful date night this week.',
      }, { onConflict: 'date' });

    if (journalError) throw journalError;
    console.log('✓ Added journal entry for', today);

    console.log('\n✅ Test data seeded successfully!');
    console.log('\nYou can now:');
    console.log('1. Open http://localhost:3000');
    console.log('2. See your tasks and verse');
    console.log('3. Type a message to Arlo and get accountability');
    console.log('4. Check that Arlo remembers your recent journal entries\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
