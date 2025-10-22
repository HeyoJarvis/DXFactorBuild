/**
 * Check existing meetings and try to fetch transcripts
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const AutomatedTranscriptService = require('./main/services/AutomatedTranscriptService');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');

async function checkExistingMeetings() {
  try {
    console.log('\n🔍 CHECKING EXISTING MEETINGS FOR TRANSCRIPTS\n');
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
    console.log(`✅ Found user: ${userId}\n`);

    // Get all meetings
    console.log('📋 Fetching all meetings from database...\n');

    const { data: allMeetings, error } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (error || !allMeetings) {
      console.error('❌ Failed to fetch meetings:', error);
      process.exit(1);
    }

    console.log(`Found ${allMeetings.length} total meetings\n`);
    console.log('=' .repeat(60));

    // Categorize meetings
    const meetingsWithTranscripts = [];
    const meetingsWithOnlineId = [];
    const teamsMeetings = [];
    const regularMeetings = [];

    allMeetings.forEach(meeting => {
      if (meeting.metadata?.transcript) {
        meetingsWithTranscripts.push(meeting);
      } else if (meeting.metadata?.online_meeting_id) {
        meetingsWithOnlineId.push(meeting);
      } else if (meeting.platform === 'microsoft' && meeting.meeting_url) {
        teamsMeetings.push(meeting);
      } else {
        regularMeetings.push(meeting);
      }
    });

    console.log('\n📊 MEETING BREAKDOWN:\n');
    console.log(`✅ Meetings with transcripts: ${meetingsWithTranscripts.length}`);
    console.log(`🆔 Meetings with online_meeting_id: ${meetingsWithOnlineId.length}`);
    console.log(`📹 Teams meetings (no ID yet): ${teamsMeetings.length}`);
    console.log(`📅 Regular meetings: ${regularMeetings.length}`);

    // Show meetings with transcripts
    if (meetingsWithTranscripts.length > 0) {
      console.log('\n' + '=' .repeat(60));
      console.log('\n📝 MEETINGS WITH EXISTING TRANSCRIPTS:\n');

      meetingsWithTranscripts.forEach((meeting, i) => {
        console.log(`${i + 1}. ${meeting.title}`);
        console.log(`   Meeting ID: ${meeting.meeting_id}`);
        console.log(`   Start: ${meeting.start_time}`);
        console.log(`   Platform: ${meeting.platform}`);
        console.log(`   Has transcript: YES ✅`);

        const transcript = meeting.metadata?.transcript;
        if (transcript) {
          console.log(`   Transcript length: ${transcript.length} characters`);
          console.log(`   Preview: ${transcript.substring(0, 100)}...`);
        }

        if (meeting.metadata?.copilot_notes) {
          console.log(`   Has Copilot notes: YES ✅`);
        }

        console.log('');
      });
    }

    // Try to fetch transcripts for meetings with online_meeting_id
    if (meetingsWithOnlineId.length > 0) {
      console.log('\n' + '=' .repeat(60));
      console.log('\n🔄 ATTEMPTING TO FETCH TRANSCRIPTS FOR MEETINGS WITH ONLINE IDs:\n');

      for (let i = 0; i < Math.min(meetingsWithOnlineId.length, 5); i++) {
        const meeting = meetingsWithOnlineId[i];
        console.log(`\n${i + 1}. "${meeting.title}"`);
        console.log(`   Meeting ID: ${meeting.meeting_id}`);
        console.log(`   Online Meeting ID: ${meeting.metadata?.online_meeting_id}`);
        console.log(`   Start: ${meeting.start_time}`);

        try {
          console.log('   📥 Fetching transcript...');

          const result = await transcriptService.fetchTranscriptForMeeting(userId, meeting);

          if (result.success && result.transcript) {
            console.log('   ✅ SUCCESS! Transcript fetched');
            console.log(`   Length: ${result.transcript.length} characters`);
            console.log(`   Has Copilot notes: ${result.copilotNotes ? 'Yes' : 'No'}`);
            console.log(`   Source: ${result.metadata?.source || 'API'}`);
            console.log(`   Preview: ${result.transcript.substring(0, 150)}...`);

            // Save to database
            console.log('   💾 Saving to database...');
            await supabase
              .from('team_meetings')
              .update({
                metadata: {
                  ...meeting.metadata,
                  transcript: result.transcript,
                  copilot_notes: result.copilotNotes,
                  transcript_metadata: result.metadata
                }
              })
              .eq('meeting_id', meeting.meeting_id);

            console.log('   ✅ Saved to database');
          } else {
            console.log(`   ⚠️  No transcript available: ${result.error || 'Unknown reason'}`);
          }
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    }

    // Try to extract online meeting IDs from Teams meetings
    if (teamsMeetings.length > 0) {
      console.log('\n' + '=' .repeat(60));
      console.log('\n🔍 CHECKING TEAMS MEETINGS WITHOUT ONLINE IDs:\n');

      const accessToken = await oauthService.getAccessToken(userId);
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });

      for (let i = 0; i < Math.min(teamsMeetings.length, 5); i++) {
        const meeting = teamsMeetings[i];
        console.log(`\n${i + 1}. "${meeting.title}"`);
        console.log(`   Meeting ID: ${meeting.meeting_id}`);
        console.log(`   Start: ${meeting.start_time}`);
        console.log(`   Meeting URL: ${meeting.meeting_url?.substring(0, 50)}...`);

        try {
          // Try to get the calendar event
          console.log('   📥 Fetching calendar event details...');

          const event = await client
            .api(`/me/events/${meeting.meeting_id}`)
            .select('id,subject,start,end,onlineMeeting,isOnlineMeeting')
            .get();

          if (event.onlineMeeting) {
            const joinUrl = event.onlineMeeting.joinUrl;
            console.log(`   ✅ Has online meeting data`);
            console.log(`   Join URL: ${joinUrl?.substring(0, 50)}...`);

            // Extract meeting ID from join URL
            // Format: https://teams.microsoft.com/l/meetup-join/19%3ameeting_XXX%40thread.v2/...
            const meetingIdMatch = joinUrl?.match(/19%3ameeting_([^%]+)%40thread\.v2/) ||
                                   joinUrl?.match(/19:meeting_([^@]+)@thread\.v2/);

            if (meetingIdMatch) {
              const onlineMeetingId = `19:meeting_${meetingIdMatch[1]}@thread.v2`;
              console.log(`   🆔 Extracted online meeting ID: ${onlineMeetingId}`);

              // Update database
              await supabase
                .from('team_meetings')
                .update({
                  metadata: {
                    ...meeting.metadata,
                    online_meeting_id: onlineMeetingId
                  }
                })
                .eq('meeting_id', meeting.meeting_id);

              console.log('   ✅ Updated database with online meeting ID');

              // Try to fetch transcript
              console.log('   📥 Attempting to fetch transcript...');
              const updatedMeeting = { ...meeting, metadata: { ...meeting.metadata, online_meeting_id: onlineMeetingId } };
              const result = await transcriptService.fetchTranscriptForMeeting(userId, updatedMeeting);

              if (result.success && result.transcript) {
                console.log('   ✅ Transcript found!');
                console.log(`   Length: ${result.transcript.length} characters`);
              } else {
                console.log(`   ⚠️  No transcript: ${result.error || 'Not available'}`);
              }
            } else {
              console.log('   ⚠️  Could not extract meeting ID from join URL');
            }
          } else {
            console.log('   ℹ️  Not an online meeting');
          }
        } catch (error) {
          console.log(`   ⚠️  Could not fetch event: ${error.message}`);
        }
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ SCAN COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkExistingMeetings();
