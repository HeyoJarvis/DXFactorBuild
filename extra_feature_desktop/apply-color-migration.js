#!/usr/bin/env node

/**
 * Quick script to add the color column to the teams table
 * Run with: node extra_feature_desktop/apply-color-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColorColumn() {
  try {
    console.log('🔧 Adding color column to teams table...\n');

    // First, check if column already exists
    const { data: columns, error: checkError } = await supabase
      .from('teams')
      .select('*')
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking teams table:', checkError.message);
      process.exit(1);
    }

    // Check if color column exists in the result
    if (columns && columns.length > 0 && 'color' in columns[0]) {
      console.log('✅ Color column already exists in teams table!');
      console.log('   No migration needed.');
      process.exit(0);
    }

    // Execute the migration using raw SQL
    // Note: This requires the service role key or PostgreSQL direct access
    console.log('⚠️  Direct schema modification requires service role key or SQL Editor access');
    console.log('\nPlease run this SQL in your Supabase SQL Editor:\n');
    console.log('─'.repeat(60));
    console.log(`
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

COMMENT ON COLUMN teams.color IS 'Hex color code for UI differentiation of teams';
    `);
    console.log('─'.repeat(60));
    console.log('\n📍 Steps:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/_/sql');
    console.log('   2. Paste the SQL above');
    console.log('   3. Click "Run"');
    console.log('   4. Restart your Electron app\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

addColorColumn();

