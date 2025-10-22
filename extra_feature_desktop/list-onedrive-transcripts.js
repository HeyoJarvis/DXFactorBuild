/**
 * List all files in OneDrive to find transcript files
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');

async function listOneDriveFiles() {
  try {
    console.log('\n📁 LISTING ONEDRIVE FILES TO FIND TRANSCRIPTS\n');
    console.log('=' .repeat(70));

    // Initialize services
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const supabaseAdapter = new TeamSyncSupabaseAdapter({ supabase });

    const oauthService = new MicrosoftOAuthService({
      logger: console,
      supabaseAdapter
    });

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
    console.log(`✅ Found user: ${userId}\n`);

    // Get access token
    const accessToken = await oauthService.getAccessToken(userId);
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    // Check for Recordings folder
    console.log('📂 Checking for Recordings folder...\n');
    try {
      const recordingsFolder = await client
        .api('/me/drive/root:/Recordings')
        .get();
      
      console.log('✅ Found Recordings folder!');
      console.log(`   ID: ${recordingsFolder.id}`);
      console.log(`   WebUrl: ${recordingsFolder.webUrl}\n`);
      
      // List files in Recordings folder
      console.log('📋 Files in Recordings folder:\n');
      const recordingsFiles = await client
        .api('/me/drive/root:/Recordings:/children')
        .select('id,name,size,createdDateTime,file')
        .top(50)
        .get();
      
      if (recordingsFiles.value && recordingsFiles.value.length > 0) {
        recordingsFiles.value.forEach((file, i) => {
          console.log(`${i + 1}. ${file.name}`);
          console.log(`   Type: ${file.file ? 'File' : 'Folder'}`);
          if (file.file) {
            console.log(`   MIME: ${file.file.mimeType}`);
          }
          console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
          console.log(`   Created: ${file.createdDateTime}`);
          console.log('');
        });
        
        // Check for transcript files
        const transcriptFiles = recordingsFiles.value.filter(f => {
          const name = f.name.toLowerCase();
          return name.endsWith('.vtt') || 
                 name.endsWith('.txt') || 
                 name.endsWith('.docx') ||
                 (name.includes('transcript') && !name.endsWith('.mp4'));
        });
        
        console.log(`\n📝 Found ${transcriptFiles.length} potential transcript files`);
        
        if (transcriptFiles.length > 0) {
          console.log('\n🎯 TRANSCRIPT FILES:\n');
          transcriptFiles.forEach((file, i) => {
            console.log(`${i + 1}. ${file.name}`);
            console.log(`   ID: ${file.id}`);
            console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
            console.log('');
          });
        }
      } else {
        console.log('ℹ️  Recordings folder is empty\n');
      }
      
    } catch (recordingsError) {
      console.log(`⚠️  Recordings folder not found: ${recordingsError.message}\n`);
    }

    // Search for transcript files globally
    console.log('=' .repeat(70));
    console.log('\n🔍 Searching for transcript files globally...\n');
    
    const searchQuery = 'transcript';
    const searchResults = await client
      .api(`/me/drive/root/search(q='${searchQuery}')`)
      .top(30)
      .get();
    
    if (searchResults.value && searchResults.value.length > 0) {
      console.log(`Found ${searchResults.value.length} files matching "transcript":\n`);
      
      searchResults.value.forEach((file, i) => {
        const name = file.name.toLowerCase();
        const isVideo = name.endsWith('.mp4') || name.endsWith('.mp3') || name.endsWith('.avi');
        const isTranscript = name.endsWith('.vtt') || name.endsWith('.txt') || name.endsWith('.docx');
        
        let marker = '';
        if (isVideo) marker = '🎥';
        else if (isTranscript) marker = '📝';
        else marker = '📄';
        
        console.log(`${i + 1}. ${marker} ${file.name}`);
        console.log(`   Path: ${file.parentReference?.path || 'Root'}`);
        console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
        console.log(`   Created: ${file.createdDateTime}`);
        console.log('');
      });
      
      // Filter for actual transcript files
      const actualTranscripts = searchResults.value.filter(f => {
        const name = f.name.toLowerCase();
        return !name.endsWith('.mp4') && 
               !name.endsWith('.mp3') &&
               !name.endsWith('.avi') &&
               (name.endsWith('.vtt') || 
                name.endsWith('.txt') || 
                name.endsWith('.docx') ||
                (name.includes('transcript') && name.endsWith('.json')));
      });
      
      console.log(`\n📝 Found ${actualTranscripts.length} actual transcript text files`);
      
      if (actualTranscripts.length > 0) {
        console.log('\n🎯 TRANSCRIPT FILES TO USE:\n');
        actualTranscripts.forEach((file, i) => {
          console.log(`${i + 1}. ${file.name}`);
          console.log(`   ID: ${file.id}`);
          console.log(`   Path: ${file.parentReference?.path || 'Root'}`);
          console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
          console.log('');
        });
        
        // Try to download the first one as a sample
        if (actualTranscripts.length > 0) {
          console.log('=' .repeat(70));
          console.log('\n📥 SAMPLE: Downloading first transcript file...\n');
          
          const firstTranscript = actualTranscripts[0];
          console.log(`File: ${firstTranscript.name}\n`);
          
          try {
            const content = await client
              .api(`/me/drive/items/${firstTranscript.id}/content`)
              .getStream();
            
            const chunks = [];
            for await (const chunk of content) {
              chunks.push(chunk);
            }
            const textContent = Buffer.concat(chunks).toString('utf-8');
            
            console.log(`✅ Downloaded! Size: ${textContent.length} characters`);
            console.log('\n📖 PREVIEW (first 500 characters):\n');
            console.log('-'.repeat(70));
            console.log(textContent.substring(0, 500));
            console.log('-'.repeat(70));
            console.log('...(truncated)\n');
            
          } catch (downloadError) {
            console.log(`❌ Failed to download: ${downloadError.message}\n`);
          }
        }
      }
      
    } else {
      console.log('⚠️  No files found matching "transcript"\n');
    }

    console.log('=' .repeat(70));
    console.log('\n✅ SCAN COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

listOneDriveFiles();


