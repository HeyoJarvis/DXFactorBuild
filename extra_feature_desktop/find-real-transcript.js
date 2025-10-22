#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findRealTranscript() {
  try {
    console.log('🔍 Searching for REAL transcript files (VTT, SRT, TXT, DOCX)...\n');

    const { data: integration } = await supabase
      .from('team_sync_integrations')
      .select('access_token')
      .eq('service_name', 'microsoft')
      .single();

    const client = Client.init({
      authProvider: (done) => done(null, integration.access_token)
    });

    // Search in OneDrive
    console.log('Searching OneDrive...\n');
    const searchResult = await client
      .api('/me/drive/root/search(q=\'transcript\')')
      .top(50)
      .get();

    console.log(`Found ${searchResult.value.length} file(s) containing "transcript":\n`);

    for (const file of searchResult.value) {
      const ext = file.name.split('.').pop().toLowerCase();
      const isTextFormat = ['vtt', 'srt', 'txt', 'docx', 'doc'].includes(ext);
      
      console.log(`${isTextFormat ? '✅' : '📄'} ${file.name}`);
      console.log(`   Extension: ${ext}`);
      console.log(`   Size: ${file.size} bytes`);
      console.log(`   Created: ${new Date(file.createdDateTime).toLocaleString()}`);
      console.log('');
    }

    // Also check Recordings folder specifically
    console.log('\n📁 Checking Recordings folder...\n');
    try {
      const recordings = await client
        .api('/me/drive/root:/Recordings:/children')
        .get();
      
      console.log(`Found ${recordings.value.length} file(s) in Recordings:\n`);
      for (const file of recordings.value) {
        console.log(`📄 ${file.name}`);
        console.log(`   Size: ${file.size} bytes`);
        console.log(`   Created: ${new Date(file.createdDateTime).toLocaleString()}`);
        console.log('');
      }
    } catch (e) {
      console.log('No Recordings folder found or inaccessible');
    }

    // Check if we can access the transcript via Graph API directly
    console.log('\n🔌 Checking Graph API for transcript...\n');
    const { data: meeting } = await supabase
      .from('team_meetings')
      .select('metadata')
      .eq('title', 'abc standup')
      .gte('start_time', '2025-10-20')
      .single();

    if (meeting?.metadata?.online_meeting_id) {
      const onlineMeetingId = meeting.metadata.online_meeting_id;
      console.log(`Online Meeting ID: ${onlineMeetingId}\n`);
      
      try {
        const transcripts = await client
          .api(`/me/onlineMeetings/${onlineMeetingId}/transcripts`)
          .get();
        
        if (transcripts.value && transcripts.value.length > 0) {
          console.log(`✅ Found ${transcripts.value.length} transcript(s) via API!`);
          for (const t of transcripts.value) {
            console.log(`   ID: ${t.id}`);
            console.log(`   Created: ${t.createdDateTime}\n`);
          }
        } else {
          console.log('❌ No transcripts via API (expected - requires webhooks)');
        }
      } catch (e) {
        console.log(`❌ API error: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findRealTranscript();
