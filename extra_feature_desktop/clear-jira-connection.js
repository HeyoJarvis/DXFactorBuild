/**
 * Clear JIRA connection from database
 * Run this to completely reset JIRA integration
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearJIRAConnection() {
  try {
    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    
    console.log('Clearing JIRA connection for user:', userId);
    
    const { data, error } = await supabase
      .from('team_sync_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('service_name', 'jira');
    
    if (error) {
      console.error('Error clearing JIRA connection:', error);
      process.exit(1);
    }
    
    console.log('✅ JIRA connection cleared successfully!');
    console.log('Now you can reconnect JIRA from Settings with a fresh Cloud ID.');
    
  } catch (error) {
    console.error('Failed to clear JIRA connection:', error.message);
    process.exit(1);
  }
}

clearJIRAConnection();

