#!/usr/bin/env node

/**
 * Quick Script to Install Supabase Schema
 * 
 * This is a simplified installer that reads and provides instructions
 * for setting up the Supabase schema.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(chalk.bold.cyan('\n🗄️  Supabase Schema Installation\n'));
console.log('='.repeat(50));
console.log('');

// Check if credentials are set
const hasUrl = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project');
const hasKey = process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY.includes('your_anon');

if (!hasUrl || !hasKey) {
  console.log(chalk.red('❌ Missing Supabase credentials in .env file\n'));
  console.log('Please add:');
  console.log('  SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_ANON_KEY=your_anon_key');
  console.log('\nSee SUPABASE_SETUP.md for detailed instructions.\n');
  process.exit(1);
}

console.log(chalk.green('✅ Supabase credentials found\n'));
console.log(`URL: ${process.env.SUPABASE_URL}\n`);

// Read the schema file
const schemaPath = path.join(__dirname, '../data/storage/supabase-schema-improved.sql');

if (!fs.existsSync(schemaPath)) {
  console.log(chalk.red('❌ Schema file not found at:'));
  console.log(schemaPath);
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, 'utf8');
const lineCount = schema.split('\n').length;
const tableCount = (schema.match(/CREATE TABLE/g) || []).length;
const indexCount = (schema.match(/CREATE INDEX/g) || []).length;
const functionCount = (schema.match(/CREATE OR REPLACE FUNCTION/g) || []).length;

console.log(chalk.bold('📊 Schema Statistics:\n'));
console.log(`   • ${lineCount} lines of SQL`);
console.log(`   • ${tableCount} tables`);
console.log(`   • ${indexCount} indexes`);
console.log(`   • ${functionCount} functions`);
console.log('');

console.log('='.repeat(50));
console.log(chalk.bold.yellow('\n📝 Installation Steps:\n'));
console.log('1. Go to your Supabase dashboard:');
console.log(chalk.cyan(`   https://app.supabase.com/project/${process.env.SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/)?.[1]}/sql\n`));

console.log('2. Click on "SQL Editor" in the left sidebar\n');

console.log('3. Click "New Query"\n');

console.log('4. Copy the entire SQL schema:');
console.log(chalk.cyan(`   File: ${schemaPath}\n`));

console.log('5. Paste into the SQL Editor\n');

console.log('6. Click "Run" or press Ctrl+Enter\n');

console.log('7. Wait for completion (~5-10 seconds)\n');

console.log('8. Verify installation by running:');
console.log(chalk.cyan('   node scripts/verify-supabase.js\n'));

console.log('='.repeat(50));

console.log(chalk.bold.green('\n💡 Tip:'), 'You can also copy from your terminal:');

if (process.platform === 'darwin') {
  console.log(chalk.cyan(`   cat "${schemaPath}" | pbcopy`));
} else if (process.platform === 'linux') {
  console.log(chalk.cyan(`   cat "${schemaPath}" | xclip -selection clipboard`));
} else {
  console.log(chalk.cyan(`   type "${schemaPath}" | clip`));
}

console.log('\nThen paste directly into Supabase SQL Editor.\n');

console.log('='.repeat(50));
console.log('');

