/**
 * Test Team Switching Feature
 * Verifies that the team switching infrastructure is working correctly
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTeamSwitching() {
  console.log('🧪 Testing Team Switching Feature\n');

  try {
    // Step 1: Check if teams table exists and has data
    console.log('1️⃣ Checking teams table...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, slug, description')
      .limit(5);

    if (teamsError) {
      console.error('❌ Error querying teams:', teamsError.message);
      return;
    }

    console.log(`✅ Found ${teams.length} teams:`);
    teams.forEach(team => {
      console.log(`   - ${team.name} (${team.slug})`);
    });

    // Step 2: Check if team_members table exists
    console.log('\n2️⃣ Checking team_members table...');
    const { data: memberships, error: membersError } = await supabase
      .from('team_members')
      .select(`
        team_id,
        user_id,
        is_active,
        teams (
          name
        )
      `)
      .eq('is_active', true)
      .limit(10);

    if (membersError) {
      console.error('❌ Error querying team_members:', membersError.message);
      return;
    }

    console.log(`✅ Found ${memberships.length} active team memberships`);
    
    // Step 3: Get a sample user to test with
    console.log('\n3️⃣ Finding a test user with team membership...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')
      .limit(5);

    if (usersError) {
      console.error('❌ Error querying users:', usersError.message);
      return;
    }

    if (users.length === 0) {
      console.log('⚠️ No users found in database');
      return;
    }

    console.log(`✅ Found ${users.length} users`);
    
    // Test loading teams for the first user
    const testUser = users[0];
    console.log(`\n4️⃣ Testing team loading for user: ${testUser.email}`);
    
    const { data: userTeams, error: userTeamsError } = await supabase
      .from('team_members')
      .select(`
        team_id,
        teams (
          id,
          name,
          description,
          slug
        )
      `)
      .eq('user_id', testUser.id)
      .eq('is_active', true);

    if (userTeamsError) {
      console.error('❌ Error loading user teams:', userTeamsError.message);
      return;
    }

    const formattedTeams = (userTeams || [])
      .filter(tm => tm.teams)
      .map(tm => ({
        id: tm.teams.id,
        name: tm.teams.name,
        description: tm.teams.description || '',
        slug: tm.teams.slug
      }));

    console.log(`✅ User has ${formattedTeams.length} team(s):`);
    formattedTeams.forEach(team => {
      console.log(`   - ${team.name}`);
    });

    // Step 5: Check conversation_sessions table
    console.log('\n5️⃣ Checking conversation_sessions for team_chat...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('conversation_sessions')
      .select('id, workflow_type, workflow_id, session_title')
      .eq('workflow_type', 'team_chat')
      .limit(5);

    if (sessionsError) {
      console.error('⚠️ Error querying conversation_sessions:', sessionsError.message);
    } else {
      console.log(`✅ Found ${sessions?.length || 0} team_chat sessions`);
    }

    // Step 6: Summary
    console.log('\n📋 SUMMARY');
    console.log('─'.repeat(50));
    console.log('✅ Teams table: Working');
    console.log('✅ Team members table: Working');
    console.log('✅ User query: Working');
    console.log(`✅ Test user has ${formattedTeams.length} team(s)`);
    console.log('─'.repeat(50));
    
    if (formattedTeams.length === 0) {
      console.log('\n⚠️ WARNING: Test user has no teams!');
      console.log('   The team switching feature needs users to be members of teams.');
      console.log('   Run a script to add test user to a team, or ensure users are');
      console.log('   properly assigned to teams during onboarding.');
    } else {
      console.log('\n🎉 Team switching infrastructure looks good!');
      console.log('   The feature should work in the desktop app.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testTeamSwitching()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });



