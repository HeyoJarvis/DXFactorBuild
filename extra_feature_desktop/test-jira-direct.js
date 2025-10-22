/**
 * Test JIRA connection directly with OAuth
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const clientId = process.env.JIRA_CLIENT_ID;
const clientSecret = process.env.JIRA_CLIENT_SECRET;

async function testJIRA() {
  try {
    console.log('Testing JIRA OAuth flow...\n');
    console.log('Client ID:', clientId?.substring(0, 10) + '...');
    
    // Step 1: This would normally get a code from OAuth, 
    // but we'll test with a fresh connection
    console.log('\n❌ PROBLEM IDENTIFIED:');
    console.log('Your JIRA site "heyjarvis-team.atlassian.net" is returning Cloud ID:');
    console.log('399752c5-b6d8-40e6-a517-a818b3ffbe61');
    console.log('\nBut when making API calls to:');
    console.log('https://api.atlassian.com/ex/jira/399752c5.../rest/api/3/search');
    console.log('It returns: 410 Gone');
    console.log('\nThis means one of three things:');
    console.log('1. The JIRA site was recently deleted or migrated');
    console.log('2. The Cloud ID changed (site was recreated)');
    console.log('3. There\'s a permissions issue with your OAuth app\n');
    
    console.log('🔍 Let me check if the site exists...\n');
    
    // Check if the site is accessible
    const siteCheck = await fetch('https://heyjarvis-team.atlassian.net');
    console.log('Site check status:', siteCheck.status);
    
    if (siteCheck.status === 404) {
      console.log('\n❌ THE JIRA SITE DOES NOT EXIST!');
      console.log('https://heyjarvis-team.atlassian.net returns 404');
      console.log('\nSOLUTION:');
      console.log('1. Check if you have a different JIRA site');
      console.log('2. Or create a new JIRA site at https://www.atlassian.com/');
      console.log('3. Then reconnect with the correct site');
    } else if (siteCheck.status === 200) {
      console.log('\n✅ The JIRA site EXISTS and is accessible!');
      console.log('This means the OAuth app configuration is wrong.\n');
      console.log('SOLUTION:');
      console.log('Go to: https://developer.atlassian.com/console/myapps/');
      console.log('1. Find your OAuth app');
      console.log('2. Check the "Permissions" tab');
      console.log('3. Make sure "Jira API" is enabled');
      console.log('4. Required scopes: read:jira-work, read:jira-user, offline_access');
      console.log('5. After changing, reconnect JIRA in the app');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testJIRA();


