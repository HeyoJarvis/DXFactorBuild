/**
 * Inspect all meetings in detail
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

async function inspectMeetings() {
  try {
    console.log('\n🔍 INSPECTING ALL MEETINGS\n');
    console.log('=' .repeat(60));

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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

    // Get all meetings
    const { data: meetings, error } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (error || !meetings) {
      console.error('❌ Failed to fetch meetings:', error);
      process.exit(1);
    }

    console.log(`\nFound ${meetings.length} meetings\n`);

    meetings.forEach((meeting, i) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`\nMEETING #${i + 1}`);
      console.log(`\nTitle: ${meeting.title}`);
      console.log(`Meeting ID: ${meeting.meeting_id}`);
      console.log(`Platform: ${meeting.platform || 'Not set'}`);
      console.log(`Start Time: ${meeting.start_time}`);
      console.log(`End Time: ${meeting.end_time}`);
      console.log(`Location: ${meeting.location || 'Not set'}`);
      console.log(`Meeting URL: ${meeting.meeting_url || 'Not set'}`);
      console.log(`Is Important: ${meeting.is_important ? 'Yes' : 'No'}`);
      console.log(`Created At: ${meeting.created_at}`);

      console.log(`\nMetadata:`);
      if (meeting.metadata) {
        console.log(JSON.stringify(meeting.metadata, null, 2));
      } else {
        console.log('  (none)');
      }

      console.log(`\nAttendees:`);
      if (meeting.attendees && meeting.attendees.length > 0) {
        meeting.attendees.forEach(att => {
          console.log(`  - ${att.name || att.email || 'Unknown'}`);
        });
      } else {
        console.log('  (none)');
      }

      // Check for transcript in metadata
      if (meeting.metadata?.transcript) {
        console.log(`\n✅ HAS TRANSCRIPT!`);
        console.log(`   Length: ${meeting.metadata.transcript.length} characters`);
        console.log(`   Preview: ${meeting.metadata.transcript.substring(0, 200)}...`);
      }

      if (meeting.metadata?.copilot_notes) {
        console.log(`\n✅ HAS COPILOT NOTES!`);
        console.log(`   ${meeting.metadata.copilot_notes.substring(0, 200)}...`);
      }

      if (meeting.metadata?.online_meeting_id) {
        console.log(`\n🆔 Has online meeting ID: ${meeting.metadata.online_meeting_id}`);
      }
    });

    console.log(`\n${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

inspectMeetings();
