#!/usr/bin/env node
/**
 * Check Team Setup in Supabase
 * Verifies what tables, functions, and data exist
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSetup() {
  console.log('\n🔍 Checking Team Setup in Supabase\n');
  console.log('='.repeat(60));

  // 1. Check if teams table exists and has data
  console.log('\n1️⃣  Checking teams table...\n');
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, slug')
      .limit(10);

    if (error) {
      console.log('   ❌ Error:', error.message);
    } else {
      console.log(`   ✅ Teams table exists with ${teams.length} teams:`);
      teams.forEach(team => {
        console.log(`      - ${team.name} (${team.slug})`);
      });
    }
  } catch (err) {
    console.log('   ❌ Teams table might not exist:', err.message);
  }

  // 2. Check if team_members table exists
  console.log('\n2️⃣  Checking team_members table...\n');
  try {
    const { data: members, error } = await supabase
      .from('team_members')
      .select('id')
      .limit(1);

    if (error) {
      console.log('   ❌ Error:', error.message);
      console.log('   ⚠️  You need to create team_members table!');
    } else {
      console.log('   ✅ team_members table exists');
    }
  } catch (err) {
    console.log('   ❌ team_members table does not exist');
    console.log('   ⚠️  You need to run the SQL migration!');
  }

  // 3. Check if helper functions exist
  console.log('\n3️⃣  Checking helper functions...\n');
  
  const functions = [
    'get_available_teams',
    'get_user_teams',
    'add_user_to_team'
  ];

  for (const funcName of functions) {
    try {
      const { data, error } = await supabase.rpc(funcName, 
        funcName === 'get_user_teams' 
          ? { user_uuid: '00000000-0000-0000-0000-000000000000' }
          : {}
      );

      if (error && error.message.includes('does not exist')) {
        console.log(`   ❌ ${funcName}() - Does not exist`);
      } else {
        console.log(`   ✅ ${funcName}() - Exists`);
      }
    } catch (err) {
      console.log(`   ❌ ${funcName}() - Error: ${err.message}`);
    }
  }

  // 4. Check for pre-populated teams
  console.log('\n4️⃣  Checking for pre-populated teams...\n');
  
  const expectedTeams = ['engineering', 'sales', 'product', 'marketing', 'executive'];
  
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('slug')
      .in('slug', expectedTeams);

    if (error) {
      console.log('   ❌ Error:', error.message);
    } else {
      const foundSlugs = teams.map(t => t.slug);
      expectedTeams.forEach(slug => {
        if (foundSlugs.includes(slug)) {
          console.log(`   ✅ ${slug} - Found`);
        } else {
          console.log(`   ❌ ${slug} - Missing`);
        }
      });
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Summary:\n');
  console.log('If you see any ❌ above, run the SQL migration:');
  console.log('1. Open Supabase SQL Editor');
  console.log('2. Copy/paste: data/storage/team-workspace-setup.sql');
  console.log('3. Execute the script');
  console.log('\n' + '='.repeat(60) + '\n');
}

checkSetup().catch(err => {
  console.error('❌ Check failed:', err.message);
  process.exit(1);
});

