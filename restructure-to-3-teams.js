/**
 * Restructure to 3 Teams
 * - Engineering (keep as is)
 * - Functional (Product + Marketing people)
 * - Business Development (Sales + Executive people)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Old team IDs to remove
const OLD_TEAM_IDS = {
  sales: '00000000-0000-0000-0000-000000000002',
  product: '00000000-0000-0000-0000-000000000003',
  marketing: '00000000-0000-0000-0000-000000000004',
  executive: '00000000-0000-0000-0000-000000000005'
};

// Keep Engineering
const ENGINEERING_TEAM_ID = '00000000-0000-0000-0000-000000000001';

// New team IDs
const NEW_TEAMS = {
  functional: {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Functional',
    slug: 'functional',
    description: 'Product, Marketing, and Operational functions'
  },
  business_dev: {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Business Development',
    slug: 'business-development',
    description: 'Sales, Partnerships, and Executive leadership'
  }
};

// User reassignment map
const USER_REASSIGNMENT = {
  // Functional team (Product + Marketing)
  functional: [
    'iris.anderson@beachbaby.demo',
    'jack.lee@beachbaby.demo',
    'kelly.davis@beachbaby.demo',
    'leo.white@beachbaby.demo',
    'maya.garcia@beachbaby.demo',
    'nathan.miller@beachbaby.demo',
    'olivia.harris@beachbaby.demo',
    'paul.clark@beachbaby.demo',
    'quinn.lewis@beachbaby.demo'
  ],
  // Business Development team (Sales + Executive)
  business_dev: [
    'emma.wilson@beachbaby.demo',
    'frank.rodriguez@beachbaby.demo',
    'grace.taylor@beachbaby.demo',
    'henry.brown@beachbaby.demo',
    'rachel.thompson@beachbaby.demo',
    'steven.walker@beachbaby.demo',
    'tina.young@beachbaby.demo'
  ]
};

async function restructureTeams() {
  console.log('🔄 Restructuring to 3 teams...\n');
  console.log('═'.repeat(80));

  // Step 1: Get all user IDs for reassignment
  const allEmails = [...USER_REASSIGNMENT.functional, ...USER_REASSIGNMENT.business_dev];
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

  console.log(`✓ Found ${users.length} users to reassign\n`);

  // Step 2: Remove old team memberships
  console.log('🧹 Removing old team memberships...\n');
  const oldTeamIdsList = Object.values(OLD_TEAM_IDS);
  
  const { error: removeMembersError } = await supabase
    .from('team_members')
    .delete()
    .in('team_id', oldTeamIdsList);

  if (removeMembersError) {
    console.error('❌ Failed to remove team members:', removeMembersError.message);
  } else {
    console.log('✅ Removed all members from old teams\n');
  }

  // Step 3: Delete tasks from old teams
  console.log('🧹 Removing tasks from users being reassigned...\n');
  const userIdsToReassign = users.map(u => u.id);
  
  const { data: oldTasks } = await supabase
    .from('tasks')
    .select('id, external_source')
    .in('assigned_to', userIdsToReassign);

  if (oldTasks && oldTasks.length > 0) {
    console.log(`   Found ${oldTasks.length} tasks to remove`);
    
    const { error: deleteTasksError } = await supabase
      .from('tasks')
      .delete()
      .in('assigned_to', userIdsToReassign);

    if (deleteTasksError) {
      console.error('❌ Failed to delete tasks:', deleteTasksError.message);
    } else {
      console.log('✅ Deleted tasks from reassigned users\n');
    }
  }

  // Step 4: Delete old teams
  console.log('🧹 Deleting old teams...\n');
  
  const { error: deleteTeamsError } = await supabase
    .from('teams')
    .delete()
    .in('id', oldTeamIdsList);

  if (deleteTeamsError) {
    console.error('❌ Failed to delete teams:', deleteTeamsError.message);
  } else {
    console.log('✅ Deleted Sales, Product, Marketing, Executive teams\n');
  }

  // Step 5: Create new teams
  console.log('📋 Creating new teams...\n');

  for (const [key, teamData] of Object.entries(NEW_TEAMS)) {
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

    if (createError && createError.code !== '23505') { // Ignore duplicate key error
      console.error(`❌ Failed to create ${teamData.name}:`, createError.message);
    } else {
      console.log(`✅ Created team: ${teamData.name}`);
    }
  }

  console.log('');

  // Step 6: Assign users to new teams
  console.log('👥 Assigning users to new teams...\n');

  // Functional team
  console.log('📋 FUNCTIONAL TEAM');
  console.log('─'.repeat(80));
  for (const email of USER_REASSIGNMENT.functional) {
    const user = userMap[email];
    if (!user) {
      console.log(`   ⚠️  User not found: ${email}`);
      continue;
    }

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: NEW_TEAMS.functional.id,
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

  // Business Development team
  console.log('\n📋 BUSINESS DEVELOPMENT TEAM');
  console.log('─'.repeat(80));
  for (const email of USER_REASSIGNMENT.business_dev) {
    const user = userMap[email];
    if (!user) {
      console.log(`   ⚠️  User not found: ${email}`);
      continue;
    }

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: NEW_TEAMS.business_dev.id,
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

  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 Final Team Structure:\n');

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

    console.log(`${team.name}: ${members?.length || 0} members`);
    console.log(`   ${team.description}`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Restructure complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Create new tasks for Functional and Business Development teams');
  console.log('   2. Restart desktop app to see the new team structure');
  console.log('═'.repeat(80));
}

restructureTeams()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


