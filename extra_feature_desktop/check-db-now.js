#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const now = new Date().toISOString();
  const { data: meetings } = await supabase
    .from('team_meetings')
    .select('*')
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(10);

  console.log(`\nCurrent time: ${now}`);
  console.log(`In MDT: ${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })}\n`);
  console.log(`Found ${meetings?.length || 0} upcoming meetings:\n`);
  
  meetings?.forEach((m, i) => {
    const startDate = new Date(m.start_time);
    const startMDT = startDate.toLocaleString('en-US', { timeZone: 'America/Denver' });
    
    console.log(`[${i + 1}] ${m.title}`);
    console.log(`    DB value: ${m.start_time}`);
    console.log(`    Parsed as UTC: ${startDate.toISOString()}`);
    console.log(`    In MDT: ${startMDT}`);
    console.log(`    Has Z suffix: ${m.start_time.endsWith('Z')}`);
    console.log();
  });
}

check();

