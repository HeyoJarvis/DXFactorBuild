#!/usr/bin/env node

/**
 * Merge duplicate user accounts
 * - Update avi@heyjarvis.ai with the correct Slack ID (U09G4EL2CHM)
 * - Delete the duplicate avi@videofusion.io account
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

async function mergeUserAccounts() {
  console.log('🔧 Merging user accounts...\n');

  // Step 1: Get both accounts
  const { data: heyjarvisAccount, error: fetchError1 } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'avi@heyjarvis.ai')
    .single();

  const { data: videofusionAccount, error: fetchError2 } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'avi@videofusion.io')
    .single();

  if (fetchError1 || !heyjarvisAccount) {
    console.error('❌ Could not find avi@heyjarvis.ai account');
    process.exit(1);
  }

  if (fetchError2 || !videofusionAccount) {
    console.error('❌ Could not find avi@videofusion.io account');
    process.exit(1);
  }

  console.log('📋 Current state:');
  console.log('\nAccount 1 (KEEP):');
  console.log('  Email:', heyjarvisAccount.email);
  console.log('  Name:', heyjarvisAccount.name);
  console.log('  Slack ID:', heyjarvisAccount.slack_user_id);
  console.log('  Supabase ID:', heyjarvisAccount.id);

  console.log('\nAccount 2 (DELETE):');
  console.log('  Email:', videofusionAccount.email);
  console.log('  Name:', videofusionAccount.name);
  console.log('  Slack ID:', videofusionAccount.slack_user_id);
  console.log('  Supabase ID:', videofusionAccount.id);
  console.log('');

  // Step 2: Update avi@heyjarvis.ai with the correct Slack ID
  console.log('🔄 Updating avi@heyjarvis.ai with correct Slack ID (U09G4EL2CHM)...');
  const { error: updateError } = await supabase
    .from('users')
    .update({ slack_user_id: 'U09G4EL2CHM' })
    .eq('email', 'avi@heyjarvis.ai');

  if (updateError) {
    console.error('❌ Error updating avi@heyjarvis.ai:', updateError);
    process.exit(1);
  }

  console.log('✅ Updated avi@heyjarvis.ai with Slack ID: U09G4EL2CHM\n');

  // Step 3: Reassign any tasks from videofusion account to heyjarvis account
  console.log('🔄 Reassigning tasks from avi@videofusion.io to avi@heyjarvis.ai...');
  const { data: reassignedTasks, error: reassignError } = await supabase
    .from('conversation_sessions')
    .update({ user_id: heyjarvisAccount.id })
    .eq('user_id', videofusionAccount.id)
    .select();

  if (reassignError) {
    console.warn('⚠️ Error reassigning tasks:', reassignError);
  } else {
    console.log(`✅ Reassigned ${reassignedTasks?.length || 0} tasks\n`);
  }

  // Step 4: Delete the duplicate videofusion account
  console.log('🗑️ Deleting duplicate avi@videofusion.io account...');
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('email', 'avi@videofusion.io');

  if (deleteError) {
    console.error('❌ Error deleting avi@videofusion.io:', deleteError);
    process.exit(1);
  }

  console.log('✅ Deleted avi@videofusion.io account\n');

  // Step 5: Verify final state
  console.log('📋 Final state:');
  const { data: finalAccount, error: finalError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'avi@heyjarvis.ai')
    .single();

  if (finalError || !finalAccount) {
    console.error('❌ Error verifying final state');
    process.exit(1);
  }

  console.log('  Email:', finalAccount.email);
  console.log('  Name:', finalAccount.name);
  console.log('  Slack ID:', finalAccount.slack_user_id);
  console.log('  Supabase ID:', finalAccount.id);
  console.log('');
  console.log('🎉 Account merge complete! Now clear your auth cache and restart HeyJarvis.');
  console.log('');
  console.log('Run these commands:');
  console.log('  rm -rf ~/Library/Application\\ Support/heyjarvis-auth/');
  console.log('  cd /Users/jarvis/Code/HeyJarvis/desktop && npm run dev');
}

mergeUserAccounts().catch(console.error);
