#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTranscripts() {
  try {
    console.log('🔍 Checking transcript status...\n');

    // Get all recent meetings with their transcript status
    const { data: meetings, error } = await supabase
      .from('team_meetings')
      .select('meeting_id, title, start_time, end_time, metadata')
      .gte('start_time', '2025-10-20')
      .order('start_time', { ascending: false });

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log(`Found ${meetings.length} meeting(s) from today:\n`);

    for (const meeting of meetings) {
      console.log(`📅 ${meeting.title}`);
      console.log(`   Start: ${meeting.start_time}`);
      console.log(`   End: ${meeting.end_time}`);
      console.log(`   Platform: ${meeting.metadata?.platform || 'N/A'}`);
      console.log(`   Online Meeting ID: ${meeting.metadata?.online_meeting_id ? 'Yes' : 'No'}`);
      
      if (meeting.metadata?.transcript) {
        const transcriptLength = meeting.metadata.transcript.length;
        console.log(`   ✅ HAS TRANSCRIPT: ${transcriptLength} characters`);
        console.log(`   📝 Preview: ${meeting.metadata.transcript.substring(0, 100)}...`);
      } else {
        console.log(`   ❌ NO TRANSCRIPT YET`);
      }
      
      if (meeting.metadata?.copilot_notes) {
        console.log(`   ✅ HAS COPILOT NOTES`);
      }
      
      if (meeting.metadata?.transcript_fetched_at) {
        console.log(`   ⏰ Fetched at: ${meeting.metadata.transcript_fetched_at}`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTranscripts();

