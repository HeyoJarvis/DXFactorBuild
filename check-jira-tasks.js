#!/usr/bin/env node

/**
 * Quick script to check what JIRA tasks are actually in the database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJiraTasks() {
  console.log('🔍 Checking JIRA tasks in database...\n');

  // Get all tasks with external_source = 'jira'
  const { data: tasks, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task')
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Error fetching tasks:', error);
    return;
  }

  console.log(`📊 Total tasks found: ${tasks.length}\n`);

  // Filter JIRA tasks
  const jiraTasks = tasks.filter(t => 
    t.workflow_metadata?.external_source === 'jira'
  );

  console.log(`🎯 JIRA tasks found: ${jiraTasks.length}\n`);

  if (jiraTasks.length === 0) {
    console.log('⚠️  NO JIRA TASKS FOUND IN DATABASE!');
    console.log('This means the JIRA sync is not working or has not been run.\n');
    
    // Check if there are any tasks at all
    console.log('📋 Sample of all tasks:');
    tasks.slice(0, 5).forEach(t => {
      console.log(`  - "${t.session_title}" (source: ${t.workflow_metadata?.external_source || 'manual'})`);
    });
    return;
  }

  // Analyze JIRA tasks
  console.log('📋 JIRA Tasks Breakdown:\n');

  const completed = jiraTasks.filter(t => t.is_completed);
  const inProgress = jiraTasks.filter(t => !t.is_completed && t.workflow_metadata?.jira_status?.toLowerCase().includes('progress'));
  const todo = jiraTasks.filter(t => !t.is_completed && !t.workflow_metadata?.jira_status?.toLowerCase().includes('progress'));

  console.log(`✅ Completed: ${completed.length}`);
  console.log(`🔄 In Progress: ${inProgress.length}`);
  console.log(`📝 To Do: ${todo.length}\n`);

  // Check for tasks with due dates
  const now = new Date();
  const overdue = jiraTasks.filter(t => {
    if (t.is_completed) return false;
    const dueDate = t.workflow_metadata?.due_date;
    if (!dueDate) return false;
    return new Date(dueDate) < now;
  });

  console.log(`⚠️  Overdue tasks: ${overdue.length}\n`);

  // Check for high-priority tasks
  const highPriority = jiraTasks.filter(t => {
    if (t.is_completed) return false;
    const priority = (t.workflow_metadata?.priority || t.workflow_metadata?.jira_priority || '').toLowerCase();
    return ['high', 'highest', 'urgent', 'critical'].includes(priority);
  });

  console.log(`🔥 High-priority tasks: ${highPriority.length}\n`);

  // Show sample tasks
  console.log('📄 Sample JIRA Tasks:\n');
  jiraTasks.slice(0, 5).forEach(t => {
    console.log(`  📌 ${t.session_title}`);
    console.log(`     Key: ${t.workflow_metadata?.external_key || 'N/A'}`);
    console.log(`     JIRA Status: ${t.workflow_metadata?.jira_status || 'N/A'}`);
    console.log(`     is_completed: ${t.is_completed}`);
    console.log(`     Priority: ${t.workflow_metadata?.jira_priority || t.workflow_metadata?.priority || 'N/A'}`);
    console.log(`     Due Date: ${t.workflow_metadata?.due_date || 'N/A'}`);
    console.log(`     Story Points: ${t.workflow_metadata?.story_points || 0}`);
    console.log(`     User ID: ${t.user_id}`);
    console.log('');
  });

  // Check all unique JIRA statuses
  const uniqueStatuses = [...new Set(jiraTasks.map(t => t.workflow_metadata?.jira_status).filter(Boolean))];
  console.log('🎨 All JIRA Statuses in DB:');
  uniqueStatuses.forEach(status => {
    const count = jiraTasks.filter(t => t.workflow_metadata?.jira_status === status).length;
    console.log(`   - "${status}": ${count} tasks`);
  });
}

checkJiraTasks()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

