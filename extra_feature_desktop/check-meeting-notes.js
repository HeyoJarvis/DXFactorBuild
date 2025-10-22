/**
 * Check meeting notes for xyz standup
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMeetingNotes() {
  try {
    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    
    console.log('🔍 Searching for "xyz standup" meeting...\n');
    
    // Search for meetings with "xyz" in the title
    const { data: meetings, error } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', '%xyz%')
      .order('start_time', { ascending: false });
    
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    
    if (!meetings || meetings.length === 0) {
      console.log('❌ No meetings found with "xyz" in the title');
      console.log('\nSearching for recent meetings instead...\n');
      
      // Get all meetings from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: recentMeetings, error: recentError } = await supabase
        .from('team_meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', today.toISOString())
        .order('start_time', { ascending: false });
      
      if (recentError || !recentMeetings || recentMeetings.length === 0) {
        console.log('❌ No meetings found today');
        return;
      }
      
      console.log(`Found ${recentMeetings.length} meeting(s) today:\n`);
      recentMeetings.forEach((meeting, index) => {
        console.log(`${index + 1}. ${meeting.title}`);
        console.log(`   Start: ${new Date(meeting.start_time).toLocaleString()}`);
        console.log(`   End: ${new Date(meeting.end_time).toLocaleString()}`);
        console.log(`   ID: ${meeting.id}`);
        console.log('');
      });
      
      return;
    }
    
    console.log(`✅ Found ${meetings.length} meeting(s) with "xyz" in title:\n`);
    
    meetings.forEach((meeting, index) => {
      const startTime = new Date(meeting.start_time);
      const endTime = new Date(meeting.end_time);
      const now = new Date();
      const minutesAgo = Math.floor((now - endTime) / 1000 / 60);
      
      console.log(`${'='.repeat(60)}`);
      console.log(`Meeting ${index + 1}: ${meeting.title}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`ID: ${meeting.id}`);
      console.log(`Start: ${startTime.toLocaleString()}`);
      console.log(`End: ${endTime.toLocaleString()}`);
      console.log(`Ended: ${minutesAgo} minutes ago`);
      console.log(`Important: ${meeting.is_important ? '✅ Yes' : '❌ No'}`);
      console.log(`Teams Meeting: ${meeting.metadata?.online_meeting_url ? '✅ Yes' : '❌ No'}`);
      
      if (meeting.metadata?.online_meeting_url) {
        console.log(`Meeting URL: ${meeting.metadata.online_meeting_url}`);
      }
      
      console.log(`\n📝 NOTES:`);
      
      if (meeting.manual_notes) {
        const notesUpdated = meeting.manual_notes_updated_at 
          ? new Date(meeting.manual_notes_updated_at)
          : null;
        const notesMinutesAgo = notesUpdated 
          ? Math.floor((now - notesUpdated) / 1000 / 60)
          : null;
        
        console.log(`\n✅ Manual Notes (${notesMinutesAgo ? `updated ${notesMinutesAgo} min ago` : 'no timestamp'}):`);
        console.log('-'.repeat(60));
        console.log(meeting.manual_notes);
        console.log('-'.repeat(60));
      } else {
        console.log('❌ No manual notes');
      }
      
      if (meeting.copilot_notes) {
        console.log(`\n✅ Copilot Notes (from Teams transcript):`);
        console.log('-'.repeat(60));
        console.log(meeting.copilot_notes.substring(0, 500) + '...');
        console.log('-'.repeat(60));
      } else {
        console.log('❌ No Copilot notes from Teams');
      }
      
      if (meeting.ai_summary) {
        console.log(`\n✅ AI Summary:`);
        console.log('-'.repeat(60));
        console.log(meeting.ai_summary);
        console.log('-'.repeat(60));
      } else {
        console.log('❌ No AI summary');
      }
      
      console.log('\n');
    });
    
    // Check if any meeting ended recently (within 15 minutes)
    const recentMeeting = meetings.find(m => {
      const endTime = new Date(m.end_time);
      const now = new Date();
      const minutesAgo = Math.floor((now - endTime) / 1000 / 60);
      return minutesAgo <= 15;
    });
    
    if (recentMeeting) {
      console.log('\n💡 COPILOT NOTES STATUS:');
      if (recentMeeting.copilot_notes) {
        console.log('✅ Copilot notes are already available!');
      } else {
        console.log('⏳ Meeting just ended. Copilot notes may take a few minutes.');
        console.log('The system will automatically fetch them within 30 minutes.');
        console.log('Or you can mark it as important to trigger aggressive fetching.');
      }
    }
    
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

checkMeetingNotes();


