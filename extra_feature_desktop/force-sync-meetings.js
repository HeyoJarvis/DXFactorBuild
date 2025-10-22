/**
 * Force sync meetings from Microsoft Calendar
 */

require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const MicrosoftOAuthService = require('./main/services/oauth/MicrosoftOAuthService');
const StandaloneMicrosoftService = require('./main/services/StandaloneMicrosoftService');
const MeetingIntelligenceService = require('./main/services/MeetingIntelligenceService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');

async function forceSyncMeetings() {
  try {
    console.log('\n🔄 FORCE SYNCING MEETINGS FROM MICROSOFT CALENDAR\n');
    console.log('=' .repeat(70));

    // Initialize services
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const supabaseAdapter = new TeamSyncSupabaseAdapter({ supabase, logger: console });

    const microsoftOAuthService = new MicrosoftOAuthService({
      logger: console,
      supabaseAdapter
    });

    const microsoftService = new StandaloneMicrosoftService({
      logger: console,
      oauthService: microsoftOAuthService,
      supabaseAdapter
    });

    const meetingService = new MeetingIntelligenceService({
      microsoftService,
      supabaseAdapter,
      logger: console
    });

    // Get user
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

    // Fetch meetings
    console.log('📅 Fetching meetings from Microsoft Calendar...\n');
    
    const result = await meetingService.getUpcomingMeetings(userId, {
      days: 30,
      saveToDatabase: true
    });

    if (result.success) {
      console.log('✅ Meetings synced successfully!\n');
      console.log(`Total meetings: ${result.meetings?.length || 0}`);
      console.log(`Important meetings: ${result.meetings?.filter(m => m.is_important).length || 0}\n`);
      
      console.log('Recent meetings:');
      result.meetings?.slice(0, 5).forEach(m => {
        console.log(`  - ${m.title}`);
        console.log(`    Time: ${new Date(m.start_time).toLocaleString()}`);
        console.log(`    Important: ${m.is_important ? 'YES ⭐' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('❌ Failed to sync meetings:', result.error);
    }

    console.log('=' .repeat(70));
    console.log('\n✅ SYNC COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

forceSyncMeetings();

