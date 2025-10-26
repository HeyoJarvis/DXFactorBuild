#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAdminRole() {
  console.log('🔧 Fixing admin role for shail@heyjarvis.ai...\n');

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ user_role: 'admin' })
      .eq('email', 'shail@heyjarvis.ai')
      .select();

    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }

    console.log('✅ Successfully updated role to admin!');
    console.log('User:', data[0].email);
    console.log('New Role:', data[0].user_role);
    console.log('\n💡 Please restart desktop2 or refresh the app for changes to take effect.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

fixAdminRole();


