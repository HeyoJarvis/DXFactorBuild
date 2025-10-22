/**
 * Test Microsoft Graph API transcript endpoints
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');

async function testTranscriptAPI() {
  try {
    console.log('\n🧪 TESTING MICROSOFT GRAPH TRANSCRIPT API\n');
    console.log('=' .repeat(70));

    // Initialize services
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const supabaseAdapter = new TeamSyncSupabaseAdapter({ supabase });

    const oauthService = new MicrosoftOAuthService({
      logger: console,
      supabaseAdapter
    });

    // Get authenticated user
    const { data: integration } = await supabase
      .from('team_sync_integrations')
      .select('user_id')
      .eq('service_name', 'microsoft')
      .order('connected_at', { ascending: false })
      .limit(1)
      .single();

    if (!integration) {
      console.error('❌ No Microsoft integration found');
      process.exit(1);
    }

    const userId = integration.user_id;
    console.log(`✅ Found user: ${userId}\n`);

    // Get access token
    const accessToken = await oauthService.getAccessToken(userId);
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    // Get meeting from database
    const { data: meeting } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .not('metadata->online_meeting_id', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .single();

    if (!meeting) {
      console.log('❌ No meetings with online_meeting_id found');
      process.exit(1);
    }

    const onlineMeetingId = meeting.metadata?.online_meeting_id;
    
    console.log('📋 Testing with meeting:\n');
    console.log(`   Title: ${meeting.title}`);
    console.log(`   Meeting ID: ${meeting.meeting_id}`);
    console.log(`   Online Meeting ID: ${onlineMeetingId}`);
    console.log(`   Start: ${meeting.start_time}\n`);
    console.log('=' .repeat(70));

    // Test 1: Get online meeting details
    console.log('\n1️⃣  Getting online meeting details...\n');
    try {
      const meetingDetails = await client
        .api(`/communications/onlineMeetings/${onlineMeetingId}`)
        .get();
      
      console.log('✅ Online meeting found:');
      console.log(`   Subject: ${meetingDetails.subject}`);
      console.log(`   Join URL: ${meetingDetails.joinUrl?.substring(0, 50)}...`);
      console.log(`   Created: ${meetingDetails.creationDateTime}`);
      console.log('');
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      console.log(`   Status: ${error.statusCode || 'Unknown'}\n`);
    }

    // Test 2: List transcripts
    console.log('2️⃣  Listing available transcripts...\n');
    try {
      const transcripts = await client
        .api(`/communications/onlineMeetings/${onlineMeetingId}/transcripts`)
        .get();
      
      if (transcripts.value && transcripts.value.length > 0) {
        console.log(`✅ Found ${transcripts.value.length} transcript(s):\n`);
        
        transcripts.value.forEach((t, i) => {
          console.log(`   ${i + 1}. Transcript ID: ${t.id}`);
          console.log(`      Created: ${t.createdDateTime}`);
          console.log(`      Meeting Organizer: ${t.meetingOrganizer?.user?.displayName || 'Unknown'}`);
          console.log('');
        });
        
        // Try to fetch the first transcript content
        const firstTranscript = transcripts.value[0];
        console.log('3️⃣  Fetching transcript content...\n');
        
        try {
          // Try VTT format
          const vttContent = await client
            .api(`/communications/onlineMeetings/${onlineMeetingId}/transcripts/${firstTranscript.id}/content`)
            .query({ $format: 'text/vtt' })
            .get();
          
          console.log('✅ VTT transcript fetched!');
          console.log(`   Size: ${vttContent.length} characters`);
          console.log('\n📖 PREVIEW (first 500 characters):\n');
          console.log('-'.repeat(70));
          console.log(vttContent.substring(0, 500));
          console.log('-'.repeat(70));
          console.log('...(truncated)\n');
          
        } catch (contentError) {
          console.log(`❌ Failed to fetch content: ${contentError.message}\n`);
        }
        
      } else {
        console.log('⚠️  No transcripts found for this meeting');
        console.log('\nThis usually means:');
        console.log('  1. Transcription was not enabled during the meeting');
        console.log('  2. The meeting just ended and transcript is being processed (wait 15-30 min)');
        console.log('  3. The meeting was too short (< 1 minute)');
        console.log('  4. Transcript has expired (kept for 60 days)\n');
      }
      
    } catch (error) {
      console.log(`❌ Failed to list transcripts: ${error.message}`);
      console.log(`   Status: ${error.statusCode || 'Unknown'}`);
      
      if (error.statusCode === 404) {
        console.log('\n💡 This 404 error means:');
        console.log('   - The online meeting ID is invalid, or');
        console.log('   - The meeting doesn\'t exist in Graph API, or');
        console.log('   - Transcripts are not available for this meeting\n');
      } else if (error.statusCode === 403) {
        console.log('\n💡 This 403 error means:');
        console.log('   - Missing permissions (OnlineMeetingTranscript.Read)');
        console.log('   - Need to reconnect Microsoft integration with updated scopes\n');
      }
      console.log('');
    }

    // Test 3: Check for recordings
    console.log('4️⃣  Checking for meeting recordings...\n');
    try {
      const recordings = await client
        .api(`/communications/onlineMeetings/${onlineMeetingId}/recordings`)
        .get();
      
      if (recordings.value && recordings.value.length > 0) {
        console.log(`✅ Found ${recordings.value.length} recording(s):\n`);
        
        recordings.value.forEach((r, i) => {
          console.log(`   ${i + 1}. Recording ID: ${r.id}`);
          console.log(`      Created: ${r.createdDateTime}`);
          console.log(`      Content URL: ${r.content?.substring(0, 50)}...`);
          console.log('');
        });
      } else {
        console.log('ℹ️  No recordings found via API\n');
      }
    } catch (recordingError) {
      console.log(`⚠️  Could not fetch recordings: ${recordingError.message}\n`);
    }

    console.log('=' .repeat(70));
    console.log('\n✅ TEST COMPLETE\n');
    
    console.log('📝 SUMMARY:\n');
    console.log('If transcripts are not available:');
    console.log('  → Record a NEW meeting with transcription enabled');
    console.log('  → Wait 15-30 minutes after meeting ends');
    console.log('  → Run this test again\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testTranscriptAPI();


