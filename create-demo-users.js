/**
 * Create Test Users for Demo
 * Cleans existing team memberships and creates 3-5 members per team with realistic names and roles
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Define test users for each team
// Note: user_role must be one of: 'developer', 'sales', 'admin' (from database enum)
const TEST_USERS = {
  engineering: [
    { name: 'Alice Chen', email: 'alice.chen@beachbaby.demo', role: 'senior_engineer', user_role: 'developer' },
    { name: 'Bob Martinez', email: 'bob.martinez@beachbaby.demo', role: 'engineer', user_role: 'developer' },
    { name: 'Carol Johnson', email: 'carol.johnson@beachbaby.demo', role: 'engineer', user_role: 'developer' },
    { name: 'David Kim', email: 'david.kim@beachbaby.demo', role: 'lead_engineer', user_role: 'developer' },
  ],
  sales: [
    { name: 'Emma Wilson', email: 'emma.wilson@beachbaby.demo', role: 'account_executive', user_role: 'sales' },
    { name: 'Frank Rodriguez', email: 'frank.rodriguez@beachbaby.demo', role: 'sales_rep', user_role: 'sales' },
    { name: 'Grace Taylor', email: 'grace.taylor@beachbaby.demo', role: 'sales_manager', user_role: 'sales' },
    { name: 'Henry Brown', email: 'henry.brown@beachbaby.demo', role: 'sales_rep', user_role: 'sales' },
  ],
  product: [
    { name: 'Iris Anderson', email: 'iris.anderson@beachbaby.demo', role: 'product_manager', user_role: 'developer' },
    { name: 'Jack Lee', email: 'jack.lee@beachbaby.demo', role: 'product_designer', user_role: 'developer' },
    { name: 'Kelly Davis', email: 'kelly.davis@beachbaby.demo', role: 'ux_researcher', user_role: 'developer' },
    { name: 'Leo White', email: 'leo.white@beachbaby.demo', role: 'product_analyst', user_role: 'developer' },
  ],
  marketing: [
    { name: 'Maya Garcia', email: 'maya.garcia@beachbaby.demo', role: 'content_manager', user_role: 'sales' },
    { name: 'Nathan Miller', email: 'nathan.miller@beachbaby.demo', role: 'seo_specialist', user_role: 'sales' },
    { name: 'Olivia Harris', email: 'olivia.harris@beachbaby.demo', role: 'brand_manager', user_role: 'sales' },
    { name: 'Paul Clark', email: 'paul.clark@beachbaby.demo', role: 'social_media', user_role: 'sales' },
    { name: 'Quinn Lewis', email: 'quinn.lewis@beachbaby.demo', role: 'marketing_analyst', user_role: 'sales' },
  ],
  executive: [
    { name: 'Rachel Thompson', email: 'rachel.thompson@beachbaby.demo', role: 'ceo', user_role: 'admin' },
    { name: 'Steven Walker', email: 'steven.walker@beachbaby.demo', role: 'cto', user_role: 'admin' },
    { name: 'Tina Young', email: 'tina.young@beachbaby.demo', role: 'cfo', user_role: 'admin' },
  ],
};

const TEAM_IDS = {
  engineering: '00000000-0000-0000-0000-000000000001',
  sales: '00000000-0000-0000-0000-000000000002',
  product: '00000000-0000-0000-0000-000000000003',
  marketing: '00000000-0000-0000-0000-000000000004',
  executive: '00000000-0000-0000-0000-000000000005',
};

/**
 * Clear all existing members from the 5 demo teams
 */
async function clearExistingTeamMembers() {
  console.log('🧹 Clearing existing team members from demo teams...\n');
  
  let totalRemoved = 0;
  
  for (const [teamName, teamId] of Object.entries(TEAM_IDS)) {
    // Get current members
    const { data: currentMembers } = await supabase
      .from('team_members')
      .select('user_id, is_active')
      .eq('team_id', teamId);

    if (currentMembers && currentMembers.length > 0) {
      console.log(`   ${teamName}: Found ${currentMembers.length} existing member(s)`);
      
      // Delete all team_members records for this team
      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId);

      if (deleteError) {
        console.error(`   ❌ Failed to clear ${teamName}:`, deleteError.message);
      } else {
        console.log(`   ✅ Cleared ${currentMembers.length} member(s) from ${teamName}`);
        totalRemoved += currentMembers.length;
      }
    } else {
      console.log(`   ${teamName}: No existing members (already clean)`);
    }
  }

  console.log(`\n✅ Removed ${totalRemoved} total team memberships\n`);
  return totalRemoved;
}

/**
 * Optional: Remove old test users from database
 */
