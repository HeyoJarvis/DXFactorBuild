#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceFix() {
  try {
    // Get ALL meetings without Z suffix
    const { data: meetings, error: fetchError } = await supabase
      .from('team_meetings')
      .select('*');

    if (fetchError) {
      console.error('Failed to fetch:', fetchError);
      return;
    }

    console.log(`Found ${meetings.length} total meetings\n`);

    for (const meeting of meetings) {
      let needsUpdate = false;
      let updates = {};

      // Fix start_time if needed
      if (meeting.start_time && !meeting.start_time.endsWith('Z') && !meeting.start_time.includes('+')) {
        updates.start_time = `${meeting.start_time}Z`;
        needsUpdate = true;
      }

      // Fix end_time if needed
      if (meeting.end_time && !meeting.end_time.endsWith('Z') && !meeting.end_time.includes('+')) {
        updates.end_time = `${meeting.end_time}Z`;
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`Fixing: ${meeting.title}`);
        console.log(`  Old start: ${meeting.start_time}`);
        console.log(`  New start: ${updates.start_time}`);

        const { error: updateError } = await supabase
          .from('team_meetings')
          .update(updates)
          .eq('meeting_id', meeting.meeting_id);

        if (updateError) {
          console.error(`  ❌ Failed: ${updateError.message}\n`);
        } else {
          console.log(`  ✅ Fixed\n`);
        }
      }
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

forceFix();

