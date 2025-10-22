#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRaw() {
  // Use raw SQL to see exactly what's stored
  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `SELECT meeting_id, title, start_time::text as start_text, 
              pg_typeof(start_time)::text as start_type 
              FROM team_meetings 
              WHERE title = 'abc standup' 
              LIMIT 1`
    });

  if (error) {
    console.log('RPC not available, using regular query');
    
    // Just get the data and examine it
    const { data: meeting } = await supabase
      .from('team_meetings')
      .select('*')
      .eq('title', 'abc standup')
      .single();
    
    console.log('\nDatabase column type issue detected!');
    console.log('The start_time column is likely stored as "timestamp without time zone"');
    console.log('This strips the Z suffix when storing/retrieving\n');
    
    console.log('Current value:', meeting.start_time);
    console.log('\nThe fix: We need to store times that Supabase/Postgres will interpret as UTC');
    console.log('Since the column is "timestamp without timezone", 22:00:00 is treated as literal time');
    console.log('\nSolution: Store the MDT time directly (16:00:00) not the UTC time (22:00:00)');
    
  } else {
    console.log('Raw data:', data);
  }
}

checkRaw();

