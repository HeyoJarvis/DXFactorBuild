/**
 * Test Automated Transcript Fetching
 * Tests the new AutomatedTranscriptService with xyz standup meeting
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AutomatedTranscriptService = require('./main/services/AutomatedTranscriptService');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');

async function testAutomatedTranscript() {
  try {
    console.log('\n🤖 Testing Automated Transcript System\n');
    console.log('═══════════════════════════════════════════════\n');

    // Initialize services
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const supabaseAdapter = new TeamSyncSupabaseAdapter({
      supabase,
      logger: console
    });

    const oauthService = new MicrosoftOAuthService({
      supabaseAdapter,
      logger: console
    });

    const microsoftService = new StandaloneMicrosoftService({
      oauthService,
      supabaseAdapter,
      logger: console
    });

    const automatedTranscriptService = new AutomatedTranscriptService({
      microsoftService,
      supabaseAdapter,
      logger: console
    });

    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';

    // Get xyz standup meeting from database
    console.log('Step 1: Finding xyz standup meeting in database...\n');
    const { data: meetings, error } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', '%xyz%standup%')
      .order('start_time', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!meetings || meetings.length === 0) {
      console.log('❌ xyz standup meeting not found in database');
      console.log('\nTry syncing meetings first:');
      console.log('  1. Open the app');
      console.log('  2. Go to Meetings tab');
      console.log('  3. Click "Sync Now"');
      return;
    }

    const meeting = meetings[0];
    console.log('✅ Meeting Found:\n');
    console.log('   Title:', meeting.title);
    console.log('   Meeting ID:', meeting.meeting_id);
    console.log('   Start:', meeting.start_time);
    console.log('   End:', meeting.end_time);
    console.log('   Has Manual Notes:', !!meeting.manual_notes);
    console.log('   Has Copilot Notes:', !!meeting.copilot_notes);
    console.log('   Has Transcript:', !!meeting.metadata?.transcript);
    console.log('   Online Meeting ID:', meeting.metadata?.online_meeting_id || 'NOT CAPTURED');
    console.log('   Online Meeting URL:', meeting.metadata?.online_meeting_url || 'NONE');
    console.log('');

    // Check if online meeting ID exists
    if (!meeting.metadata?.online_meeting_id) {
      console.log('⚠️  WARNING: No online meeting ID captured!\n');
      console.log('This meeting might not have been a Teams meeting, or:');
      console.log('  - The meeting sync happened before the update');
      console.log('  - The Microsoft API didn\'t return the online meeting ID\n');
      console.log('To fix:');
      console.log('  1. Re-sync meetings (Meetings tab → "Sync Now")');
      console.log('  2. Ensure the meeting has a Teams invite\n');
      
      console.log('Attempting automated fetch anyway (will try OneDrive fallback)...\n');
    }

    // Test automated transcript fetching
    console.log('Step 2: Attempting automated transcript fetch...\n');
    console.log('This will try:');
    console.log('  1. Microsoft Graph API (onlineMeetings endpoint)');
    console.log('  2. OneDrive search (fallback)');
    console.log('  3. Multiple transcript formats (VTT, text, DOCX)\n');

    const result = await automatedTranscriptService.fetchTranscriptForMeeting(
      userId,
      meeting
    );

    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 RESULTS\n');

    if (result.success) {
      console.log('✅ SUCCESS! Transcript fetched automatically\n');
      
      if (result.transcript) {
        const preview = result.transcript.substring(0, 500);
        console.log('📝 Transcript:');
        console.log('   Available: YES');
        console.log('   Size:', result.transcript.length, 'characters');
        console.log('   Preview:', preview.substring(0, 200) + '...');
        console.log('');
      }

      if (result.copilotNotes) {
        const preview = result.copilotNotes.substring(0, 300);
        console.log('🤖 Copilot Notes:');
        console.log('   Available: YES');
        console.log('   Size:', result.copilotNotes.length, 'characters');
        console.log('   Preview:', preview + '...');
        console.log('');
      } else {
        console.log('🤖 Copilot Notes:');
        console.log('   Available: NO');
        console.log('   Note: AI summary will be generated from transcript instead');
        console.log('');
      }

      console.log('🔍 Metadata:');
      console.log('   Source:', result.metadata?.source || 'microsoft-api');
      console.log('   Transcript ID:', result.metadata?.transcriptId || result.metadata?.fileId);
      console.log('   Created:', result.metadata?.createdDateTime);
      console.log('   File Name:', result.metadata?.fileName || 'N/A');
      console.log('');

      console.log('═══════════════════════════════════════════════');
      console.log('✅ AUTOMATED SYSTEM IS WORKING!\n');
      console.log('Next steps:');
      console.log('  1. This transcript will be saved to database');
      console.log('  2. AI summary will be generated (if Copilot notes unavailable)');
      console.log('  3. Future important meetings will auto-fetch transcripts');
      console.log('  4. Background sync runs every 15 minutes');
      console.log('');

    } else {
      console.log('❌ Transcript Not Available\n');
      console.log('Error:', result.error);
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. Meeting wasn\'t recorded');
      console.log('  2. Transcript not generated yet (try again in 5-10 minutes)');
      console.log('  3. No online meeting ID captured (re-sync meetings)');
      console.log('  4. Transcript not accessible via API (check permissions)');
      console.log('  5. Recording not saved to OneDrive/SharePoint');
      console.log('');
      console.log('Solutions:');
      console.log('  ✓ Wait a bit longer and try again');
      console.log('  ✓ Re-authenticate Microsoft (Settings → Disconnect → Reconnect)');
      console.log('  ✓ Ensure auto-recording is enabled in Teams settings');
      console.log('  ✓ Or continue using manual copy-paste from Teams UI');
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error(error.stack);
  }
}

testAutomatedTranscript();


