/**
 * Check what scopes the current Microsoft token actually has
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

async function checkTokenScopes() {
  try {
    console.log('\n🔍 CHECKING CURRENT MICROSOFT TOKEN SCOPES\n');
    console.log('=' .repeat(70));

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get current Microsoft integration
    const { data: integration, error } = await supabase
      .from('team_sync_integrations')
      .select('*')
      .eq('service_name', 'microsoft')
      .order('connected_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !integration) {
      console.error('❌ No Microsoft integration found');
      process.exit(1);
    }

    console.log('📋 Current Integration:\n');
    console.log(`   User ID: ${integration.user_id}`);
    console.log(`   Connected: ${integration.connected_at}`);
    console.log(`   Last Synced: ${integration.last_synced_at}`);
    console.log(`   Token Expiry: ${integration.token_expiry}\n`);

    // Check metadata for scope information
    if (integration.metadata && integration.metadata.scope) {
      const scopes = integration.metadata.scope.split(' ');
      
      console.log('✅ Token Scopes Currently Granted:\n');
      scopes.forEach((scope, i) => {
        console.log(`   ${i + 1}. ${scope}`);
      });
      console.log('');
      
      // Check for transcript-related scopes
      const hasTranscriptRead = scopes.some(s => s.includes('OnlineMeetingTranscript'));
      const hasRecordingRead = scopes.some(s => s.includes('OnlineMeetingRecording'));
      const hasAIInsight = scopes.some(s => s.includes('OnlineMeetingAIInsight'));
      const hasArtifact = scopes.some(s => s.includes('OnlineMeetingArtifact'));
      
      console.log('=' .repeat(70));
      console.log('\n🎯 TRANSCRIPT-RELATED PERMISSIONS:\n');
      console.log(`   OnlineMeetingTranscript.Read: ${hasTranscriptRead ? '✅ YES' : '❌ NO'}`);
      console.log(`   OnlineMeetingRecording.Read:  ${hasRecordingRead ? '✅ YES' : '❌ NO'}`);
      console.log(`   OnlineMeetingAIInsight.Read:  ${hasAIInsight ? '✅ YES' : '❌ NO'}`);
      console.log(`   OnlineMeetingArtifact.Read:   ${hasArtifact ? '✅ YES' : '❌ NO'}`);
      console.log('');
      
      if (!hasTranscriptRead || !hasRecordingRead || !hasAIInsight) {
        console.log('⚠️  MISSING TRANSCRIPT PERMISSIONS!\n');
        console.log('The current token does NOT have transcript permissions.');
        console.log('This is why you\'re getting 403/404 errors.\n');
        console.log('📋 TO FIX:\n');
        console.log('   1. Open the Team Sync app');
        console.log('   2. Go to Settings');
        console.log('   3. Click "Disconnect" next to Microsoft');
        console.log('   4. Click "Connect" to reconnect with updated scopes');
        console.log('   5. Authorize the new permissions\n');
        console.log('After reconnecting, the token will have transcript permissions! ✅\n');
      } else {
        console.log('✅ All transcript permissions are present!\n');
        console.log('The 404 errors mean the meeting truly has no transcript available.\n');
      }
      
    } else {
      console.log('⚠️  No scope information in metadata');
      console.log('This is an old token format. Please reconnect Microsoft.\n');
    }

    console.log('=' .repeat(70));
    console.log('\n📝 REQUIRED SCOPES FOR TRANSCRIPTS:\n');
    const requiredScopes = [
      'User.Read',
      'Calendars.ReadWrite',
      'OnlineMeetings.ReadWrite',
      'OnlineMeetingTranscript.Read',
      'OnlineMeetingRecording.Read',
      'OnlineMeetingAIInsight.Read',
      'OnlineMeetingArtifact.Read',
      'Files.Read.All',
      'Mail.Read',
      'offline_access'
    ];
    
    requiredScopes.forEach((scope, i) => {
      console.log(`   ${i + 1}. ${scope}`);
    });
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkTokenScopes();


