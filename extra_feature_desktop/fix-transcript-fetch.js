/**
 * Try different Microsoft Graph API endpoints for transcript
 * The /communications/onlineMeetings endpoint often fails
 * Need to try /users/{userId}/onlineMeetings instead
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');

async function tryAllTranscriptEndpoints() {
  try {
    console.log('\n🔧 Trying ALL Microsoft Graph API endpoints for transcripts\n');

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

    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    const client = await microsoftService._getGraphClient(userId);

    // Get meeting
    const { data: meetings } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', '%xyz%standup%')
      .order('start_time', { ascending: false })
      .limit(1);

    const meeting = meetings[0];
    const onlineMeetingId = '19:meeting_MmFjMzU5NDgtNzJlMy00NzA2LWFlYWYtMTBhNDk1YzFlODky@thread.v2';

    console.log('Meeting:', meeting.title);
    console.log('Online Meeting ID:', onlineMeetingId);
    console.log('');

    // Try 1: /users/me/onlineMeetings (user-scoped)
    console.log('📡 Attempt 1: /users/me/onlineMeetings/{id}');
    try {
      const meetingData = await client
        .api(`/users/me/onlineMeetings/${encodeURIComponent(onlineMeetingId)}`)
        .get();
      
      console.log('   ✅ Meeting found via /users/me endpoint');
      console.log('   Meeting data:', meetingData);
      
      // Now try to get transcripts
      try {
        const transcripts = await client
          .api(`/users/me/onlineMeetings/${encodeURIComponent(onlineMeetingId)}/transcripts`)
          .get();
        
        console.log('   ✅ TRANSCRIPTS FOUND!', transcripts.value?.length || 0);
        
        if (transcripts.value && transcripts.value.length > 0) {
          const transcript = transcripts.value[0];
          console.log('   Transcript ID:', transcript.id);
          
          // Get content
          const content = await client
            .api(`/users/me/onlineMeetings/${encodeURIComponent(onlineMeetingId)}/transcripts/${transcript.id}/content`)
            .get();
          
          console.log('   ✅ SUCCESS! Got transcript content');
          console.log('   Size:', content.length, 'characters');
          
          return { success: true, content, transcript };
        }
      } catch (transcriptError) {
        console.log('   ❌ Transcripts endpoint failed:', transcriptError.message);
      }
    } catch (error) {
      console.log('   ❌ Failed:', error.message);
    }

    // Try 2: /me/onlineMeetings (shorthand)
    console.log('\n📡 Attempt 2: /me/onlineMeetings/{id}');
    try {
      const meetingData = await client
        .api(`/me/onlineMeetings/${encodeURIComponent(onlineMeetingId)}`)
        .get();
      
      console.log('   ✅ Meeting found');
      
      const transcripts = await client
        .api(`/me/onlineMeetings/${encodeURIComponent(onlineMeetingId)}/transcripts`)
        .get();
      
      console.log('   ✅ TRANSCRIPTS FOUND!', transcripts.value?.length || 0);
      
      if (transcripts.value && transcripts.value.length > 0) {
        const transcript = transcripts.value[0];
        const content = await client
          .api(`/me/onlineMeetings/${encodeURIComponent(onlineMeetingId)}/transcripts/${transcript.id}/content`)
          .get();
        
        console.log('   ✅ SUCCESS! Got transcript content');
        return { success: true, content, transcript };
      }
    } catch (error) {
      console.log('   ❌ Failed:', error.message);
    }

    // Try 3: Search call records (alternative location)
    console.log('\n📡 Attempt 3: /communications/callRecords');
    try {
      const callRecords = await client
        .api('/communications/callRecords')
        .filter(`participants/any(p: p/identity/user/id eq '${userId}')`)
        .get();
      
      console.log('   Found', callRecords.value?.length || 0, 'call records');
      
      // Find matching call by time
      const meetingTime = new Date(meeting.start_time);
      for (const record of callRecords.value || []) {
        const recordTime = new Date(record.startDateTime);
        const timeDiff = Math.abs(meetingTime - recordTime);
        
        if (timeDiff < 5 * 60 * 1000) { // Within 5 minutes
          console.log('   ✅ Found matching call record:', record.id);
          
          // Try to get transcript from call record
          try {
            const transcripts = await client
              .api(`/communications/callRecords/${record.id}/transcripts`)
              .get();
            
            console.log('   ✅ TRANSCRIPTS FOUND!', transcripts.value?.length || 0);
            
            if (transcripts.value && transcripts.value.length > 0) {
              const transcript = transcripts.value[0];
              const content = await client
                .api(`/communications/callRecords/${record.id}/transcripts/${transcript.id}/content`)
                .get();
              
              console.log('   ✅ SUCCESS! Got transcript from call record');
              return { success: true, content, transcript };
            }
          } catch (transcriptError) {
            console.log('   ❌ No transcripts in this call record');
          }
        }
      }
    } catch (error) {
      console.log('   ❌ Failed:', error.message);
    }

    // Try 4: List ALL my online meetings and find by title
    console.log('\n📡 Attempt 4: List all my online meetings');
    try {
      const allMeetings = await client
        .api('/me/onlineMeetings')
        .filter(`subject eq '${meeting.title}'`)
        .get();
      
      console.log('   Found', allMeetings.value?.length || 0, 'meetings with title:', meeting.title);
      
      for (const om of allMeetings.value || []) {
        console.log(`   Checking meeting: ${om.id}`);
        
        try {
          const transcripts = await client
            .api(`/me/onlineMeetings/${om.id}/transcripts`)
            .get();
          
          if (transcripts.value && transcripts.value.length > 0) {
            console.log('   ✅ TRANSCRIPTS FOUND!');
            
            const transcript = transcripts.value[0];
            const content = await client
              .api(`/me/onlineMeetings/${om.id}/transcripts/${transcript.id}/content`)
              .get();
            
            console.log('   ✅ SUCCESS! Got transcript content');
            return { success: true, content, transcript };
          }
        } catch (e) {
          console.log('   No transcripts for this meeting');
        }
      }
    } catch (error) {
      console.log('   ❌ Failed:', error.message);
    }

    console.log('\n❌ All attempts failed');
    console.log('\nThis is a Microsoft Graph API limitation.');
    console.log('The transcript exists in Teams but is not exposed via any API endpoint.');
    console.log('\nThis typically happens with:');
    console.log('  - Meetings that pre-date API access being enabled');
    console.log('  - Specific tenant configurations');
    console.log('  - Meetings created through certain channels');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

tryAllTranscriptEndpoints();


