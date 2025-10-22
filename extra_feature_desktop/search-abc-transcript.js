#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchTranscript() {
  try {
    console.log('🔍 Searching OneDrive for "abc standup" transcript...\n');

    const { data: integration } = await supabase
      .from('team_sync_integrations')
      .select('access_token')
      .eq('service_name', 'microsoft')
      .single();

    if (!integration) {
      console.log('❌ No Microsoft integration found');
      return;
    }

    const client = Client.init({
      authProvider: (done) => done(null, integration.access_token)
    });

    // Search for "abc" files
    console.log('Searching for files containing "abc"...\n');
    const searchResult = await client
      .api('/me/drive/root/search(q=\'abc\')')
      .top(50)
      .get();

    console.log(`Found ${searchResult.value.length} file(s):\n`);

    // Show ALL files first
    for (const file of searchResult.value) {
      const created = new Date(file.createdDateTime);
      const size = file.size;
      const isTranscript = file.name.toLowerCase().includes('transcript') ||
                          file.name.endsWith('.vtt') ||
                          file.name.endsWith('.docx') ||
                          file.name.endsWith('.txt');
      
      console.log(`${isTranscript ? '✅' : '📄'} ${file.name}`);
      console.log(`   Created: ${created.toLocaleString()}`);
      console.log(`   Size: ${size} bytes`);
      console.log(`   Type: ${file.mimeType || 'unknown'}`);
      console.log('');
    }

    // Filter for transcript files
    const transcriptFiles = searchResult.value.filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.vtt') ||
             name.endsWith('.docx') ||
             name.endsWith('.txt') ||
             name.endsWith('.srt') ||
             name.includes('transcript');
    });

    if (transcriptFiles.length === 0) {
      console.log('❌ No transcript files found for "abc standup"');
      console.log('');
      console.log('Possible reasons:');
      console.log('1. Meeting recording/transcription was not enabled');
      console.log('2. Microsoft is still processing (can take 5 mins to 2+ hours)');
      console.log('3. Transcript is stored with a different name');
    } else {
      console.log(`✅ Found ${transcriptFiles.length} transcript file(s)!`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.statusCode) {
      console.error('   Status:', error.statusCode);
    }
  }
}

searchTranscript();

