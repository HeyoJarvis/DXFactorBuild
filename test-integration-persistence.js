/**
 * Test Integration Persistence Fix
 * 
 * This script verifies that Microsoft and Google integration tokens
 * are properly saved to the database and persist across sessions.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testIntegrationPersistence() {
  console.log('🧪 Testing Integration Persistence Fix\n');
  
  try {
    // Get all users with integrations
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, integration_settings')
      .not('integration_settings', 'is', null);
    
    if (error) {
      console.error('❌ Error fetching users:', error.message);
      return;
    }
    
    console.log(`📊 Found ${users.length} users with integration settings\n`);
    
    for (const user of users) {
      console.log(`\n👤 User: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      
      const settings = user.integration_settings || {};
      
      // Check Microsoft
      if (settings.microsoft) {
        const ms = settings.microsoft;
        console.log(`\n   🔵 Microsoft Teams:`);
        console.log(`      ✓ Authenticated: ${ms.authenticated || false}`);
        console.log(`      ✓ Account: ${ms.account || 'N/A'}`);
        console.log(`      ✓ Has Access Token: ${!!ms.access_token}`);
        console.log(`      ✓ Has Refresh Token: ${!!ms.refresh_token}`);
        console.log(`      ✓ Token Expiry: ${ms.token_expiry || 'N/A'}`);
        console.log(`      ✓ Connected At: ${ms.connected_at || 'N/A'}`);
        console.log(`      ✓ Last Auth: ${ms.last_authenticated_at || 'N/A'}`);
        
        // Validate token persistence
        if (ms.authenticated && !ms.access_token) {
          console.log(`      ⚠️  WARNING: Authenticated but missing access token!`);
        } else if (ms.authenticated && ms.access_token) {
          console.log(`      ✅ PASS: Tokens properly persisted`);
        }
      } else {
        console.log(`   🔵 Microsoft Teams: Not connected`);
      }
      
      // Check Google
      if (settings.google) {
        const google = settings.google;
        console.log(`\n   🔴 Google Workspace:`);
        console.log(`      ✓ Authenticated: ${google.authenticated || false}`);
        console.log(`      ✓ Email: ${google.email || 'N/A'}`);
        console.log(`      ✓ Name: ${google.name || 'N/A'}`);
        console.log(`      ✓ Has Access Token: ${!!google.access_token}`);
        console.log(`      ✓ Has Refresh Token: ${!!google.refresh_token}`);
        console.log(`      ✓ Token Expiry: ${google.token_expiry || 'N/A'}`);
        console.log(`      ✓ Connected At: ${google.connected_at || 'N/A'}`);
        console.log(`      ✓ Last Auth: ${google.last_authenticated_at || 'N/A'}`);
        
        // Validate token persistence
        if (google.authenticated && !google.access_token) {
          console.log(`      ⚠️  WARNING: Authenticated but missing access token!`);
        } else if (google.authenticated && google.access_token) {
          console.log(`      ✅ PASS: Tokens properly persisted`);
        }
      } else {
        console.log(`   🔴 Google Workspace: Not connected`);
      }
      
      // Check JIRA
      if (settings.jira) {
        const jira = settings.jira;
        console.log(`\n   🟦 JIRA:`);
        console.log(`      ✓ Has Access Token: ${!!jira.access_token}`);
        console.log(`      ✓ Has Refresh Token: ${!!jira.refresh_token}`);
        console.log(`      ✓ Site URL: ${jira.site_url || 'N/A'}`);
        console.log(`      ✓ Cloud ID: ${jira.cloud_id || 'N/A'}`);
        
        if (jira.access_token) {
          console.log(`      ✅ PASS: Tokens properly persisted`);
        }
      } else {
        console.log(`   🟦 JIRA: Not connected`);
      }
      
      console.log(`\n   ${'─'.repeat(60)}`);
    }
    
    console.log(`\n\n✅ Test Complete!`);
    console.log(`\n📝 Summary:`);
    console.log(`   - Total users checked: ${users.length}`);
    console.log(`   - Microsoft connections: ${users.filter(u => u.integration_settings?.microsoft?.authenticated).length}`);
    console.log(`   - Google connections: ${users.filter(u => u.integration_settings?.google?.authenticated).length}`);
    console.log(`   - JIRA connections: ${users.filter(u => u.integration_settings?.jira?.access_token).length}`);
    
    // Check for any users with authenticated flag but missing tokens
    const brokenMicrosoft = users.filter(u => 
      u.integration_settings?.microsoft?.authenticated && 
      !u.integration_settings?.microsoft?.access_token
    );
    
    const brokenGoogle = users.filter(u => 
      u.integration_settings?.google?.authenticated && 
      !u.integration_settings?.google?.access_token
    );
    
    if (brokenMicrosoft.length > 0 || brokenGoogle.length > 0) {
      console.log(`\n⚠️  WARNINGS:`);
      if (brokenMicrosoft.length > 0) {
        console.log(`   - ${brokenMicrosoft.length} users have Microsoft authenticated but missing tokens`);
        console.log(`     Users: ${brokenMicrosoft.map(u => u.email).join(', ')}`);
      }
      if (brokenGoogle.length > 0) {
        console.log(`   - ${brokenGoogle.length} users have Google authenticated but missing tokens`);
        console.log(`     Users: ${brokenGoogle.map(u => u.email).join(', ')}`);
      }
      console.log(`\n   💡 These users will need to reconnect their integrations.`);
    } else {
      console.log(`\n✅ All authenticated integrations have valid tokens!`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testIntegrationPersistence()
  .then(() => {
    console.log('\n👋 Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

