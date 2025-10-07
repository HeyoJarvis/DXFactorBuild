#!/usr/bin/env node

/**
 * Fix Supabase .or() query syntax for JSON fields
 */

const fs = require('fs');
const path = require('path');

const ADAPTER_FILE = path.join(__dirname, '../desktop/main/supabase-adapter.js');

console.log('🔧 Fixing Supabase .or() query syntax...\n');

let content = fs.readFileSync(ADAPTER_FILE, 'utf8');

// The issue: PostgREST JSON operator syntax in .or() is different
// Wrong: workflow_metadata->>assignor.eq.value
// Right: workflow_metadata->assignor.eq.value (single arrow for JSON path)

const wrongSyntax = `      query = query.or(\`user_id.eq.\${userId},workflow_metadata->>assignor.eq.\${userSlackId},workflow_metadata->>assignee.eq.\${userSlackId}\`);`;

const correctSyntax = `      query = query.or(\`user_id.eq.\${userId},workflow_metadata->assignor.eq.\${userSlackId},workflow_metadata->assignee.eq.\${userSlackId}\`);`;

if (content.includes('workflow_metadata->>assignor')) {
  content = content.replace(wrongSyntax, correctSyntax);
  fs.writeFileSync(ADAPTER_FILE, content);
  
  console.log('✅ Fixed Supabase query syntax');
  console.log('\n📝 Changed:');
  console.log('   workflow_metadata->>assignor  →  workflow_metadata->assignor');
  console.log('   workflow_metadata->>assignee  →  workflow_metadata->assignee');
  console.log('\n📝 Restart HeyJarvis and try again!\n');
} else {
  console.log('⏭️  Syntax already correct or not found\n');
}
