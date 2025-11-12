/**
 * Script to remove DUPLICATE JIRA tasks, keeping only the most recent one
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDuplicates() {
  console.log('🔍 Finding duplicate JIRA tasks...\n');

  // Get all JIRA tasks that are NOT completed
  const { data: jiraTasks, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task')
    .eq('is_completed', false)
    .contains('workflow_metadata', { external_source: 'jira' })
    .order('started_at', { ascending: false }); // Most recent first

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Found ${jiraTasks.length} active JIRA tasks\n`);

  // Group by external_key
  const tasksByKey = {};
  for (const task of jiraTasks) {
    const key = task.workflow_metadata?.external_key;
    if (!key) {
      console.log(`⚠️  Task without key: ${task.session_title} (${task.id})`);
      continue;
    }

    if (!tasksByKey[key]) {
      tasksByKey[key] = [];
    }
    tasksByKey[key].push(task);
  }

  // Find duplicates
  let duplicatesToDelete = [];
  for (const [key, tasks] of Object.entries(tasksByKey)) {
    if (tasks.length > 1) {
      console.log(`\n📋 ${key}: Found ${tasks.length} copies`);
      // Keep the first one (most recent), delete the rest
      const [keep, ...deleteThese] = tasks;
      console.log(`  ✅ KEEP: ${keep.id} (${keep.started_at})`);
      for (const dup of deleteThese) {
        console.log(`  ❌ DELETE: ${dup.id} (${dup.started_at})`);
        duplicatesToDelete.push(dup);
      }
    }
  }

  if (duplicatesToDelete.length === 0) {
    console.log('\n✅ No duplicates found!');
    return;
  }

  console.log(`\n🗑️  Deleting ${duplicatesToDelete.length} duplicate tasks...\n`);

  for (const task of duplicatesToDelete) {
    const { error: delError } = await supabase
      .from('conversation_sessions')
      .delete()
      .eq('id', task.id);

    if (delError) {
      console.error(`  ❌ Failed to delete ${task.id}:`, delError);
    } else {
      console.log(`  ✅ Deleted: ${task.workflow_metadata?.external_key} (${task.id})`);
    }
  }

  console.log(`\n✅ Done! Deleted ${duplicatesToDelete.length} duplicates`);
}

fixDuplicates().catch(console.error);


