#!/usr/bin/env node
/**
 * Test Team Join Functionality
 * Tests if add_user_to_team function works
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTeamJoin() {
  console.log('\n🧪 Testing Team Join Functionality\n');
  console.log('='.repeat(60));

  // Get a test user (the one you're logged in as)
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, name')
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error('❌ No users found. Please sign in first.');
    return;
  }

  const testUser = users[0];
  console.log('\n1️⃣  Test User:', testUser.email);

  // Get a test team
  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, name, slug')
    .limit(1);

  if (teamError || !teams || teams.length === 0) {
    console.error('❌ No teams found. Run the SQL migration first.');
    return;
  }

  const testTeam = teams[0];
  console.log('2️⃣  Test Team:', testTeam.name);

  // Try to add user to team using the function
  console.log('\n3️⃣  Calling add_user_to_team()...\n');
  
  const { data: memberId, error: joinError } = await supabase
    .rpc('add_user_to_team', {
      p_user_id: testUser.id,
      p_team_id: testTeam.id,
      p_role: 'member',
      p_invited_by: null
    });

  if (joinError) {
    console.error('❌ Error calling add_user_to_team:', joinError.message);
    console.error('   Details:', joinError);
    
    // Check if function exists
    console.log('\n🔍 Checking if function exists...');
    const { error: funcError } = await supabase
      .rpc('add_user_to_team', {});
    
    if (funcError && funcError.message.includes('does not exist')) {
      console.error('❌ Function add_user_to_team does not exist!');
      console.log('   You need to run: data/storage/team-members-only.sql');
    }
    return;
  }

  console.log('✅ User added to team successfully!');
  console.log('   Membership ID:', memberId);

  // Verify the membership was created
  console.log('\n4️⃣  Verifying membership in team_members table...\n');
  
  const { data: membership, error: verifyError } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', testUser.id)
    .eq('team_id', testTeam.id)
    .single();

  if (verifyError) {
    console.error('❌ Error verifying membership:', verifyError.message);
    return;
  }

  console.log('✅ Membership verified:');
  console.log('   User:', testUser.email);
  console.log('   Team:', testTeam.name);
  console.log('   Role:', membership.role);
  console.log('   Joined:', membership.joined_at);
  console.log('   Active:', membership.is_active);

  // Check if user's team_id was updated
  console.log('\n5️⃣  Checking if user.team_id was updated...\n');
  
  const { data: updatedUser, error: userUpdateError } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', testUser.id)
    .single();

  if (userUpdateError) {
    console.error('❌ Error checking user:', userUpdateError.message);
  } else if (updatedUser.team_id === testTeam.id) {
    console.log('✅ User team_id updated correctly:', updatedUser.team_id);
  } else {
    console.log('⚠️  User team_id not updated. Current:', updatedUser.team_id);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 Team join functionality is working!\n');
}

testTeamJoin().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});

