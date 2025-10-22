/**
 * Extract online meeting IDs from URLs and fetch transcripts
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const AutomatedTranscriptService = require('./main/services/AutomatedTranscriptService');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');

async function extractAndFetchTranscripts() {
  try {
    console.log('\n🔍 EXTRACTING ONLINE MEETING IDs AND FETCHING TRANSCRIPTS\n');
    console.log('=' .repeat(60));

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

    const microsoftService = new StandaloneMicrosoftService({
      logger: console,
      oauthService,
      supabaseAdapter
    });

    const transcriptService = new AutomatedTranscriptService({
      microsoftService,
      supabaseAdapter,
      logger: console
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
    console.log(`✅ User ID: ${userId}\n`);

    // Get Graph client
    const accessToken = await oauthService.getAccessToken(userId);
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    // Get all meetings
    const { data: meetings } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    console.log(`Found ${meetings.length} meetings\n`);

    // Process each meeting
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`\nMEETING ${i + 1}: "${meeting.title}"`);
      console.log(`Meeting ID: ${meeting.meeting_id}`);
      console.log(`Is Important: ${meeting.is_important ? 'Yes ⭐' : 'No'}`);
      console.log(`Start: ${meeting.start_time}`);

      // Check if already has transcript
      if (meeting.metadata?.transcript) {
        console.log(`\n✅ ALREADY HAS TRANSCRIPT`);
        console.log(`   Length: ${meeting.metadata.transcript.length} characters`);
        console.log(`   Preview: ${meeting.metadata.transcript.substring(0, 200)}...`);
        continue;
      }

      // Check for online meeting URL
      const onlineMeetingUrl = meeting.metadata?.online_meeting_url;
      if (!onlineMeetingUrl) {
        console.log(`\n⚠️  No Teams meeting URL found`);
        continue;
      }

      console.log(`\n📹 Teams meeting detected`);
      console.log(`   URL: ${onlineMeetingUrl.substring(0, 80)}...`);

      // Try to get full event details from Graph API
      try {
        console.log(`\n📥 Fetching full event details from Graph API...`);

        const event = await client
          .api(`/me/events/${meeting.meeting_id}`)
          .select('id,subject,start,end,onlineMeeting,isOnlineMeeting,onlineMeetingUrl')
          .get();

        console.log(`   ✅ Event fetched`);
        console.log(`   Is online meeting: ${event.isOnlineMeeting}`);

        if (event.onlineMeeting) {
          console.log(`   ✅ Has onlineMeeting object`);

          // Check for conference ID
          if (event.onlineMeeting.conferenceId) {
            console.log(`   Conference ID: ${event.onlineMeeting.conferenceId}`);
          }

          // Check for join URL
          if (event.onlineMeeting.joinUrl) {
            console.log(`   Join URL: ${event.onlineMeeting.joinUrl.substring(0, 80)}...`);

            // Extract meeting ID from join URL
            // Format: https://teams.microsoft.com/l/meetup-join/19%3ameeting_XXX%40thread.v2/...
            let onlineMeetingId = null;

            // Try URL encoded format
            let match = event.onlineMeeting.joinUrl.match(/19%3ameeting_([^%]+)%40thread\.v2/);
            if (match) {
              onlineMeetingId = `19:meeting_${match[1]}@thread.v2`;
            } else {
              // Try non-encoded format
              match = event.onlineMeeting.joinUrl.match(/19:meeting_([^@]+)@thread\.v2/);
              if (match) {
                onlineMeetingId = `19:meeting_${match[1]}@thread.v2`;
              }
            }

            if (onlineMeetingId) {
              console.log(`\n🆔 EXTRACTED ONLINE MEETING ID: ${onlineMeetingId}`);

              // Update database with online meeting ID
              await supabase
                .from('team_meetings')
                .update({
                  metadata: {
                    ...meeting.metadata,
                    online_meeting_id: onlineMeetingId
                  }
                })
                .eq('meeting_id', meeting.meeting_id);

              console.log(`   ✅ Updated database with online meeting ID`);

              // Now try to fetch transcript
              console.log(`\n📥 Attempting to fetch transcript...`);

              const updatedMeeting = {
                ...meeting,
                metadata: {
                  ...meeting.metadata,
                  online_meeting_id: onlineMeetingId
                }
              };

              const result = await transcriptService.fetchTranscriptForMeeting(userId, updatedMeeting);

              if (result.success && result.transcript) {
                console.log(`\n✅ ✅ ✅ TRANSCRIPT FETCHED SUCCESSFULLY! ✅ ✅ ✅`);
                console.log(`   Length: ${result.transcript.length} characters`);
                console.log(`   Has Copilot notes: ${result.copilotNotes ? 'Yes' : 'No'}`);
                console.log(`   Source: ${result.metadata?.source || 'API'}`);
                console.log(`\n   Preview (first 300 characters):`);
                console.log(`   ${result.transcript.substring(0, 300)}...`);

                // Save transcript to database
                console.log(`\n💾 Saving transcript to database...`);
                const { error: updateError } = await supabase
                  .from('team_meetings')
                  .update({
                    metadata: {
                      ...updatedMeeting.metadata,
                      transcript: result.transcript,
                      copilot_notes: result.copilotNotes,
                      transcript_metadata: result.metadata,
                      transcript_fetched_at: new Date().toISOString()
                    }
                  })
                  .eq('meeting_id', meeting.meeting_id);

                if (updateError) {
                  console.error(`   ❌ Failed to save: ${updateError.message}`);
                } else {
                  console.log(`   ✅ Transcript saved to database!`);
                }
              } else {
                console.log(`\n⚠️  No transcript available`);
                console.log(`   Reason: ${result.error || 'Unknown'}`);
                console.log(`\n   Possible reasons:`);
                console.log(`   • Meeting not recorded`);
                console.log(`   • Transcript still processing (wait 5-10 min after meeting)`);
                console.log(`   • Recording/transcription not enabled`);
              }
            } else {
              console.log(`\n⚠️  Could not extract online meeting ID from URL`);
            }
          }
        } else {
          console.log(`   ℹ️  No onlineMeeting object in event`);
        }
      } catch (error) {
        console.error(`\n❌ Error processing meeting: ${error.message}`);
        if (error.statusCode) {
          console.error(`   Status code: ${error.statusCode}`);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n✅ PROCESSING COMPLETE\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

extractAndFetchTranscripts();
