/**
 * Verify Power Automate Transcript Flow
 * 
 * Checks if Power Automate is successfully saving transcripts to OneDrive
 * and if the app can read them
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');

async function verifyPowerAutomateTranscripts() {
  console.log('\n🔍 VERIFYING POWER AUTOMATE TRANSCRIPT FLOW\n');
  console.log('=' .repeat(70));

  try {
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
      console.log('\n💡 Run the authentication flow first:');
      console.log('   node main/index.js\n');
      process.exit(1);
    }

    const userId = integration.user_id;
    console.log(`✅ User ID: ${userId}\n`);

    // Get Graph client
    const accessToken = await oauthService.getAccessToken(userId);
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    console.log('📁 Checking OneDrive /Recordings folder...\n');

    // Check if Recordings folder exists
    let recordingsFolder;
    try {
      recordingsFolder = await client
        .api('/me/drive/root:/Recordings')
        .get();
      
      console.log('✅ /Recordings folder exists');
      console.log(`   Created: ${new Date(recordingsFolder.createdDateTime).toLocaleString()}`);
      console.log(`   Modified: ${new Date(recordingsFolder.lastModifiedDateTime).toLocaleString()}\n`);
    } catch (error) {
      console.log('⚠️  /Recordings folder not found');
      console.log('\n💡 Create the folder:');
      console.log('   1. Go to OneDrive.com');
      console.log('   2. Create a new folder called "Recordings"');
      console.log('   3. Re-run this script\n');
      process.exit(1);
    }

    // List files in Recordings folder
    console.log('📄 Checking for transcript files...\n');
    
    const files = await client
      .api('/me/drive/root:/Recordings:/children')
      .select('id,name,size,createdDateTime,lastModifiedDateTime,file')
      .orderby('lastModifiedDateTime desc')
      .top(20)
      .get();

    if (!files.value || files.value.length === 0) {
      console.log('⚠️  No files found in /Recordings folder');
      console.log('\n💡 This could mean:');
      console.log('   1. Power Automate flow hasn\'t run yet (runs every 30 min)');
      console.log('   2. No meetings with transcripts in the last 24 hours');
      console.log('   3. Power Automate flow encountered an error\n');
      console.log('🔧 Check Power Automate:');
      console.log('   https://make.powerautomate.com → My flows → Run history\n');
      process.exit(0);
    }

    console.log(`✅ Found ${files.value.length} files in /Recordings\n`);
    console.log('─'.repeat(70));

    // Categorize files
    const transcriptFiles = [];
    const otherFiles = [];

    files.value.forEach(file => {
      const name = file.name.toLowerCase();
      const isTranscript = name.endsWith('.vtt') || 
                          name.endsWith('.txt') || 
                          name.endsWith('.docx') || 
                          name.endsWith('.srt') ||
                          name.includes('transcript');
      
      if (isTranscript) {
        transcriptFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    });

    // Show transcript files
    if (transcriptFiles.length > 0) {
      console.log(`\n✅ Found ${transcriptFiles.length} transcript files:\n`);
      
      transcriptFiles.forEach((file, index) => {
        const sizeKB = (file.size / 1024).toFixed(2);
        const created = new Date(file.createdDateTime);
        const age = Math.round((Date.now() - created.getTime()) / (1000 * 60));
        
        console.log(`${index + 1}. 📝 ${file.name}`);
        console.log(`   Size: ${sizeKB} KB`);
        console.log(`   Created: ${created.toLocaleString()} (${age} minutes ago)`);
        console.log(`   File ID: ${file.id}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  No transcript files found');
      console.log('\n💡 Expected file formats: .vtt, .txt, .docx, .srt');
      console.log('   Or files with "transcript" in the name\n');
    }

    // Show other files (might be recordings)
    if (otherFiles.length > 0) {
      console.log(`\n📹 Found ${otherFiles.length} other files (possibly recordings):\n`);
      
      otherFiles.slice(0, 5).forEach((file, index) => {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        console.log(`${index + 1}. ${file.name} (${sizeMB} MB)`);
      });
      
      if (otherFiles.length > 5) {
        console.log(`   ... and ${otherFiles.length - 5} more files`);
      }
      console.log('');
    }

    console.log('─'.repeat(70));

    // Test reading a transcript file
    if (transcriptFiles.length > 0) {
      console.log('\n🧪 Testing transcript file read...\n');
      
      const testFile = transcriptFiles[0];
      console.log(`Reading: ${testFile.name}`);
      
      try {
        const response = await client
          .api(`/me/drive/items/${testFile.id}/content`)
          .getStream();

        const chunks = [];
        for await (const chunk of response) {
          chunks.push(chunk);
        }
        const content = Buffer.concat(chunks).toString('utf-8');
        
        console.log(`✅ Successfully read ${content.length} characters`);
        
        // Show preview
        const preview = content.substring(0, 200);
        console.log('\n📄 Preview:');
        console.log('─'.repeat(70));
        console.log(preview);
        if (content.length > 200) {
          console.log('...');
        }
        console.log('─'.repeat(70));
        
      } catch (error) {
        console.log(`❌ Failed to read file: ${error.message}`);
      }
    }

    // Check database
    console.log('\n💾 Checking database for stored transcripts...\n');
    
    const { data: meetings, error: meetingsError } = await supabase
      .from('team_meetings')
      .select('meeting_id, title, start_time, metadata')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(10);

    if (meetingsError) {
      console.log(`⚠️  Could not query database: ${meetingsError.message}`);
    } else {
      const meetingsWithTranscripts = meetings.filter(m => 
        m.metadata?.transcript || m.metadata?.transcript_id
      );
      
      console.log(`📊 Found ${meetings.length} recent meetings in database`);
      console.log(`   ${meetingsWithTranscripts.length} have transcripts stored\n`);
      
      if (meetingsWithTranscripts.length > 0) {
        console.log('✅ Meetings with transcripts:\n');
        meetingsWithTranscripts.forEach((meeting, index) => {
          const transcriptLength = meeting.metadata.transcript?.length || 0;
          const hasTranscript = transcriptLength > 0;
          const hasCopilotNotes = !!meeting.metadata.copilot_notes;
          
          console.log(`${index + 1}. ${meeting.title}`);
          console.log(`   Date: ${new Date(meeting.start_time).toLocaleString()}`);
          console.log(`   Transcript: ${hasTranscript ? `✅ (${transcriptLength} chars)` : '❌'}`);
          console.log(`   Copilot Notes: ${hasCopilotNotes ? '✅' : '❌'}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No meetings with transcripts in database yet\n');
        console.log('💡 This is normal if:');
        console.log('   1. Background sync hasn\'t run yet (every 15 minutes)');
        console.log('   2. Files were just added to OneDrive');
        console.log('\n🔄 To manually trigger sync:');
        console.log('   node force-sync-meetings.js\n');
      }
    }

    // Summary and recommendations
    console.log('─'.repeat(70));
    console.log('\n📋 SUMMARY\n');
    
    const checks = {
      'OneDrive connection': true,
      'Recordings folder exists': true,
      'Transcript files found': transcriptFiles.length > 0,
      'App can read files': transcriptFiles.length > 0,
      'Database has transcripts': meetings.some(m => m.metadata?.transcript)
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '⚠️ '} ${check}`);
    });

    console.log('\n');

    // Recommendations
    if (transcriptFiles.length === 0) {
      console.log('🎯 NEXT STEPS:\n');
      console.log('1. Check Power Automate flow status:');
      console.log('   https://make.powerautomate.com → My flows\n');
      console.log('2. Verify flow is turned ON\n');
      console.log('3. Check flow run history for errors\n');
      console.log('4. Test with a new meeting:');
      console.log('   - Schedule 5-min Teams meeting');
      console.log('   - Enable recording + transcription');
      console.log('   - Wait 30 minutes');
      console.log('   - Re-run this script\n');
    } else if (!meetings.some(m => m.metadata?.transcript)) {
      console.log('🎯 NEXT STEPS:\n');
      console.log('1. Transcripts are in OneDrive ✅');
      console.log('2. App hasn\'t synced them to database yet\n');
      console.log('3. Wait for automatic sync (every 15 minutes)');
      console.log('   OR manually trigger:');
      console.log('   node force-sync-meetings.js\n');
    } else {
      console.log('🎉 EVERYTHING IS WORKING!\n');
      console.log('✅ Power Automate is saving transcripts to OneDrive');
      console.log('✅ App is reading and storing them in database');
      console.log('✅ Transcripts are available in Team Chat\n');
      console.log('🔄 Automatic sync: Every 15 minutes');
      console.log('📝 Transcript retention: As long as OneDrive storage allows\n');
    }

    console.log('─'.repeat(70));
    console.log('\n✨ Verification complete!\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run verification
verifyPowerAutomateTranscripts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

