/**
 * Force fetch transcript for xyz standup meeting
 * Uses multiple approaches to find and download it
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AutomatedTranscriptService = require('./main/services/AutomatedTranscriptService');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');

async function forceFetchTranscript() {
  try {
    console.log('\n🔍 Force Fetching Transcript for xyz standup\n');

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

    // Get meeting
    console.log('Step 1: Getting meeting from database...');
    const { data: meetings, error } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', '%xyz%standup%')
      .order('start_time', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!meetings || meetings.length === 0) {
      console.log('❌ Meeting not found');
      return;
    }

    const meeting = meetings[0];
    console.log('✅ Found:', meeting.title);
    console.log('   Meeting ID:', meeting.meeting_id);
    console.log('   Online Meeting URL:', meeting.metadata?.online_meeting_url);
    console.log('');

    // Try to extract online meeting ID from URL
    console.log('Step 2: Extracting online meeting ID from URL...');
    const joinUrl = meeting.metadata?.online_meeting_url;
    
    if (joinUrl) {
      // Extract meeting ID from URL
      // Format: https://teams.microsoft.com/l/meetup-join/19%3ameeting_XXX%40thread.v2/...
      const match = joinUrl.match(/19%3ameeting_([^%]+)%40thread\.v2/);
      if (match) {
        const encodedMeetingId = `19:meeting_${match[1]}@thread.v2`;
        console.log('✅ Extracted meeting ID:', encodedMeetingId);
        
        // Update meeting with online_meeting_id
        meeting.metadata = meeting.metadata || {};
        meeting.metadata.online_meeting_id = encodedMeetingId;
        
        console.log('');
        console.log('Step 3: Attempting to fetch transcript with extracted ID...');
        
        const result = await automatedTranscriptService.fetchTranscriptForMeeting(
          userId,
          meeting
        );
        
        if (result.success && result.transcript) {
          console.log('\n✅ SUCCESS! Transcript fetched!');
          console.log('   Size:', result.transcript.length, 'characters');
          console.log('   Has Copilot Notes:', !!result.copilotNotes);
          
          // Save to database
          const updateData = {
            'metadata->transcript': result.transcript,
            'metadata->online_meeting_id': encodedMeetingId
          };
          
          if (result.copilotNotes) {
            updateData.copilot_notes = result.copilotNotes;
          }
          
          const { error: updateError } = await supabase
            .from('team_meetings')
            .update(updateData)
            .eq('meeting_id', meeting.meeting_id);
          
          if (updateError) throw updateError;
          
          console.log('\n✅ Transcript saved to database!');
          console.log('   Check the app - it should now show the transcript');
          
        } else {
          console.log('\n❌ Failed to fetch transcript');
          console.log('   Error:', result.error);
          console.log('\n   The transcript might be:');
          console.log('   1. Not accessible via this meeting ID format');
          console.log('   2. Stored under a different ID structure');
          console.log('   3. Only accessible via the Teams UI (not API)');
        }
      } else {
        console.log('❌ Could not extract meeting ID from URL');
        console.log('   URL format:', joinUrl);
      }
    } else {
      console.log('❌ No Teams meeting URL found');
    }
    
    // Try alternative: Search OneDrive more broadly
    console.log('\n\nStep 4: Trying OneDrive search with date filter...');
    const client = await microsoftService._getGraphClient(userId);
    
    // Get meeting date
    const meetingDate = new Date(meeting.start_time);
    const dateStr = meetingDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log('   Searching for files from:', dateStr);
    
    try {
      const searchResult = await client
        .api('/me/drive/root/search(q=\'transcript\')')
        .filter("file ne null")
        .top(50)
        .get();
      
      console.log('   Found', searchResult.value?.length || 0, 'files with "transcript"');
      
      if (searchResult.value && searchResult.value.length > 0) {
        // Filter by date
        const filesFromDate = searchResult.value.filter(f => {
          const fileDate = new Date(f.createdDateTime).toISOString().split('T')[0];
          return fileDate === dateStr;
        });
        
        console.log('   Files from meeting date:', filesFromDate.length);
        
        if (filesFromDate.length > 0) {
          console.log('\n   📄 Matching files:');
          filesFromDate.forEach((f, i) => {
            console.log(`   ${i + 1}. ${f.name} (${f.size} bytes)`);
            console.log(`      Created: ${f.createdDateTime}`);
          });
          
          // Try to download the first one
          const file = filesFromDate[0];
          console.log(`\n   Downloading: ${file.name}...`);
          
          const response = await client
            .api(`/me/drive/items/${file.id}/content`)
            .getStream();
          
          const chunks = [];
          for await (const chunk of response) {
            chunks.push(chunk);
          }
          const content = Buffer.concat(chunks).toString('utf-8');
          
          console.log(`   ✅ Downloaded! Size: ${content.length} characters`);
          
          // Save to database
          const { error: updateError } = await supabase
            .from('team_meetings')
            .update({
              'metadata->transcript': content,
              'metadata->transcript_source': 'onedrive',
              'metadata->transcript_file': file.name
            })
            .eq('meeting_id', meeting.meeting_id);
          
          if (updateError) throw updateError;
          
          console.log('   ✅ Saved to database!');
          
        } else {
          console.log('   ❌ No transcript files from that date');
        }
      }
      
    } catch (searchError) {
      console.log('   ❌ OneDrive search failed:', searchError.message);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

forceFetchTranscript();


