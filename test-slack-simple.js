/**
 * Simple Slack Connection Test
 * 
 * Minimal test to verify Slack authentication without full bot setup
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { WebClient } = require('@slack/web-api');

async function testSlackSimple() {
  console.log('🔍 Simple Slack Connection Test\n');
  
  const botToken = process.env.SLACK_BOT_TOKEN;
  
  if (!botToken) {
    console.log('❌ SLACK_BOT_TOKEN not found in .env file');
    console.log('🔧 Please add: SLACK_BOT_TOKEN=xoxb-your-token-here');
    return;
  }
  
  console.log('🤖 Testing with token:', botToken.substring(0, 15) + '...');
  
  try {
    const web = new WebClient(botToken);
    
    console.log('📡 Calling auth.test...');
    const authTest = await web.auth.test();
    
    console.log('✅ SUCCESS! Slack connection working');
    console.log('📋 Bot Details:');
    console.log('   - User ID:', authTest.user_id);
    console.log('   - User Name:', authTest.user);
    console.log('   - Team ID:', authTest.team_id);
    console.log('   - Team Name:', authTest.team);
    console.log('   - App ID:', authTest.app_id);
    
    // Test basic permissions
    console.log('\n🔐 Testing Basic Permissions...');
    
    try {
      const users = await web.users.list({ limit: 1 });
      console.log('✅ Can read users');
    } catch (error) {
      console.log('❌ Cannot read users:', error.data?.error);
    }
    
    try {
      const conversations = await web.conversations.list({ limit: 1 });
      console.log('✅ Can read conversations');
    } catch (error) {
      console.log('❌ Cannot read conversations:', error.data?.error);
    }
    
    console.log('\n🎉 Slack authentication is working correctly!');
    console.log('🚀 You can now run the full bot test with: npm run test:slack-direct');
    
  } catch (error) {
    console.log('❌ FAILED! Slack connection error');
    console.log('🔍 Error details:', error.data?.error || error.message);
    
    if (error.data?.error === 'invalid_auth') {
      console.log('\n🔧 This means your bot token is invalid. Please:');
      console.log('   1. Go to https://api.slack.com/apps');
      console.log('   2. Select your HeyJarvis app');
      console.log('   3. Go to "Install App" and reinstall to workspace');
      console.log('   4. Copy the new "Bot User OAuth Token"');
      console.log('   5. Update SLACK_BOT_TOKEN in your .env file');
    }
    
    if (error.data?.error === 'not_authed') {
      console.log('\n🔧 Authentication failed. Check your token format:');
      console.log('   - Bot tokens should start with "xoxb-"');
      console.log('   - Make sure there are no extra spaces or characters');
    }
  }
}

// Run the test
if (require.main === module) {
  testSlackSimple().catch(console.error);
}

module.exports = { testSlackSimple };