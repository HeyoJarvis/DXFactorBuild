#!/usr/bin/env node

/**
 * Add debug logging to task filtering
 */

const fs = require('fs');
const path = join(__dirname, '../desktop/main/supabase-adapter.js');

console.log('🔧 Adding debug logging to task filtering...\n');

let content = fs.readFileSync(path, 'utf8');

// Add debug logging after fetching tasks
const debugLog = `
    console.log('🔍 DEBUG: Raw tasks from DB:', {
      totalTasks: tasks.length,
      sampleTask: tasks[0] ? {
        id: tasks[0].id,
        title: tasks[0].title,
        user_id: tasks[0].user_id,
        assignor: tasks[0].assignor,
        assignee: tasks[0].assignee
      } : null
    });`;

if (!content.includes('DEBUG: Raw tasks from DB')) {
  content = content.replace(
    '    // NOW filter by user involvement (owner, assignor, or assignee)',
    debugLog + '\n\n    // NOW filter by user involvement (owner, assignor, or assignee)'
  );
  
  fs.writeFileSync(path, content);
  console.log('✅ Debug logging added');
} else {
  console.log('⏭️  Debug logging already exists');
}

console.log('\n📝 Restart HeyJarvis and check the logs for task details\n');
