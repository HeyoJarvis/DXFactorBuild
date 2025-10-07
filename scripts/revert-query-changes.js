#!/usr/bin/env node

/**
 * Revert to the original working query
 */

const fs = require('fs');
const path = require('path');

const ADAPTER_FILE = path.join(__dirname, '../desktop/main/supabase-adapter.js');

console.log('🔄 Reverting to original query...\n');

let content = fs.readFileSync(ADAPTER_FILE, 'utf8');

// Revert to the simple query that was working
const brokenQuery = `    // IMPROVED QUERY: Filter by Slack ID involvement in the database query
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
      query = query.or(\`user_id.eq.\${userId},workflow_metadata->assignor.eq.\${userSlackId},workflow_metadata->assignee.eq.\${userSlackId}\`);
    } else {
      // Fallback: only get tasks owned by user
      query = query.eq('user_id', userId);
    }

    // Sort by creation time
    query = query.order('started_at', { ascending: false });

    const limit = filters.limit || 50;
    query = query.limit(limit);`;

const workingQuery = `    // Get ALL tasks, then filter in JavaScript
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

    const limit = filters.limit || 100;  // Increased limit
    query = query.limit(limit);`;

content = content.replace(brokenQuery, workingQuery);

// Also restore the JavaScript filtering
const noFilter = `    // Tasks are already filtered by the database query
    // No need for additional filtering here unless we want to refine further`;

const jsFilter = `    // NOW filter by user involvement (owner, assignor, or assignee)
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

content = content.replace(noFilter, jsFilter);

fs.writeFileSync(ADAPTER_FILE, content);

console.log('✅ Reverted to original working query');
console.log('\n📝 What was restored:');
console.log('   - Simple query that fetches all tasks');
console.log('   - JavaScript filtering by Slack ID');
console.log('   - Increased limit to 100 tasks');
console.log('\n📝 Restart HeyJarvis - it should work now!\n');
