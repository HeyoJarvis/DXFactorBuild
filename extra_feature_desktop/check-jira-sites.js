/**
 * Check which JIRA sites are accessible with your OAuth tokens
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJIRASites() {
  try {
    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    
    console.log('Fetching JIRA integration details...\n');
    
    const { data, error } = await supabase
      .from('team_sync_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'jira')
      .single();
    
    if (error || !data) {
      console.log('❌ No JIRA connection found in database.');
      console.log('Please reconnect JIRA from Settings first.');
      return;
    }
    
    console.log('✅ JIRA connection found in database:');
    console.log('-------------------------------------------');
    console.log('Cloud ID:', data.cloud_id);
    console.log('Site URL:', data.site_url);
    console.log('Connected at:', data.connected_at);
    console.log('-------------------------------------------\n');
    
    // Try to fetch accessible resources with the token
    console.log('Fetching accessible JIRA sites with your token...\n');
    
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log('❌ Failed to fetch accessible resources:', response.status);
      return;
    }
    
    const resources = await response.json();
    
    if (!resources || resources.length === 0) {
      console.log('❌ No JIRA sites accessible with this token.');
      console.log('This means you might not have access to any JIRA sites.');
      return;
    }
    
    console.log('✅ Found', resources.length, 'accessible JIRA site(s):\n');
    
    resources.forEach((resource, index) => {
      console.log(`Site ${index + 1}:`);
      console.log('  Name:', resource.name);
      console.log('  URL:', resource.url);
      console.log('  Cloud ID:', resource.id);
      console.log('  Scopes:', resource.scopes.join(', '));
      
      if (resource.id === data.cloud_id) {
        console.log('  ⚠️  THIS IS THE CLOUD ID CURRENTLY SAVED (and it\'s getting 410 errors!)');
      }
      console.log('');
    });
    
    console.log('\n💡 Recommendation:');
    if (resources.length === 1) {
      if (resources[0].id === data.cloud_id) {
        console.log('The Cloud ID is correct, but the JIRA API is returning 410.');
        console.log('This usually means the JIRA site was recently migrated or deleted.');
        console.log('Try contacting your JIRA admin or check if the site exists at:', resources[0].url);
      } else {
        console.log('The saved Cloud ID doesn\'t match your accessible site!');
        console.log('Expected Cloud ID:', resources[0].id);
        console.log('Saved Cloud ID:', data.cloud_id);
        console.log('\nLet me update the database with the correct Cloud ID...');
        
        // Update with correct Cloud ID
        await supabase
          .from('team_sync_integrations')
          .update({ 
            cloud_id: resources[0].id,
            site_url: resources[0].url
          })
          .eq('user_id', userId)
          .eq('service_name', 'jira');
        
        console.log('✅ Database updated with correct Cloud ID!');
        console.log('Now try clicking "Sync Now" in your dashboard.');
      }
    } else {
      console.log('You have access to multiple JIRA sites.');
      console.log('The saved Cloud ID is:', data.cloud_id);
      console.log('Make sure you\'re connecting to the right site when you click "Connect".');
    }
    
  } catch (error) {
    console.error('Failed to check JIRA sites:', error.message);
  }
}

checkJIRASites();


