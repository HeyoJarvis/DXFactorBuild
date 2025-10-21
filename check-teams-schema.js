#!/usr/bin/env node
/**
 * Check Teams Table Schema
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('\n🔍 Checking teams table schema...\n');
  
  // Get one team to see what columns exist
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ Available columns in teams table:\n');
    Object.keys(data[0]).forEach(col => {
      console.log(`   - ${col}`);
    });
  } else {
    console.log('⚠️  No teams found in table');
  }
}

checkSchema();

