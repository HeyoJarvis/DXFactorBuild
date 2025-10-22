/**
 * Test the complete transcript workflow:
 * 1. Fetch meetings from calendar
 * 2. Extract online meeting IDs
 * 3. Save to database
 * 4. Fetch transcripts for ended meetings
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');
const MeetingIntelligenceService = require('./main/services/MeetingIntelligenceService');
const AutomatedTranscriptService = require('./main/services/AutomatedTranscriptService');
const BackgroundSyncService = require('./main/services/BackgroundSyncService');

async function testFullWorkflow() {
  try {
    console.log('\n🧪 TESTING COMPLETE TRANSCRIPT WORKFLOW\n');
    console.log('=' .repeat(70));

    // Initialize all services
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const supabaseAdapter = new TeamSyncSupabaseAdapter({ supabase });

    const oauthService = new MicrosoftOAuthService({
      logger: console,
      supabaseAdapter
    });

    const microsoftService = new StandaloneMicrosoftService({
      logger: console,
      oauthService,
      supabaseAdapter
    });

    const meetingIntelligenceService = new MeetingIntelligenceService({
      microsoftService,
      supabaseAdapter,
      logger: console
    });

    const automatedTranscriptService = new AutomatedTranscriptService({
      microsoftService,
      supabaseAdapter,
      logger: console
    });

    const backgroundSyncService = new BackgroundSyncService({
      meetingIntelligenceService,
      automatedTranscriptService,
      logger: console
    });

    // Get user
    const { data: integration } = await supabase
      .from('team_sync_integrations')
      .select('user_id')
      .eq('service_name', 'microsoft')
      .single();

    if (!integration) {
      console.error('❌ No Microsoft integration found');
      process.exit(1);
    }

    const userId = integration.user_id;
    console.log(`✅ User ID: ${userId}\n`);

    // STEP 1: Fetch and sync meetings
    console.log('=' .repeat(70));
    console.log('\n📅 STEP 1: Syncing meetings from Microsoft Calendar\n');

    const result = await meetingIntelligenceService.getUpcomingMeetings(userId, {
      days: 14,
      saveToDatabase: true
    });

    if (result.success) {
      console.log(`✅ Synced ${result.meetings.length} meetings`);
      console.log(`   Important meetings: ${result.meetings.filter(m => m.importance_score >= 70).length}`);
      console.log(`   Teams meetings: ${result.meetings.filter(m => m.online_meeting_url).length}`);

      const teamsWithId = result.meetings.filter(m => m.online_meeting_id);
      console.log(`   Teams meetings with extracted IDs: ${teamsWithId.length}`);

      if (teamsWithId.length > 0) {
        console.log('\n   Teams meetings with IDs:');
        teamsWithId.forEach(m => {
          console.log(`   - ${m.title}`);
          console.log(`     Online Meeting ID: ${m.online_meeting_id.substring(0, 40)}...`);
        });
      }
    } else {
      console.error('❌ Failed to sync meetings:', result.error);
      process.exit(1);
    }

    // STEP 2: Check what's in database
    console.log('\n=' .repeat(70));
    console.log('\n💾 STEP 2: Checking database\n');

    const { data: dbMeetings } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(10);

    console.log(`Found ${dbMeetings.length} meetings in database (showing last 10):\n`);

    dbMeetings.forEach((m, i) => {
      console.log(`${i + 1}. ${m.title}`);
      console.log(`   Start: ${m.start_time}`);
      console.log(`   Platform: ${m.platform || 'Not set'}`);
      console.log(`   Has online meeting ID: ${m.metadata?.online_meeting_id ? 'Yes ✅' : 'No'}`);
      console.log(`   Has transcript: ${m.metadata?.transcript ? 'Yes ✅' : 'No'}`);
      if (m.metadata?.online_meeting_id) {
        console.log(`   Online Meeting ID: ${m.metadata.online_meeting_id.substring(0, 40)}...`);
      }
      console.log('');
    });

    // STEP 3: Try to fetch transcripts for ended meetings
    console.log('=' .repeat(70));
    console.log('\n📥 STEP 3: Fetching transcripts for ended meetings\n');

    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: endedMeetings } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'microsoft')
      .lt('end_time', now)
      .gte('end_time', sevenDaysAgo);

    console.log(`Found ${endedMeetings?.length || 0} ended Teams meetings in last 7 days\n`);

    if (endedMeetings && endedMeetings.length > 0) {
      const needingTranscripts = endedMeetings.filter(m =>
        m.metadata?.online_meeting_id && !m.metadata?.transcript
      );

      console.log(`${needingTranscripts.length} meetings need transcripts:\n`);

      for (const meeting of needingTranscripts) {
        console.log(`\n   Testing: "${meeting.title}"`);
        console.log(`   Ended: ${meeting.end_time}`);
        console.log(`   Online Meeting ID: ${meeting.metadata.online_meeting_id}`);

        try {
          const transcriptResult = await automatedTranscriptService.fetchTranscriptForMeeting(
            userId,
            meeting
          );

          if (transcriptResult.success && transcriptResult.transcript) {
            console.log(`   ✅ ✅ ✅ TRANSCRIPT FOUND!`);
            console.log(`   Length: ${transcriptResult.transcript.length} characters`);
            console.log(`   Has Copilot notes: ${transcriptResult.copilotNotes ? 'Yes' : 'No'}`);
            console.log(`   Source: ${transcriptResult.metadata?.source}`);
            console.log(`\n   Preview (first 200 chars):`);
            console.log(`   ${transcriptResult.transcript.substring(0, 200)}...`);

            // Save to database
            console.log(`\n   💾 Saving to database...`);
            const { error: saveError } = await supabase
              .from('team_meetings')
              .update({
                metadata: {
                  ...meeting.metadata,
                  transcript: transcriptResult.transcript,
                  copilot_notes: transcriptResult.copilotNotes,
                  transcript_metadata: transcriptResult.metadata,
                  transcript_fetched_at: new Date().toISOString()
                }
              })
              .eq('meeting_id', meeting.meeting_id);

            if (saveError) {
              console.error(`   ❌ Failed to save: ${saveError.message}`);
            } else {
              console.log(`   ✅ Saved to database!`);
            }
          } else {
            console.log(`   ⚠️  No transcript available`);
            console.log(`   Reason: ${transcriptResult.error || 'Unknown'}`);
          }
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
        }
      }
    } else {
      console.log('⚠️  No ended meetings found to test with');
      console.log('   Schedule a Teams meeting with recording/transcription enabled');
      console.log('   Wait for it to end, then run this test again');
    }

    // STEP 4: Summary
    console.log('\n=' .repeat(70));
    console.log('\n📊 SUMMARY\n');

    const { data: finalCount } = await supabase
      .from('team_meetings')
      .select('meeting_id, metadata')
      .eq('user_id', userId);

    const withTranscripts = finalCount?.filter(m => m.metadata?.transcript) || [];
    const withOnlineId = finalCount?.filter(m => m.metadata?.online_meeting_id) || [];

    console.log(`Total meetings in database: ${finalCount?.length || 0}`);
    console.log(`Meetings with online meeting ID: ${withOnlineId.length}`);
    console.log(`Meetings with transcripts: ${withTranscripts.length}`);

    console.log('\n✅ Workflow test complete!');
    console.log('\n📋 What happens automatically:');
    console.log('   1. Every 15 minutes, app syncs meetings from calendar');
    console.log('   2. Online meeting IDs are extracted automatically');
    console.log('   3. Transcripts are fetched for ended meetings (if available)');
    console.log('   4. All meetings stored in database for easy access');

    console.log('\n⚙️  Background sync is configured to:');
    console.log('   - Check every 15 minutes');
    console.log('   - Fetch transcripts for ALL Teams meetings');
    console.log('   - Retry for 7 days after meeting ends');
    console.log('   - Save transcripts to database automatically');

    console.log('\n=' .repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testFullWorkflow();
