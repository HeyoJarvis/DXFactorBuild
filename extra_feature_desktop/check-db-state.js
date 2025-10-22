/**
 * Check current state of database
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

async function checkDatabase() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: integration } = await supabase
    .from('team_sync_integrations')
    .select('user_id')
    .eq('service_name', 'microsoft')
    .single();

  const userId = integration.user_id;

  console.log('\n📊 DATABASE STATE\n');

  // Get all meetings with full details
  const { data: meetings } = await supabase
    .from('team_meetings')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: false });

  console.log(`Total meetings: ${meetings.length}\n`);

  meetings.forEach((m, i) => {
    console.log(`${i + 1}. ${m.title}`);
    console.log(`   meeting_id: ${m.meeting_id.substring(0, 50)}...`);
    console.log(`   platform: ${m.platform || 'NULL'}`);
    console.log(`   meeting_url: ${m.meeting_url ? m.meeting_url.substring(0, 50) + '...' : 'NULL'}`);
    console.log(`   start_time: ${m.start_time}`);
    console.log(`   end_time: ${m.end_time}`);
    console.log(`   is_important: ${m.is_important}`);
    console.log(`   metadata.online_meeting_id: ${m.metadata?.online_meeting_id || 'NULL'}`);
    console.log(`   metadata.online_meeting_url: ${m.metadata?.online_meeting_url ? m.metadata.online_meeting_url.substring(0, 50) + '...' : 'NULL'}`);
    console.log(`   has_transcript: ${!!m.metadata?.transcript}`);
    console.log('');
  });

  // Count by platform
  console.log('\nBreakdown:');
  console.log(`  platform='microsoft': ${meetings.filter(m => m.platform === 'microsoft').length}`);
  console.log(`  platform=NULL: ${meetings.filter(m => !m.platform).length}`);
  console.log(`  has online_meeting_id: ${meetings.filter(m => m.metadata?.online_meeting_id).length}`);
  console.log(`  has transcript: ${meetings.filter(m => m.metadata?.transcript).length}`);
}

checkDatabase();
