const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugUserTasks() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const targetSlackId = 'U09GJSJLDNW'; // The user from your screenshot
  
  console.log('🔍 Debugging tasks for Slack user:', targetSlackId);
  console.log('='.repeat(60));

  // Step 1: Find the user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('slack_user_id', targetSlackId)
    .single();

  if (userError) {
    console.error('❌ User lookup error:', userError.message);
    return;
  }

  console.log('\n✅ User Found:');
  console.log({
    id: user.id,
    email: user.email,
    name: user.name,
    slack_user_id: user.slack_user_id
  });

  // Step 2: Find ALL tasks for this user (by user_id)
  const { data: tasksByUserId, error: tasksError1 } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('workflow_type', 'task');

  console.log('\n📋 Tasks where user_id =', user.id, ':', tasksByUserId?.length || 0);
  
  if (tasksByUserId && tasksByUserId.length > 0) {
    tasksByUserId.forEach((task, i) => {
      console.log(`  ${i+1}. ${task.session_title}`);
      console.log(`     assignee: ${task.workflow_metadata?.assignee}`);
      console.log(`     assignor: ${task.workflow_metadata?.assignor}`);
    });
  }

  // Step 3: Find tasks where they're mentioned as assignee (in metadata)
  const { data: allTasks, error: tasksError2 } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task');

  const tasksWhereAssignee = allTasks?.filter(task => 
    task.workflow_metadata?.assignee === targetSlackId
  ) || [];

  console.log('\n📌 Tasks where assignee metadata =', targetSlackId, ':', tasksWhereAssignee.length);
  
  if (tasksWhereAssignee.length > 0) {
    tasksWhereAssignee.forEach((task, i) => {
      console.log(`  ${i+1}. ${task.session_title}`);
      console.log(`     user_id: ${task.user_id}`);
      console.log(`     assignor: ${task.workflow_metadata?.assignor}`);
      console.log(`     ⚠️  MISMATCH: Task is for this user but user_id is different!`);
    });
  }

  // Step 4: Show all tasks for comparison
  console.log('\n📊 Total tasks in database:', allTasks?.length || 0);
  console.log('\n='.repeat(60));
  console.log('🎯 DIAGNOSIS:');
  
  if (tasksByUserId?.length === 0 && tasksWhereAssignee.length > 0) {
    console.log('❌ PROBLEM FOUND: Tasks exist with this user as assignee,');
    console.log('   but they have the WRONG user_id!');
    console.log('   Tasks need to have user_id =', user.id);
    console.log('   to show up for this user.');
  } else if (tasksByUserId?.length === 0) {
    console.log('✅ No tasks found for this user yet.');
    console.log('   Create a task by mentioning them in Slack!');
  } else {
    console.log('✅ Tasks found! User should see', tasksByUserId.length, 'task(s).');
  }
}

debugUserTasks().catch(console.error);
