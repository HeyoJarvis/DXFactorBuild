/**
 * Check Teams Data - Diagnostic Script
 * Verifies that teams have unique IDs and proper team_members associations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTeamsData() {
  console.log('🔍 Checking teams data...\n');

  // 1. Check all teams
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, description, slug')
    .order('name');

  if (teamsError) {
    console.error('❌ Error fetching teams:', teamsError);
    return;
  }

  console.log('📊 Teams in database:');
  console.log('─'.repeat(80));
  teams.forEach((team, index) => {
    console.log(`${index + 1}. ${team.name}`);
    console.log(`   ID: ${team.id}`);
    console.log(`   Slug: ${team.slug || 'N/A'}`);
    console.log(`   Description: ${team.description || 'N/A'}`);
    console.log('');
  });

  // Check for duplicate IDs
  const idCounts = {};
  teams.forEach(team => {
    idCounts[team.id] = (idCounts[team.id] || 0) + 1;
  });

  const duplicateIds = Object.entries(idCounts).filter(([id, count]) => count > 1);
  if (duplicateIds.length > 0) {
    console.log('⚠️  DUPLICATE TEAM IDs FOUND:');
    duplicateIds.forEach(([id, count]) => {
      console.log(`   ${id}: ${count} teams`);
      const dupes = teams.filter(t => t.id === id);
      dupes.forEach(d => console.log(`     - ${d.name}`));
    });
    console.log('');
  }

  // 2. Check team_members for each team
  console.log('\n👥 Team Members:');
  console.log('─'.repeat(80));

  for (const team of teams) {
    // First, get team members without the join
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('user_id, role, is_active')
      .eq('team_id', team.id)
      .eq('is_active', true);

    if (membersError) {
      console.error(`❌ Error fetching members for ${team.name}:`, membersError);
      continue;
    }

    console.log(`${team.name} (${team.id}):`);
    if (!members || members.length === 0) {
      console.log('   ⚠️  NO MEMBERS - This team will show 0 tasks!');
    } else {
      // Get user details separately
      for (const member of members) {
        const { data: userData } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', member.user_id)
          .single();

        console.log(`   - ${userData?.email || member.user_id} (${member.role || 'member'})`);
      }
    }
    console.log('');
  }

  // 3. Show which users exist
  console.log('\n👤 All Users in System:');
  console.log('─'.repeat(80));
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name')
    .order('email');

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
  } else {
    users.forEach(user => {
      console.log(`   ${user.email} - ID: ${user.id}`);
    });
  }

  console.log('\n✅ Diagnostic complete!');
  console.log('\n💡 If teams have duplicate IDs, you need to update them to be unique.');
  console.log('💡 If teams have no members, you need to add users to team_members table.');
}

checkTeamsData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
