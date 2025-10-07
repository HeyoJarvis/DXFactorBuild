#!/usr/bin/env node

/**
 * Fix Slack ID mismatch in Supabase
 * Updates Avi's Slack ID from old bot (U09GJSJLDNW) to new bot (U09G4EL2CHM)
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

async function fixSlackIdMismatch() {
  console.log('🔧 Fixing Slack ID mismatch...\n');

  // First, check current state
  console.log('📋 Current state:');
  const { data: currentUser, error: fetchError } = await supabase
    .from('users')
    .select('id, email, name, slack_user_id')
    .eq('email', 'avi@heyjarvis.ai')
    .single();

  if (fetchError) {
    console.error('❌ Error fetching user:', fetchError);
    process.exit(1);
  }

  console.log('Current Slack ID:', currentUser.slack_user_id);
  console.log('Email:', currentUser.email);
  console.log('Name:', currentUser.name);
  console.log('');

  // Update to correct Slack ID
  console.log('🔄 Updating Slack ID from U09GJSJLDNW to U09G4EL2CHM...');
  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ slack_user_id: 'U09G4EL2CHM' })
    .eq('email', 'avi@heyjarvis.ai')
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error updating user:', updateError);
    process.exit(1);
  }

  console.log('✅ Updated successfully!\n');
  console.log('📋 New state:');
  console.log('New Slack ID:', updatedUser.slack_user_id);
  console.log('Email:', updatedUser.email);
  console.log('Name:', updatedUser.name);
  console.log('');
  console.log('🎉 Slack ID mismatch fixed! Restart HeyJarvis to see your tasks.');
}

fixSlackIdMismatch().catch(console.error);
