/**
 * Final cleanup: Keep ONLY the 11 current JIRA tasks
 * Based on the sync logs showing 11 current issues
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// These are the 11 tasks currently in JIRA (from sync logs)
const CURRENT_JIRA_KEYS = [
  'SCRUM-64', // Add person-level report generation
  'SCRUM-52', // Add proper Task Chat Functionality
  'SCRUM-73', // Create downloadable link for DXApp
  'SCRUM-75', // Create Viewing Dashboard for DXAPP
  'SCRUM-76', // Remove non-JIRA integrations
  'SCRUM-62', // Enhance email indexing
  'SCRUM-51', // Tickets require Github Repository
  'SCRUM-56', // Investigate Team Chat processing
  'SCRUM-55', // Enhance Team Chat Responses formatting
  'SCRUM-65', // Kan-ban progress switching
  'SCRUM-59'  // PM/Functional Users JIRA boards
];

async function finalCleanup() {
  console.log('🔍 Finding tasks to keep vs delete...\n');
  console.log(`Current JIRA has ${CURRENT_JIRA_KEYS.length} tasks\n`);

  // Get all active JIRA tasks
  const { data: allTasks, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task')
    .eq('is_completed', false)
    .contains('workflow_metadata', { external_source: 'jira' });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${allTasks.length} active JIRA tasks in database\n`);

  const toKeep = [];
  const toDelete = [];

  for (const task of allTasks) {
    const key = task.workflow_metadata?.external_key;
    if (!key) {
      console.log(`⚠️  No key: ${task.session_title}`);
      toDelete.push(task);
      continue;
    }

    if (CURRENT_JIRA_KEYS.includes(key)) {
      toKeep.push(task);
    } else {
      toDelete.push(task);
    }
  }

  console.log(`\n✅ KEEP (${toKeep.length} tasks):`);
  toKeep.forEach(t => console.log(`  - ${t.workflow_metadata?.external_key}: ${t.session_title}`));

  console.log(`\n❌ DELETE (${toDelete.length} tasks):`);
  toDelete.forEach(t => console.log(`  - ${t.workflow_metadata?.external_key || 'NO KEY'}: ${t.session_title}`));

  if (toDelete.length === 0) {
    console.log('\n✅ Nothing to delete!');
    return;
  }

  console.log(`\n🗑️  Deleting ${toDelete.length} old tasks...\n`);

  for (const task of toDelete) {
    const { error: delError } = await supabase
      .from('conversation_sessions')
      .delete()
      .eq('id', task.id);

    if (delError) {
      console.error(`  ❌ Failed:`, delError);
    } else {
      console.log(`  ✅ Deleted: ${task.workflow_metadata?.external_key || 'NO KEY'}`);
    }
  }

  console.log(`\n✅ Done! Database now has only the ${toKeep.length} current JIRA tasks`);
}

finalCleanup().catch(console.error);

