/**
 * Check JIRA task ownership in database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTaskOwnership() {
  console.log('🔍 Checking JIRA task ownership...\n');
  
  const EXPECTED_USER_ID = '9f31e571-aa0f-4c88-8f57-5a4b2dd4f6a2';
  
  // Get JIRA tasks
  const { data: jiraTasks, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task')
    .eq('workflow_metadata->>externalSource', 'jira');
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`Found ${jiraTasks.length} JIRA tasks\n`);
  
  jiraTasks.forEach((task, idx) => {
    console.log(`Task ${idx + 1}:`);
    console.log(`  Title: ${task.session_title}`);
    console.log(`  user_id: ${task.user_id}`);
    console.log(`  Expected: ${EXPECTED_USER_ID}`);
    console.log(`  Match: ${task.user_id === EXPECTED_USER_ID ? '✅' : '❌'}`);
    console.log('');
  });
  
  const mismatchedTasks = jiraTasks.filter(t => t.user_id !== EXPECTED_USER_ID);
  
  if (mismatchedTasks.length > 0) {
    console.log('⚠️  PROBLEM FOUND!');
    console.log(`  ${mismatchedTasks.length} JIRA tasks have wrong user_id\n`);
    console.log('💡 SOLUTION: Update JIRA tasks to correct user_id\n');
    console.log('Run this to fix:');
    console.log('  node fix-jira-task-ownership.js\n');
  } else {
    console.log('✅ All JIRA tasks have correct user_id!');
  }
}

checkTaskOwnership()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });

