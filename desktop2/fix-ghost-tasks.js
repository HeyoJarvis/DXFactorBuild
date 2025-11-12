/**
 * Script to fix ghost JIRA tasks that are showing up but shouldn't
 * Run with: node fix-ghost-tasks.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixGhostTasks() {
  console.log('🔍 Finding ghost JIRA tasks...\n');

  // Get all tasks marked as JIRA
  const { data: jiraTasks, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task')
    .contains('workflow_metadata', { external_source: 'jira' });

  if (error) {
    console.error('❌ Error fetching tasks:', error);
    return;
  }

  console.log(`Found ${jiraTasks.length} tasks marked as JIRA\n`);

  // Check each task
  const ghostTasks = [];
  for (const task of jiraTasks) {
    const externalId = task.workflow_metadata?.external_id;
    const externalKey = task.workflow_metadata?.external_key;
    const isCompleted = task.is_completed;
    const jiraDeleted = task.workflow_metadata?.jira_deleted;

    console.log(`Task: ${task.session_title}`);
    console.log(`  ID: ${task.id}`);
    console.log(`  External ID: ${externalId || 'MISSING'}`);
    console.log(`  External Key: ${externalKey || 'MISSING'}`);
    console.log(`  Is Completed: ${isCompleted}`);
    console.log(`  JIRA Deleted: ${jiraDeleted}`);

    // Check if it's a ghost task
    if (!externalId || !externalId.startsWith('jira_')) {
      console.log(`  ⚠️  GHOST TASK - Invalid or missing external_id`);
      ghostTasks.push({ task, reason: 'invalid_external_id' });
    } else if (jiraDeleted === true && !isCompleted) {
      console.log(`  ⚠️  GHOST TASK - Marked as jira_deleted but not completed`);
      ghostTasks.push({ task, reason: 'not_completed' });
    } else if (!isCompleted && (jiraDeleted === undefined || jiraDeleted === false)) {
      // Task is not completed and not explicitly marked as deleted
      // These might be old tasks that need cleanup
      console.log(`  ⚠️  POTENTIAL GHOST - Not completed, not marked deleted`);
      ghostTasks.push({ task, reason: 'needs_verification' });
    }

    console.log('');
  }

  if (ghostTasks.length === 0) {
    console.log('✅ No ghost tasks found!');
    return;
  }

  console.log(`\n🧹 Found ${ghostTasks.length} ghost tasks to fix:\n`);
  ghostTasks.forEach(({ task, reason }) => {
    console.log(`  - ${task.session_title} (${reason})`);
  });

  console.log('\n🔧 Fixing ghost tasks...\n');

  for (const { task, reason } of ghostTasks) {
    if (reason === 'invalid_external_id') {
      // Remove JIRA tags from tasks without valid external_id
      const { error: updateError } = await supabase
        .from('conversation_sessions')
        .update({
          workflow_metadata: {
            ...task.workflow_metadata,
            external_source: null,
            external_id: null,
            external_key: null,
            jira_status: null
          }
        })
        .eq('id', task.id);

      if (updateError) {
        console.error(`  ❌ Failed to fix ${task.session_title}:`, updateError);
      } else {
        console.log(`  ✅ Removed JIRA tags from: ${task.session_title}`);
      }
    } else if (reason === 'not_completed' || reason === 'needs_verification') {
      // Mark as completed and deleted
      const { error: updateError } = await supabase
        .from('conversation_sessions')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          workflow_metadata: {
            ...task.workflow_metadata,
            jira_deleted: true
          }
        })
        .eq('id', task.id);

      if (updateError) {
        console.error(`  ❌ Failed to mark completed ${task.session_title}:`, updateError);
      } else {
        console.log(`  ✅ Marked as completed and deleted: ${task.session_title} (${task.workflow_metadata?.external_key})`);
      }
    }
  }

  console.log('\n✅ Done! Ghost tasks have been fixed.');
}

fixGhostTasks().catch(console.error);

