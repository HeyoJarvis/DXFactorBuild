/**
 * Manually refresh JIRA OAuth token
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import services
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const JIRAOAuthService = require('./main/services/oauth/JIRAOAuthService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...rest }) => {
      return `${timestamp} [${level}]: ${message} ${Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ''}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

async function refreshJIRAToken() {
  try {
    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    
    console.log('🔄 Refreshing JIRA OAuth token...\n');
    
    // Initialize services
    const supabaseAdapter = new TeamSyncSupabaseAdapter({ logger });
    const jiraOAuthService = new JIRAOAuthService({
      logger,
      supabaseAdapter
    });
    
    // Check current integration status
    const { data: currentData, error: fetchError } = await supabaseAdapter.supabase
      .from('team_sync_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'jira')
      .single();
    
    if (fetchError || !currentData) {
      console.log('❌ No JIRA connection found in database.');
      console.log('Please reconnect JIRA from Settings first.\n');
      return;
    }
    
    console.log('Current JIRA Integration Status:');
    console.log('-----------------------------------');
    console.log('Cloud ID:', currentData.cloud_id);
    console.log('Site URL:', currentData.site_url);
    console.log('Token Expiry:', currentData.token_expiry);
    console.log('Last Synced:', currentData.last_synced_at);
    console.log('-----------------------------------\n');
    
    // Check if token is expired
    const expiryTime = new Date(currentData.token_expiry).getTime();
    const now = Date.now();
    const isExpired = expiryTime < now;
    
    if (isExpired) {
      const expiredMinutesAgo = Math.floor((now - expiryTime) / (1000 * 60));
      console.log(`⚠️  Token expired ${expiredMinutesAgo} minutes ago.\n`);
    } else {
      const expiresInMinutes = Math.floor((expiryTime - now) / (1000 * 60));
      console.log(`✓ Token is valid for ${expiresInMinutes} more minutes.\n`);
    }
    
    // Attempt to refresh token
    console.log('🔄 Attempting to refresh token...\n');
    
    try {
      const newAccessToken = await jiraOAuthService.refreshAccessToken(userId);
      
      console.log('✅ Token refresh successful!\n');
      
      // Verify the new token works
      console.log('🔍 Verifying new token with JIRA API...\n');
      
      const verifyResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: {
          'Authorization': `Bearer ${newAccessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (verifyResponse.ok) {
        const resources = await verifyResponse.json();
        console.log('✅ New token is valid! Found', resources.length, 'JIRA site(s):\n');
        
        resources.forEach((resource, index) => {
          console.log(`Site ${index + 1}:`);
          console.log('  Name:', resource.name);
          console.log('  URL:', resource.url);
          console.log('  Cloud ID:', resource.id);
          console.log('');
        });
        
        // Check if cloud ID matches
        if (resources.length > 0 && resources[0].id !== currentData.cloud_id) {
          console.log('⚠️  Warning: Cloud ID mismatch!');
          console.log('Database has:', currentData.cloud_id);
          console.log('Token gives access to:', resources[0].id);
          console.log('\nUpdating database with correct Cloud ID...\n');
          
          await supabaseAdapter.supabase
            .from('team_sync_integrations')
            .update({
              cloud_id: resources[0].id,
              site_url: resources[0].url
            })
            .eq('user_id', userId)
            .eq('service_name', 'jira');
          
          console.log('✅ Database updated!\n');
        }
        
        console.log('🎉 JIRA integration is now working!');
        console.log('You can now use "Sync Now" in the Dashboard.\n');
        
      } else {
        console.log('❌ New token verification failed:', verifyResponse.status);
        console.log('The token was refreshed but may not have the right permissions.\n');
      }
      
    } catch (refreshError) {
      console.log('❌ Token refresh failed:', refreshError.message);
      console.log('\nThis usually means:');
      console.log('1. The refresh token is invalid or expired');
      console.log('2. The OAuth app credentials are incorrect');
      console.log('3. The JIRA site was deleted or migrated');
      console.log('\n💡 Solution: Reconnect JIRA from Settings');
      console.log('   1. Open the app');
      console.log('   2. Go to Settings');
      console.log('   3. Click "Disconnect" next to JIRA');
      console.log('   4. Click "Connect" and authorize again\n');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  }
}

refreshJIRAToken();


