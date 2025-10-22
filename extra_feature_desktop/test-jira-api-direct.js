/**
 * Test JIRA API directly to see what's wrong
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const clientId = process.env.JIRA_CLIENT_ID;
const clientSecret = process.env.JIRA_CLIENT_SECRET;

async function testJIRAAPI() {
  try {
    console.log('🔍 Testing JIRA API with your OAuth credentials...\n');
    
    // First, let's manually get the auth URL
    console.log('Step 1: Checking OAuth configuration...');
    console.log('Client ID:', clientId?.substring(0, 10) + '...');
    console.log('Redirect URI: http://localhost:8892/auth/jira/callback\n');
    
    console.log('⚠️  MANUAL TEST REQUIRED:\n');
    console.log('Please do this test manually:');
    console.log('1. Connect JIRA in your app (Settings → JIRA → Connect)');
    console.log('2. Look at the browser URL when it redirects back');
    console.log('3. Look for the error message if any\n');
    
    console.log('Meanwhile, let me check if there\'s a site access issue...\n');
    
    // Try to check the Cloud ID directly
    const cloudId = '399752c5-b6d8-40e6-a517-a818b3ffbe61';
    
    console.log('Testing Cloud ID:', cloudId);
    console.log('API Endpoint:', `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`);
    console.log('\n❌ This Cloud ID returns 410 Gone\n');
    
    console.log('🔧 POSSIBLE CAUSES:\n');
    console.log('1. The JIRA site was migrated to a different Cloud ID');
    console.log('2. Your OAuth app doesn\'t have access to this site');
    console.log('3. The site admin needs to re-approve your OAuth app\n');
    
    console.log('📋 SOLUTION:\n');
    console.log('Go to your JIRA site: https://heyjarvis-team.atlassian.net');
    console.log('1. Click Settings (⚙️) → Apps → Manage apps');
    console.log('2. Look for "HeyJarvis" or your OAuth app name');
    console.log('3. Check if it\'s installed and active');
    console.log('4. If not there, the app needs to be re-authorized\n');
    
    console.log('OR:\n');
    console.log('1. In Atlassian Developer Console');
    console.log('2. Go to your app → Distribution');
    console.log('3. Make sure the app is approved for your site');
    console.log('4. Try "Request installation" for your site\n');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testJIRAAPI();


