#!/usr/bin/env node

/**
 * Check all users in Supabase to find the duplicate
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllUsers() {
  console.log('👥 All users in database:\n');

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, slack_user_id, slack_team_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching users:', error);
    process.exit(1);
  }

  users.forEach((user, index) => {
    console.log(`User ${index + 1}:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Slack ID: ${user.slack_user_id}`);
    console.log(`  Slack Team: ${user.slack_team_id}`);
    console.log(`  Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log('');
  });

  console.log(`Total users: ${users.length}`);
}

checkAllUsers().catch(console.error);
