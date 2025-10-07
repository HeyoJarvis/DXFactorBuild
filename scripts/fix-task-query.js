#!/usr/bin/env node

/**
 * Fix task query to fetch ALL tasks, then filter by involvement
 * The current query is too restrictive
 */

const fs = require('fs');
const path = require('path');

const ADAPTER_FILE = path.join(__dirname, '../desktop/main/supabase-adapter.js');

console.log('🔧 Fixing task query...\n');

let content = fs.readFileSync(ADAPTER_FILE, 'utf8');

// The issue: We're querying ALL tasks but getting 0 results
// This suggests the query itself might be the issue, OR the tasks aren't being created

// Let's add comprehensive logging to see what's happening
const loggingCode = `
    console.log('🔍 Task query params:', {
      userId,
      userSlackId,
      filters
    });
    
    const { data, error } = await query;

    console.log('🔍 Raw query result:', {
      taskCount: data?.length || 0,
      error: error?.message,
      sampleTask: data?.[0] ? {
        id: data[0].id,
        title: data[0].session_title,
        user_id: data[0].user_id,
        workflow_metadata: data[0].workflow_metadata
      } : null
    });`;

if (!content.includes('Task query params')) {
  content = content.replace(
    'const { data, error } = await query;',
    loggingCode
  );
  
  fs.writeFileSync(ADAPTER_FILE, content);
  console.log('✅ Debug logging added to task query');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart HeyJarvis');
  console.log('   2. Send a Slack message to create a task');
  console.log('   3. Check the terminal logs');
  console.log('   4. Look for "Raw query result" to see what tasks are being returned\n');
} else {
  console.log('⏭️  Debug logging already exists\n');
}
