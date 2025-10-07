#!/usr/bin/env node

/**
 * Fix task query to filter by Slack ID in the database query itself
 * Instead of fetching ALL tasks and filtering in JavaScript
 */

const fs = require('fs');
const path = require('path');

const ADAPTER_FILE = path.join(__dirname, '../desktop/main/supabase-adapter.js');

console.log('🔧 Fixing task query to use Slack ID filtering...\n');

let content = fs.readFileSync(ADAPTER_FILE, 'utf8');

// Find and replace the query logic
const oldQuery = `    // MODIFIED QUERY: Get tasks where user is owner OR assignor OR assignee
    let query = this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('workflow_type', 'task');

    // Filter by completion status
    if (!filters.includeCompleted) {
      query = query.eq('is_completed', false);
    }

    // Sort by creation time
    query = query.order('started_at', { ascending: false });

    const limit = filters.limit || 50;
    query = query.limit(limit);`;

const newQuery = `    // IMPROVED QUERY: Filter by Slack ID involvement in the database query
    let query = this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('workflow_type', 'task');

    // Filter by completion status
    if (!filters.includeCompleted) {
      query = query.eq('is_completed', false);
    }

    // Filter by user involvement using Slack ID (if available)
    // This filters at the database level for better performance
    if (userSlackId) {
      // Use OR condition to get tasks where user is:
      // 1. Owner (user_id matches)
      // 2. Assignor (workflow_metadata->>'assignor' matches Slack ID)
      // 3. Assignee (workflow_metadata->>'assignee' matches Slack ID)
      query = query.or(\`user_id.eq.\${userId},workflow_metadata->>assignor.eq.\${userSlackId},workflow_metadata->>assignee.eq.\${userSlackId}\`);
    } else {
      // Fallback: only get tasks owned by user
      query = query.eq('user_id', userId);
    }

    // Sort by creation time
    query = query.order('started_at', { ascending: false });

    const limit = filters.limit || 50;
    query = query.limit(limit);`;

if (content.includes('MODIFIED QUERY: Get tasks where user is owner OR assignor OR assignee')) {
  content = content.replace(oldQuery, newQuery);
  
  // Also remove the JavaScript filtering since we're doing it in SQL now
  const oldJsFilter = `    // NOW filter by user involvement (owner, assignor, or assignee)
    if (userSlackId) {
      tasks = tasks.filter(task => {
        const isOwner = task.user_id === userId;
        const isAssignor = task.assignor === userSlackId;
        const isAssignee = task.assignee === userSlackId;
        
        return isOwner || isAssignor || isAssignee;
      });
    } else {
      // Fallback to just owned tasks if no Slack ID
      tasks = tasks.filter(task => task.user_id === userId);
    }`;

  const newJsFilter = `    // Tasks are already filtered by the database query
    // No need for additional filtering here unless we want to refine further`;

  if (content.includes('NOW filter by user involvement')) {
    content = content.replace(oldJsFilter, newJsFilter);
  }
  
  fs.writeFileSync(ADAPTER_FILE, content);
  
  console.log('✅ Task query updated to filter by Slack ID at database level');
  console.log('\n📝 What changed:');
  console.log('   - Query now filters by Slack ID in the SQL query');
  console.log('   - Uses PostgreSQL JSON operators (->>) for metadata filtering');
  console.log('   - Removed redundant JavaScript filtering');
  console.log('   - Much more efficient - only fetches relevant tasks');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart HeyJarvis');
  console.log('   2. Your tasks should now appear!');
  console.log('   3. Both "assigned_to_me" and "assigned_by_me" views should work\n');
} else {
  console.log('⚠️  Could not find the expected code structure');
  console.log('   The query may have already been modified');
  console.log('   Please check the file manually\n');
}
