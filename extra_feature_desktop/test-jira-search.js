/**
 * Test JIRA search endpoint specifically
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJIRASearch() {
  try {
    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    
    console.log('🔍 Testing JIRA Search Endpoint\n');
    
    const { data: integration } = await supabase
      .from('team_sync_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'jira')
      .single();
    
    if (!integration) {
      console.log('❌ No JIRA connection found');
      return;
    }
    
    console.log('Testing with Cloud ID:', integration.cloud_id);
    console.log('Site:', integration.site_url);
    console.log('');
    
    // Test 1: /myself endpoint (we know this works)
    console.log('Test 1: /myself endpoint...');
    const myselfResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${integration.cloud_id}/rest/api/3/myself`,
      {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    console.log('Status:', myselfResponse.status, myselfResponse.ok ? '✅' : '❌');
    console.log('');
    
    // Test 2: /search endpoint (this is failing)
    console.log('Test 2: /search endpoint...');
    const searchResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${integration.cloud_id}/rest/api/3/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jql: 'updated >= "2025-10-11" ORDER BY updated DESC',
          maxResults: 10,
          fields: ['summary', 'status']
        })
      }
    );
    
    console.log('Status:', searchResponse.status, searchResponse.ok ? '✅' : '❌');
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.log('Error:', errorText);
      console.log('');
      console.log('🔧 DIAGNOSIS:');
      console.log('The /search endpoint returns 410, which means:');
      console.log('1. Your OAuth app doesn\'t have read:jira-work scope properly');
      console.log('2. OR the scope needs to be granted to the Jira Cloud platform');
      console.log('3. OR your site doesn\'t allow OAuth apps to search issues');
      console.log('');
      console.log('📋 FIX:');
      console.log('Go to: https://developer.atlassian.com/console/myapps/');
      console.log('1. Click on your app');
      console.log('2. Go to Permissions → Jira API → Configure');
      console.log('3. Make sure these are checked:');
      console.log('   - read:jira-work (classic)');
      console.log('   - read:jira-user (classic)');
      console.log('4. Under "Jira platform REST API", enable:');
      console.log('   - View and manage issues');
      console.log('   - View user details');
      console.log('5. Save and reconnect JIRA in your app');
    } else {
      const data = await searchResponse.json();
      console.log('✅ Search works! Found', data.total, 'issues');
      console.log('Issues:', data.issues?.map(i => i.key).join(', '));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testJIRASearch();


