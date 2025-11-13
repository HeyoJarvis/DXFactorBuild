#!/usr/bin/env node

/**
 * Clean up duplicate JIRA tasks - keep only the most recent one for each external_id
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate JIRA tasks...\n');

  // Get all JIRA tasks
  const { data: tasks, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task')
    .order('started_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  const jiraTasks = tasks.filter(t => 
    t.workflow_metadata?.external_source === 'jira' &&
    t.workflow_metadata?.external_id
  );

  console.log(`📊 Total JIRA tasks: ${jiraTasks.length}\n`);

  // Group by external_id
  const byExternalId = {};
  jiraTasks.forEach(task => {
    const externalId = task.workflow_metadata?.external_id;
    if (externalId) {
      if (!byExternalId[externalId]) byExternalId[externalId] = [];
      byExternalId[externalId].push(task);
    }
  });

  // Find duplicates and delete older ones
  let deletedCount = 0;
  let keptCount = 0;

  for (const [externalId, taskList] of Object.entries(byExternalId)) {
    if (taskList.length > 1) {
      // Sort by created date (most recent first)
      taskList.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      
      const keepTask = taskList[0];
      const deleteTasks = taskList.slice(1);
      
      console.log(`\n🔍 ${externalId} (${keepTask.workflow_metadata?.external_key}):`);
      console.log(`   ✅ Keeping: ${keepTask.id.substring(0, 8)}... (${new Date(keepTask.started_at).toLocaleString()})`);
      console.log(`   ❌ Deleting ${deleteTasks.length} duplicates:`);
      
      for (const task of deleteTasks) {
        console.log(`      - ${task.id.substring(0, 8)}... (${new Date(task.started_at).toLocaleString()})`);
        
        // Delete the duplicate
        const { error: deleteError } = await supabase
          .from('conversation_sessions')
          .delete()
          .eq('id', task.id);
        
        if (deleteError) {
          console.error(`      ⚠️  Failed to delete: ${deleteError.message}`);
        } else {
          deletedCount++;
        }
      }
      
      keptCount++;
    } else {
      keptCount++;
    }
  }

  console.log(`\n\n✅ Cleanup Complete:`);
  console.log(`   Unique tasks kept: ${keptCount}`);
  console.log(`   Duplicates deleted: ${deletedCount}`);
  console.log(`   Space saved: ${Math.round((deletedCount / (deletedCount + keptCount)) * 100)}%\n`);
}

cleanupDuplicates()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

