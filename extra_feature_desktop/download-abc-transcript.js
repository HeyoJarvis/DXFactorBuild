#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
const fs = require('fs');
require('isomorphic-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function downloadTranscript() {
  try {
    console.log('📥 Downloading "abc standup" transcript file...\n');

    const { data: integration } = await supabase
      .from('team_sync_integrations')
      .select('access_token')
      .eq('service_name', 'microsoft')
      .single();

    const client = Client.init({
      authProvider: (done) => done(null, integration.access_token)
    });

    // Search for the transcript file
    const searchResult = await client
      .api('/me/drive/root/search(q=\'abc standup\')')
      .top(50)
      .get();

    const transcriptFile = searchResult.value.find(f => 
      f.name.includes('Meeting Transcript')
    );

    if (!transcriptFile) {
      console.log('❌ Transcript file not found');
      return;
    }

    console.log(`Found: ${transcriptFile.name}`);
    console.log(`Size: ${transcriptFile.size} bytes`);
    console.log(`Type: ${transcriptFile.mimeType || 'unknown'}\n`);

    // Download the file content as text
    console.log('Downloading content...\n');
    const response = await client
      .api(`/me/drive/items/${transcriptFile.id}/content`)
      .getStream();

    // Read stream to buffer
    const chunks = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Save to temp file
    const tempFile = '/tmp/abc-transcript-download.bin';
    fs.writeFileSync(tempFile, buffer);
    console.log(`✅ Downloaded to: ${tempFile}\n`);
    const header = buffer.slice(0, 100).toString('utf8', 0, 100);
    
    console.log('📄 File header (first 100 bytes):');
    console.log('='.repeat(60));
    console.log(header);
    console.log('='.repeat(60));
    console.log('');

    // Check if it's actually text (VTT format)
    if (header.includes('WEBVTT') || header.includes('-->')) {
      console.log('✅ This is actually a VTT transcript file!');
      console.log('📝 Full transcript content:\n');
      console.log(buffer.toString('utf8'));
      
      // Save to database
      console.log('\n💾 Saving to database...');
      const { data: meeting } = await supabase
        .from('team_meetings')
        .select('meeting_id, metadata')
        .eq('title', 'abc standup')
        .gte('start_time', '2025-10-20')
        .single();

      if (meeting) {
        const { error } = await supabase
          .from('team_meetings')
          .update({
            metadata: {
              ...meeting.metadata,
              transcript: buffer.toString('utf8'),
              transcript_file_name: transcriptFile.name,
              transcript_fetched_at: new Date().toISOString()
            }
          })
          .eq('meeting_id', meeting.meeting_id);

        if (error) {
          console.log('❌ Failed to save:', error.message);
        } else {
          console.log('✅ Transcript saved to database!');
        }
      }
    } else if (header.includes('ftyp') || buffer[0] === 0x00) {
      console.log('❌ This is actually an MP4 video file (binary data)');
      console.log('Cannot extract text transcript from video - Teams must process it separately');
    } else {
      console.log('🤔 Unknown file format');
      console.log('Hex dump (first 50 bytes):');
      console.log(buffer.slice(0, 50).toString('hex'));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.statusCode) {
      console.error('   Status:', error.statusCode);
    }
  }
}

downloadTranscript();

