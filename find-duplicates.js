#!/usr/bin/env node

/**
 * Find duplicate JIRA tasks in the database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findDuplicates() {
  console.log('🔍 Finding duplicate JIRA tasks...\n');

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
    t.workflow_metadata?.external_source === 'jira'
  );

  console.log(`📊 Total JIRA tasks: ${jiraTasks.length}\n`);

  // Group by external_key (JIRA issue key like SCRUM-76)
  const byKey = {};
  const byExternalId = {};

  jiraTasks.forEach(task => {
    const key = task.workflow_metadata?.external_key;
    const externalId = task.workflow_metadata?.external_id;
    
    if (key) {
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(task);
    }
    
    if (externalId) {
      if (!byExternalId[externalId]) byExternalId[externalId] = [];
      byExternalId[externalId].push(task);
    }
  });

  // Find duplicates by external_key
  console.log('🔑 Duplicates by JIRA Key:\n');
  let duplicateCount = 0;
  let totalDuplicateTasks = 0;

  Object.entries(byKey).forEach(([key, tasks]) => {
    if (tasks.length > 1) {
      duplicateCount++;
      totalDuplicateTasks += tasks.length;
      console.log(`  ❌ ${key}: ${tasks.length} copies`);
      tasks.forEach(t => {
        console.log(`     - ID: ${t.id.substring(0, 8)}... | User: ${t.user_id.substring(0, 8)}... | Created: ${new Date(t.started_at).toLocaleString()}`);
        console.log(`       external_id: ${t.workflow_metadata?.external_id || 'MISSING'}`);
      });
      console.log('');
    }
  });

  console.log(`\n📈 Summary:`);
  console.log(`   Unique JIRA issues: ${Object.keys(byKey).length}`);
  console.log(`   Issues with duplicates: ${duplicateCount}`);
  console.log(`   Total duplicate task records: ${totalDuplicateTasks}`);
  console.log(`   Wasted records: ${totalDuplicateTasks - duplicateCount}\n`);

  // Check for tasks without external_id
  const missingExternalId = jiraTasks.filter(t => !t.workflow_metadata?.external_id);
  if (missingExternalId.length > 0) {
    console.log(`⚠️  Tasks missing external_id: ${missingExternalId.length}`);
    missingExternalId.slice(0, 5).forEach(t => {
      console.log(`   - ${t.session_title} (${t.workflow_metadata?.external_key || 'no key'})`);
    });
    console.log('');
  }

  // Check for multiple users with same task
  console.log('👥 Tasks by user:');
  const userTaskCounts = {};
  jiraTasks.forEach(t => {
    const userId = t.user_id;
    if (!userTaskCounts[userId]) userTaskCounts[userId] = 0;
    userTaskCounts[userId]++;
  });
  Object.entries(userTaskCounts).forEach(([userId, count]) => {
    console.log(`   User ${userId.substring(0, 8)}...: ${count} tasks`);
  });
}

findDuplicates()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

