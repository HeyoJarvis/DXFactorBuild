/**
 * Script to restore JIRA tasks that were incorrectly marked as deleted
 * Run with: node restore-jira-tasks.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restoreJiraTasks() {
  console.log('🔄 Restoring JIRA tasks that were incorrectly marked as deleted...\n');

  // Get all tasks marked as JIRA and completed
  const { data: completedJiraTasks, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task')
    .eq('is_completed', true)
    .contains('workflow_metadata', { external_source: 'jira', jira_deleted: true });

  if (error) {
    console.error('❌ Error fetching tasks:', error);
    return;
  }

  console.log(`Found ${completedJiraTasks.length} completed JIRA tasks\n`);

  let restored = 0;
  for (const task of completedJiraTasks) {
    const externalId = task.workflow_metadata?.external_id;
    const externalKey = task.workflow_metadata?.external_key;

    console.log(`Restoring: ${task.session_title} (${externalKey})`);

    // Restore by marking as not completed and removing jira_deleted flag
    const { error: updateError } = await supabase
      .from('conversation_sessions')
      .update({
        is_completed: false,
        completed_at: null,
        workflow_metadata: {
          ...task.workflow_metadata,
          jira_deleted: false
        }
      })
      .eq('id', task.id);

    if (updateError) {
      console.error(`  ❌ Failed to restore:`, updateError);
    } else {
      console.log(`  ✅ Restored`);
      restored++;
    }
  }

  console.log(`\n✅ Restored ${restored} tasks`);
}

restoreJiraTasks().catch(console.error);

