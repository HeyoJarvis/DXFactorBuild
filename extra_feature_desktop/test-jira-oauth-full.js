/**
 * Full JIRA OAuth test - simulates what the app does
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFullOAuth() {
  try {
    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    
    console.log('🔍 Full JIRA OAuth Flow Test\n');
    console.log('=' .repeat(60));
    
    // Step 1: Check if we have a connection in DB
    console.log('\n📊 Step 1: Checking database for existing connection...');
    const { data: integration, error: dbError } = await supabase
      .from('team_sync_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'jira')
      .single();
    
    if (dbError || !integration) {
      console.log('❌ No JIRA connection found in database');
      console.log('Please connect JIRA in the app first, then run this test again.');
      return;
    }
    
    console.log('✅ Found JIRA connection in database');
    console.log('   Cloud ID:', integration.cloud_id);
    console.log('   Site URL:', integration.site_url);
    console.log('   Connected:', new Date(integration.connected_at).toLocaleString());
    
    // Step 2: Test accessible resources
    console.log('\n📊 Step 2: Testing accessible resources...');
    const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!resourcesResponse.ok) {
      console.log('❌ Failed to fetch accessible resources');
      console.log('   Status:', resourcesResponse.status);
      console.log('   This means your access token is invalid or expired');
      return;
    }
    
    const resources = await resourcesResponse.json();
    console.log('✅ Successfully fetched accessible resources');
    console.log('   Found', resources.length, 'JIRA site(s):\n');
    
    resources.forEach((resource, index) => {
      console.log(`   Site ${index + 1}:`);
      console.log('   - Name:', resource.name);
      console.log('   - URL:', resource.url);
      console.log('   - Cloud ID:', resource.id);
      console.log('   - Scopes:', resource.scopes.join(', '));
      
      if (resource.id === integration.cloud_id) {
        console.log('   ✅ THIS MATCHES THE SAVED CLOUD ID');
      } else {
        console.log('   ⚠️  THIS IS A DIFFERENT CLOUD ID!');
      }
      console.log('');
    });
    
    // Step 3: Test API call with saved Cloud ID
    console.log('📊 Step 3: Testing API call with saved Cloud ID...');
    console.log('   Cloud ID:', integration.cloud_id);
    console.log('   Endpoint: /rest/api/3/myself\n');
    
    const apiResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${integration.cloud_id}/rest/api/3/myself`,
      {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('   Response status:', apiResponse.status);
    
    if (apiResponse.status === 410) {
      console.log('   ❌ 410 GONE ERROR!\n');
      console.log('   This means the Cloud ID is invalid or the site has moved.\n');
      
      // Check if there's a different Cloud ID we should use
      if (resources.length > 0 && resources[0].id !== integration.cloud_id) {
        console.log('   🔧 FIX DETECTED:');
        console.log('   The saved Cloud ID is wrong!');
        console.log('   Saved Cloud ID:', integration.cloud_id);
        console.log('   Correct Cloud ID:', resources[0].id);
        console.log('\n   Let me update the database...');
        
        const { error: updateError } = await supabase
          .from('team_sync_integrations')
          .update({
            cloud_id: resources[0].id,
            site_url: resources[0].url
          })
          .eq('user_id', userId)
          .eq('service_name', 'jira');
        
        if (updateError) {
          console.log('   ❌ Failed to update:', updateError.message);
        } else {
          console.log('   ✅ Database updated with correct Cloud ID!');
          console.log('\n   Now testing with the correct Cloud ID...\n');
          
          // Test again with correct Cloud ID
          const retestResponse = await fetch(
            `https://api.atlassian.com/ex/jira/${resources[0].id}/rest/api/3/myself`,
            {
              headers: {
                'Authorization': `Bearer ${integration.access_token}`,
                'Accept': 'application/json'
              }
            }
          );
          
          console.log('   Retest status:', retestResponse.status);
          
          if (retestResponse.ok) {
            const userData = await retestResponse.json();
            console.log('   ✅ SUCCESS! JIRA API is now working!');
            console.log('   User:', userData.displayName);
            console.log('   Email:', userData.emailAddress);
            console.log('\n🎉 JIRA integration is now fixed!');
            console.log('   Go to your dashboard and click "Sync Now"');
          } else {
            console.log('   ❌ Still failing with status:', retestResponse.status);
            const errorText = await retestResponse.text();
            console.log('   Error:', errorText);
          }
        }
      } else {
        console.log('   ⚠️  No alternative Cloud ID found.');
        console.log('   This means your JIRA site might not be accessible.');
      }
    } else if (apiResponse.ok) {
      const userData = await apiResponse.json();
      console.log('   ✅ API call successful!');
      console.log('   User:', userData.displayName);
      console.log('   Email:', userData.emailAddress);
      console.log('\n✅ JIRA OAuth is working correctly!');
    } else {
      console.log('   ❌ API call failed with status:', apiResponse.status);
      const errorText = await apiResponse.text();
      console.log('   Error:', errorText);
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testFullOAuth();