async function removeOldTestUsers() {
  console.log('🧹 Removing old test users from database...\n');
  
  const { data: oldTestUsers } = await supabase
    .from('users')
    .select('id, email, name')
    .like('email', '%@beachbaby.demo');

  if (!oldTestUsers || oldTestUsers.length === 0) {
    console.log('   No old test users found.');
    return 0;
  }

  console.log(`   Found ${oldTestUsers.length} old test user(s) to remove:`);
  
  for (const user of oldTestUsers) {
    console.log(`      - ${user.name} (${user.email})`);
  }

  // Delete all test users (cascade will remove their team_members entries)
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .like('email', '%@beachbaby.demo');

  if (deleteError) {
    console.error(`   ❌ Failed to delete test users:`, deleteError.message);
    return 0;
  }

  console.log(`\n✅ Removed ${oldTestUsers.length} old test user(s)\n`);
  return oldTestUsers.length;
}

async function createTestUsers() {
  console.log('🚀 Creating test users for demo...\n');
  console.log('═'.repeat(80));

  // Step 1: Clear existing team memberships
  await clearExistingTeamMembers();
  
  // Step 2: Remove old test users (optional but recommended for clean slate)
  await removeOldTestUsers();

  console.log('═'.repeat(80));
  console.log('\n📝 Creating fresh test users...\n');

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const [teamName, users] of Object.entries(TEST_USERS)) {
    const teamId = TEAM_IDS[teamName];
    console.log(`\n📋 ${teamName.toUpperCase()} Team (${teamId})`);
    console.log('─'.repeat(80));

    for (const userData of users) {
      try {
        // Create new user (should not exist after cleanup)
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: userData.email,
            name: userData.name,
            user_role: userData.user_role,
            auth_provider: 'demo',
            email_verified: true,
            onboarding_completed: true,
            is_active: true,
          })
          .select()
          .single();

        if (userError) {
          // Handle case where user might still exist
          if (userError.code === '23505') { // Unique violation
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('email', userData.email)
              .single();
            
            if (existingUser) {
              console.log(`   ⏭️  User already exists: ${userData.email}`);
              const userId = existingUser.id;
              totalSkipped++;

              // Still add them to team if not already there
              const { error: memberError } = await supabase
                .from('team_members')
                .insert({
                  team_id: teamId,
                  user_id: userId,
                  role: 'member',
                  is_active: true,
                  joined_at: new Date().toISOString(),
                });

              if (memberError && memberError.code !== '23505') {
                console.error(`      ❌ Failed to add to team:`, memberError.message);
              } else if (!memberError) {
                console.log(`      → Added to ${teamName} team`);
              }
            } else {
              console.error(`   ❌ Failed to create ${userData.email}:`, userError.message);
              continue;
            }
          } else {
            console.error(`   ❌ Failed to create ${userData.email}:`, userError.message);
            continue;
          }
        } else {
          const userId = newUser.id;
          console.log(`   ✅ Created user: ${userData.name} (${userData.email})`);
          totalCreated++;

          // Add user to team
          const { error: memberError } = await supabase
            .from('team_members')
            .insert({
              team_id: teamId,
              user_id: userId,
              role: 'member',
              is_active: true,
              joined_at: new Date().toISOString(),
            });

          if (memberError) {
            console.error(`      ❌ Failed to add to team:`, memberError.message);
          } else {
            console.log(`      → Added to ${teamName} team`);
          }
        }

      } catch (error) {
        console.error(`   ❌ Error processing ${userData.email}:`, error.message);
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`✅ Test user creation complete!`);
  console.log(`   Created: ${totalCreated} new users`);
  console.log(`   Skipped: ${totalSkipped} existing users`);
  console.log(`   Total:   ${totalCreated + totalSkipped} users ready for demo`);
  console.log('═'.repeat(80));

  // Show summary per team
  console.log('\n📊 Final Team Summary:');
  console.log('─'.repeat(80));
  
  for (const [teamName, teamId] of Object.entries(TEAM_IDS)) {
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('is_active', true);

    const { data: memberDetails } = await supabase
      .from('team_members')
      .select(`
        user_id,
        users!inner (
          name,
          email
        )
      `)
      .eq('team_id', teamId)
      .eq('is_active', true);

    console.log(`\n   ${teamName.toUpperCase()}: ${members?.length || 0} members`);
    if (memberDetails && memberDetails.length > 0) {
      memberDetails.forEach(m => {
        console.log(`      • ${m.users.name} (${m.users.email})`);
      });
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('💡 TIP: Run "node check-teams-data.js" to verify the setup');
  console.log('═'.repeat(80));
}

async function cleanupAllTestData() {
  console.log('🧹 Complete cleanup of all test data...\n');
  console.log('═'.repeat(80));
  
  await clearExistingTeamMembers();
  await removeOldTestUsers();
  
  console.log('═'.repeat(80));
  console.log('✅ All test data cleaned up!');
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'cleanup') {
  cleanupAllTestData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} else {
  createTestUsers()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

