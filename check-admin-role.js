#!/usr/bin/env node

/**
 * Check if current user has admin role
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdminRole() {
  console.log('🔍 Checking user roles and teams...\n');

  try {
    // Get all users with their roles
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, user_role, name')
      .order('email');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      return;
    }

    console.log('📋 Users in database:');
    console.log('─────────────────────────────────────────────────────────');
    users.forEach(user => {
      const roleIcon = user.user_role === 'admin' ? '🔑' : user.user_role === 'developer' ? '👨‍💻' : '💼';
      console.log(`${roleIcon} ${user.email}`);
      console.log(`   Role: ${user.user_role || 'none'}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   ID: ${user.id}`);
      console.log('');
    });

    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, slug')
      .order('name');

    if (teamsError) {
      console.error('❌ Error fetching teams:', teamsError.message);
      return;
    }

    console.log('\n🏢 Teams in database:');
    console.log('─────────────────────────────────────────────────────────');
    teams.forEach(team => {
      console.log(`📁 ${team.name} (${team.slug})`);
      console.log(`   ID: ${team.id}`);
    });

    // Get team memberships
    console.log('\n👥 Team Memberships:');
    console.log('─────────────────────────────────────────────────────────');
    
    for (const user of users) {
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select(`
          team_id,
          role,
          is_active,
          teams (name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!memberError && memberships?.length > 0) {
        console.log(`\n${user.email}:`);
        memberships.forEach(m => {
          console.log(`  ├─ ${m.teams.name} (${m.role})`);
        });
      }
    }

    console.log('\n\n✅ Check complete!');
    console.log('\n💡 To make a user an admin, run:');
    console.log('   UPDATE users SET user_role = \'admin\' WHERE email = \'your-email@example.com\';');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkAdminRole();



