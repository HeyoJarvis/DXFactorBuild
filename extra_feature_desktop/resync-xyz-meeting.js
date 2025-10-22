/**
 * Re-sync xyz standup meeting to capture online meeting ID
 * The code now captures onlineMeeting.id - let's fetch it again
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');

async function resyncMeeting() {
  try {
    console.log('\n🔄 Re-syncing xyz standup meeting with UPDATED code\n');

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

    // Get current meeting from database
    const { data: meetings } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', '%xyz%standup%')
      .order('start_time', { ascending: false })
      .limit(1);

    const meeting = meetings[0];
    const calendarEventId = meeting.meeting_id;

    console.log('Current state:');
    console.log('  Title:', meeting.title);
    console.log('  Calendar Event ID:', calendarEventId);
    console.log('  Online Meeting ID in DB:', meeting.metadata?.online_meeting_id || 'NOT SET');
    console.log('');

    // Fetch the event AGAIN from Microsoft with updated code
    console.log('📡 Fetching event from Microsoft Graph with FULL fields...');
    
    const client = await microsoftService._getGraphClient(userId);
    
    const event = await client
      .api(`/me/events/${calendarEventId}`)
      .select('id,subject,start,end,onlineMeeting,onlineMeetingUrl,isOnlineMeeting')
      .get();

    console.log('\n✅ Event fetched!');
    console.log('  Subject:', event.subject);
    console.log('  isOnlineMeeting:', event.isOnlineMeeting);
    console.log('  onlineMeetingUrl:', event.onlineMeetingUrl ? 'YES' : 'NO');
    console.log('  onlineMeeting object:', event.onlineMeeting ? 'YES' : 'NO');
    
    if (event.onlineMeeting) {
      console.log('  onlineMeeting.id:', event.onlineMeeting.id || 'NOT PROVIDED');
      console.log('  onlineMeeting.joinUrl:', event.onlineMeeting.joinUrl || 'NOT PROVIDED');
    }
    console.log('');

    // Check if we got the online meeting ID
    const onlineMeetingId = event.onlineMeeting?.id;
    
    if (onlineMeetingId) {
      console.log('🎉 SUCCESS! Got online meeting ID:', onlineMeetingId);
      console.log('');
      
      // Update database
      console.log('💾 Updating database with online meeting ID...');
      const { error } = await supabase
        .from('team_meetings')
        .update({
          'metadata->online_meeting_id': onlineMeetingId
        })
        .eq('meeting_id', calendarEventId);

      if (error) throw error;
      
      console.log('✅ Database updated!');
      console.log('');
      
      // NOW try to fetch transcript
      console.log('📝 Attempting to fetch transcript with proper ID...');
      
      try {
        const transcripts = await client
          .api(`/me/onlineMeetings/${onlineMeetingId}/transcripts`)
          .get();
        
        console.log('✅ Transcripts endpoint accessible!');
        console.log('   Found', transcripts.value?.length || 0, 'transcript(s)');
        
        if (transcripts.value && transcripts.value.length > 0) {
          const transcript = transcripts.value[0];
          console.log('   Transcript ID:', transcript.id);
          console.log('   Created:', transcript.createdDateTime);
          
          // Fetch content
          const content = await client
            .api(`/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcript.id}/content`)
            .query({ $format: 'text/vtt' })
            .get();
          
          console.log('\n🎉 SUCCESS! TRANSCRIPT FETCHED!');
          console.log('   Size:', content.length, 'characters');
          console.log('   Preview:', content.substring(0, 200) + '...');
          
          // Save to database
          const { error: updateError } = await supabase
            .from('team_meetings')
            .update({
              'metadata->transcript': content,
              'metadata->transcript_id': transcript.id,
              'metadata->transcript_fetched_at': new Date().toISOString()
            })
            .eq('meeting_id', calendarEventId);
          
          if (updateError) throw updateError;
          
          console.log('\n✅ TRANSCRIPT SAVED TO DATABASE!');
          console.log('   Check the app - the transcript should now be available!');
          
        } else {
          console.log('\n⚠️  No transcripts available yet');
          console.log('   This means:');
          console.log('   - Transcript is still processing');
          console.log('   - Or was not recorded');
          console.log('   - Or not accessible via API');
        }
        
      } catch (transcriptError) {
        console.log('\n❌ Failed to fetch transcript:', transcriptError.message);
        console.log('   Status:', transcriptError.statusCode);
        console.log('');
        console.log('   This means the API endpoint exists but:');
        console.log('   - Transcript is not ready');
        console.log('   - Or recording was not enabled');
        console.log('   - Or transcript is stored elsewhere');
      }
      
    } else {
      console.log('❌ Microsoft did NOT provide online meeting ID');
      console.log('');
      console.log('This means:');
      console.log('  - Microsoft Graph API is not returning the onlineMeeting.id field');
      console.log('  - This could be a tenant configuration issue');
      console.log('  - Or the meeting type doesn\'t support this field');
      console.log('');
      console.log('What Microsoft provided:');
      console.log(JSON.stringify(event.onlineMeeting, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

resyncMeeting();


