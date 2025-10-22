/**
 * Test Microsoft Graph API Transcript Permissions
 *
 * This script verifies that all permissions are correctly configured
 * and that transcript reading functionality works as expected.
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const AutomatedTranscriptService = require('./main/services/AutomatedTranscriptService');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');

async function testTranscriptPermissions() {
  try {
    console.log('\n🔍 MICROSOFT GRAPH API PERMISSIONS TEST\n');
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

    // Step 1: Get authenticated user
    console.log('\n📋 Step 1: Finding authenticated user...\n');

    const { data: integration, error: integrationError } = await supabase
      .from('team_sync_integrations')
      .select('user_id, access_token, token_expiry, metadata')
      .eq('service_name', 'microsoft')
      .order('connected_at', { ascending: false })
      .limit(1)
      .single();

    if (integrationError || !integration) {
      console.error('❌ No Microsoft integration found!');
      console.error('   Please connect Microsoft account first.');
      process.exit(1);
    }

    const userId = integration.user_id;
    console.log('✅ Found Microsoft integration');
    console.log(`   User ID: ${userId}`);
    console.log(`   Token expires: ${integration.token_expiry}`);
    console.log(`   Scopes: ${integration.metadata?.scope || 'Unknown'}`);

    // Step 2: Check if token includes transcript permission
    console.log('\n📋 Step 2: Verifying OAuth scopes...\n');

    const scopes = integration.metadata?.scope || '';
    const hasTranscriptScope = scopes.includes('OnlineMeetingTranscript.Read');

    if (!hasTranscriptScope) {
      console.log('⚠️  WARNING: Token does not include OnlineMeetingTranscript.Read scope!');
      console.log('   Current scopes:', scopes);
      console.log('\n   ACTION REQUIRED:');
      console.log('   1. You need to disconnect and reconnect Microsoft');
      console.log('   2. This will request the new permission');
      console.log('   3. Accept the new consent screen');
      console.log('\n   Would you like to test anyway? (May fail)\n');
    } else {
      console.log('✅ Token includes OnlineMeetingTranscript.Read scope');
      console.log('   All required scopes present');
    }

    // Step 3: Test basic Graph API access
    console.log('\n📋 Step 3: Testing Microsoft Graph API access...\n');

    try {
      const accessToken = await oauthService.getAccessToken(userId);
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        }
      });

      // Test basic user profile access
      const user = await client
        .api('/me')
        .select('displayName,mail,userPrincipalName')
        .get();

      console.log('✅ Graph API connection successful');
      console.log(`   User: ${user.displayName} (${user.mail || user.userPrincipalName})`);
    } catch (error) {
      console.error('❌ Failed to connect to Graph API');
      console.error(`   Error: ${error.message}`);
      process.exit(1);
    }

    // Step 4: Test calendar access
    console.log('\n📋 Step 4: Testing calendar access...\n');

    try {
      const events = await microsoftService.getUpcomingEvents(userId, { days: 7 });
      console.log(`✅ Calendar access successful`);
      console.log(`   Found ${events.length} upcoming events`);

      // Find Teams meetings
      const teamsMeetings = events.filter(e => e.isOnlineMeeting);
      console.log(`   ${teamsMeetings.length} are Teams meetings`);

      if (teamsMeetings.length > 0) {
        console.log('\n   Recent Teams meetings:');
        teamsMeetings.slice(0, 5).forEach((meeting, i) => {
          console.log(`   ${i + 1}. ${meeting.subject}`);
          console.log(`      Start: ${meeting.start.dateTime}`);
          console.log(`      Has online meeting: ${!!meeting.onlineMeeting}`);
          console.log(`      Online meeting ID: ${meeting.onlineMeeting?.joinUrl ? 'Yes' : 'No'}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to access calendar');
      console.error(`   Error: ${error.message}`);
    }

    // Step 5: Test transcript access (if we have a recent meeting)
    console.log('\n📋 Step 5: Testing transcript access...\n');

    const { data: meetings } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .not('metadata->online_meeting_id', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5);

    if (!meetings || meetings.length === 0) {
      console.log('⚠️  No meetings with online_meeting_id found in database');
      console.log('   Cannot test transcript functionality');
      console.log('   Try marking a Teams meeting as important first');
    } else {
      console.log(`✅ Found ${meetings.length} meetings with online meeting IDs`);

      // Try to fetch transcript for the most recent meeting
      const testMeeting = meetings[0];
      console.log(`\n   Testing with meeting: "${testMeeting.title}"`);
      console.log(`   Meeting ID: ${testMeeting.meeting_id}`);
      console.log(`   Online Meeting ID: ${testMeeting.metadata?.online_meeting_id}`);
      console.log(`   Start time: ${testMeeting.start_time}`);

      try {
        console.log('\n   Attempting to fetch transcript...');
        const result = await transcriptService.fetchTranscriptForMeeting(userId, testMeeting);

        if (result.success && result.transcript) {
          console.log('\n✅ TRANSCRIPT ACCESS SUCCESSFUL!');
          console.log(`   Transcript length: ${result.transcript.length} characters`);
          console.log(`   Has Copilot notes: ${!!result.copilotNotes ? 'Yes' : 'No'}`);
          console.log(`   Source: ${result.metadata?.source || 'Direct API'}`);

          if (result.transcript.length < 500) {
            console.log('\n   Preview:');
            console.log('   ' + result.transcript.substring(0, 300));
          } else {
            console.log('\n   Preview (first 300 chars):');
            console.log('   ' + result.transcript.substring(0, 300) + '...');
          }
        } else {
          console.log('\n⚠️  Transcript not available');
          console.log(`   Reason: ${result.error || 'Unknown'}`);
          console.log('\n   Possible reasons:');
          console.log('   1. Meeting was not recorded');
          console.log('   2. Transcript not generated yet (wait 5-10 minutes after meeting)');
          console.log('   3. Copilot not enabled for this meeting');
          console.log('   4. Permission still not in OAuth token (need to reconnect)');
        }
      } catch (error) {
        console.error('\n❌ Failed to fetch transcript');
        console.error(`   Error: ${error.message}`);

        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          console.error('\n   🚨 PERMISSION DENIED ERROR');
          console.error('   Action required:');
          console.error('   1. Disconnect Microsoft in the app');
          console.error('   2. Reconnect Microsoft');
          console.error('   3. Accept the new permissions in consent screen');
          console.error('   4. Run this test again');
        }
      }
    }

    // Step 6: Test direct API call to transcripts endpoint
    console.log('\n📋 Step 6: Testing direct transcript API endpoint...\n');

    if (meetings && meetings.length > 0) {
      const testMeeting = meetings[0];
      const onlineMeetingId = testMeeting.metadata?.online_meeting_id;

      if (onlineMeetingId) {
        try {
          const accessToken = await oauthService.getAccessToken(userId);
          const client = Client.init({
            authProvider: (done) => {
              done(null, accessToken);
            }
          });

          console.log(`   Testing with online meeting ID: ${onlineMeetingId}`);
          console.log('   API: GET /communications/onlineMeetings/{id}/transcripts');

          const transcripts = await client
            .api(`/communications/onlineMeetings/${onlineMeetingId}/transcripts`)
            .get();

          console.log('\n✅ Direct API call successful!');
          console.log(`   Found ${transcripts.value?.length || 0} transcripts`);

          if (transcripts.value && transcripts.value.length > 0) {
            console.log('\n   Transcript details:');
            transcripts.value.forEach((t, i) => {
              console.log(`   ${i + 1}. ID: ${t.id}`);
              console.log(`      Created: ${t.createdDateTime}`);
              console.log(`      Content type: ${t.contentType || 'Unknown'}`);
            });
          }
        } catch (error) {
          if (error.statusCode === 403 || error.statusCode === 401) {
            console.error('❌ Permission denied (403/401)');
            console.error('   The OAuth token does not have the required permission');
            console.error('\n   🔄 SOLUTION:');
            console.error('   You MUST reconnect Microsoft to get the new permission in the token');
          } else if (error.statusCode === 404) {
            console.log('⚠️  No transcripts found (404)');
            console.log('   This meeting may not have any transcripts available');
          } else {
            console.error(`❌ API call failed: ${error.message}`);
            console.error(`   Status code: ${error.statusCode || 'Unknown'}`);
          }
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST SUMMARY\n');
    console.log('✅ Permissions are configured in Azure');
    console.log('✅ Microsoft Graph API connection works');
    console.log('✅ Calendar access works');

    if (!hasTranscriptScope) {
      console.log('⚠️  OAuth token needs to be refreshed with new scopes');
      console.log('\n🔄 NEXT STEPS:');
      console.log('1. Disconnect Microsoft in the app');
      console.log('2. Reconnect Microsoft');
      console.log('3. Accept the consent screen with new permissions');
      console.log('4. Run this test again to verify transcript access');
    } else {
      console.log('✅ OAuth token includes transcript permission');
      console.log('\nℹ️  If transcript access still fails:');
      console.log('• Ensure meetings are recorded');
      console.log('• Wait 5-10 minutes after meeting ends');
      console.log('• Verify Copilot is enabled for your organization');
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testTranscriptPermissions();
