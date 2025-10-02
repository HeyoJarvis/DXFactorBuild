const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testTasksInSupabase() {
  console.log('🔍 Checking tasks in Supabase...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check all conversation_sessions with workflow_type='task'
  const { data: tasks, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task')
    .order('started_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching tasks:', error);
    return;
  }

  console.log(`Found ${tasks.length} tasks in Supabase:\n`);

  tasks.forEach((task, index) => {
    console.log(`Task ${index + 1}:`);
    console.log(`  ID: ${task.id}`);
    console.log(`  User ID: ${task.user_id}`);
    console.log(`  Title: ${task.session_title}`);
    console.log(`  Workflow Type: ${task.workflow_type}`);
    console.log(`  Priority: ${task.workflow_metadata?.priority || 'none'}`);
    console.log(`  Completed: ${task.is_completed}`);
    console.log(`  Created: ${task.started_at}`);
    console.log();
  });

  // Also check ALL conversation_sessions to see what's there
  const { data: allSessions, error: allError } = await supabase
    .from('conversation_sessions')
    .select('user_id, workflow_type, session_title, is_completed')
    .order('started_at', { ascending: false })
    .limit(10);

  if (!allError) {
    console.log('\n📋 Last 10 conversation_sessions (all types):');
    allSessions.forEach((s, i) => {
      console.log(`${i + 1}. [${s.workflow_type}] ${s.session_title} (user: ${s.user_id}, completed: ${s.is_completed})`);
    });
  }
}

testTasksInSupabase().catch(console.error);

