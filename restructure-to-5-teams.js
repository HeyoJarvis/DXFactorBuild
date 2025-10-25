/**
 * Restructure to 5 Global Feature Teams
 * Mobile: SF (eng) + NYC (functional)
 * Desktop: Puerto Rico (eng) + Spain (functional)
 * BizDev: Remote (sales + executive)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Define the 5 teams
const TEAMS = {
  eng_mobile: {
    id: '00000000-0000-0000-0000-000000000020',
    name: 'eng-mobile-sf-david',
    slug: 'eng-mobile-sf-david',
    description: 'Mobile Engineering Team - San Francisco | Mobile app architecture, performance, UI components'
  },
  func_mobile: {
    id: '00000000-0000-0000-0000-000000000021',
    name: 'functional-mobile-nyc-iris',
    slug: 'functional-mobile-nyc-iris',
    description: 'Mobile Product & Marketing Team - New York | Mobile roadmap, design, marketing, UX research'
  },
  eng_desktop: {
    id: '00000000-0000-0000-0000-000000000022',
    name: 'eng-desktop-puerto_rico-alice',
    slug: 'eng-desktop-puerto-rico-alice',
    description: 'Desktop Engineering Team - Puerto Rico | Desktop platform, authentication, integrations'
  },
  func_desktop: {
    id: '00000000-0000-0000-0000-000000000023',
    name: 'functional-desktop-spain-olivia',
    slug: 'functional-desktop-spain-olivia',
    description: 'Desktop Product & Marketing Team - Spain | Enterprise content, analytics, SEO, branding'
  },
  bizdev: {
    id: '00000000-0000-0000-0000-000000000024',
    name: 'bizdev-revenue-remote-rachel',
    slug: 'bizdev-revenue-remote-rachel',
    description: 'Business Development Team - Remote | Sales, partnerships, strategic planning, executive leadership'
  }
};

// Team member assignments
const TEAM_ASSIGNMENTS = {
  eng_mobile: [
    'david.kim@beachbaby.demo',
    'bob.martinez@beachbaby.demo'
  ],
  func_mobile: [
    'iris.anderson@beachbaby.demo',
    'jack.lee@beachbaby.demo',
    'maya.garcia@beachbaby.demo',
    'kelly.davis@beachbaby.demo',
    'paul.clark@beachbaby.demo'
  ],
  eng_desktop: [
    'alice.chen@beachbaby.demo',
    'carol.johnson@beachbaby.demo'
  ],
  func_desktop: [
    'olivia.harris@beachbaby.demo',
    'leo.white@beachbaby.demo',
    'nathan.miller@beachbaby.demo',
    'quinn.lewis@beachbaby.demo'
  ],
  bizdev: [
    'emma.wilson@beachbaby.demo',
    'frank.rodriguez@beachbaby.demo',
    'grace.taylor@beachbaby.demo',
    'henry.brown@beachbaby.demo',
    'rachel.thompson@beachbaby.demo',
    'steven.walker@beachbaby.demo',
    'tina.young@beachbaby.demo'
  ]
};

async function restructure() {
  console.log('🌍 Restructuring to 5 Global Feature Teams\n');
  console.log('═'.repeat(80));

  // Step 1: Get all users
  const allEmails = Object.values(TEAM_ASSIGNMENTS).flat();
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name')
    .in('email', allEmails);

  if (usersError) {
    console.error('❌ Failed to fetch users:', usersError.message);
    return;
  }

  const userMap = {};
  users.forEach(u => {
    userMap[u.email] = u;
  });

  console.log(`✓ Found ${users.length} users\n`);

  // Step 2: Clear existing teams and memberships
  console.log('🧹 Cleaning up existing structure...\n');

  // Delete all team memberships
  const { error: deleteMembersError } = await supabase
    .from('team_members')
    .delete()
    .neq('team_id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteMembersError) {
    console.warn('⚠️  Error deleting team members:', deleteMembersError.message);
  } else {
    console.log('✅ Cleared all team memberships');
  }

  // Delete all tasks
  const userIds = users.map(u => u.id);
  const { error: deleteTasksError } = await supabase
    .from('tasks')
    .delete()
    .in('assigned_to', userIds);

  if (deleteTasksError) {
    console.warn('⚠️  Error deleting tasks:', deleteTasksError.message);
  } else {
    console.log('✅ Cleared all tasks');
  }

  // Delete all existing teams
  const { error: deleteTeamsError } = await supabase
    .from('teams')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteTeamsError) {
    console.warn('⚠️  Error deleting teams:', deleteTeamsError.message);
  } else {
    console.log('✅ Deleted all existing teams');
  }

  console.log('');

  // Step 3: Create new teams
  console.log('📋 Creating 5 global feature teams...\n');

  for (const [key, teamData] of Object.entries(TEAMS)) {
    const { error: createError } = await supabase
      .from('teams')
      .insert({
        id: teamData.id,
        name: teamData.name,
        slug: teamData.slug,
        description: teamData.description,
        subscription_tier: 'team',
        subscription_status: 'active'
      });

    if (createError && createError.code !== '23505') {
      console.error(`❌ Failed to create ${teamData.name}:`, createError.message);
    } else {
      console.log(`✅ ${teamData.name}`);
      console.log(`   ${teamData.description}`);
    }
  }

  console.log('');

  // Step 4: Assign users to teams
  console.log('👥 Assigning users to teams...\n');

  for (const [teamKey, emails] of Object.entries(TEAM_ASSIGNMENTS)) {
    const teamData = TEAMS[teamKey];
    console.log(`\n${teamData.name}:`);
    console.log('─'.repeat(80));

    for (const email of emails) {
      const user = userMap[email];
      if (!user) {
        console.log(`   ⚠️  User not found: ${email}`);
        continue;
      }

      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamData.id,
          user_id: user.id,
          role: 'member',
          is_active: true,
          joined_at: new Date().toISOString()
        });

      if (memberError && memberError.code !== '23505') {
        console.log(`   ❌ ${user.name}: ${memberError.message}`);
      } else {
        console.log(`   ✅ ${user.name}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 Team Structure Created:\n');

  // Show final structure
  const { data: finalTeams } = await supabase
    .from('teams')
    .select('id, name, description')
    .order('name');

  for (const team of finalTeams || []) {
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', team.id)
      .eq('is_active', true);

    console.log(`${team.name} (${members?.length || 0} members)`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Restructure complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Create feature-specific tasks for each team');
  console.log('   2. Restart desktop app to see new structure');
  console.log('═'.repeat(80));
}

restructure()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

