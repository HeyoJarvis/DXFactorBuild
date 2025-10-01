/**
 * Slack Token Validation Script
 * 
 * This script validates Slack tokens without starting the full bot
 * to help diagnose authentication issues.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { WebClient } = require('@slack/web-api');

async function validateSlackTokens() {
  console.log('🔍 Slack Token Validation\n');
  
  // Check environment variables
  console.log('📋 Environment Variables Check:');
  const botToken = process.env.SLACK_BOT_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const appToken = process.env.SLACK_APP_TOKEN;
  
  console.log('   - SLACK_BOT_TOKEN:', botToken ? `✅ Present (${botToken.substring(0, 10)}...)` : '❌ Missing');
  console.log('   - SLACK_SIGNING_SECRET:', signingSecret ? `✅ Present (${signingSecret.substring(0, 10)}...)` : '❌ Missing');
  console.log('   - SLACK_APP_TOKEN:', appToken ? `✅ Present (${appToken.substring(0, 10)}...)` : '❌ Missing');
  console.log('   - SLACK_SOCKET_MODE:', process.env.SLACK_SOCKET_MODE);
  
  if (!botToken) {
    console.log('\n❌ SLACK_BOT_TOKEN is missing from .env file');
    console.log('🔧 Add: SLACK_BOT_TOKEN=xoxb-your-bot-token-here');
    return;
  }
  
  if (!signingSecret) {
    console.log('\n❌ SLACK_SIGNING_SECRET is missing from .env file');
    console.log('🔧 Add: SLACK_SIGNING_SECRET=your-signing-secret-here');
    return;
  }
  
  if (!appToken) {
    console.log('\n❌ SLACK_APP_TOKEN is missing from .env file');
    console.log('🔧 Add: SLACK_APP_TOKEN=xapp-your-app-token-here');
    return;
  }
  
  // Test Bot Token
  console.log('\n🤖 Testing Bot Token...');
  try {
    const web = new WebClient(botToken);
    const authTest = await web.auth.test();
    
    console.log('✅ Bot Token Valid!');
    console.log('   - Bot User ID:', authTest.user_id);
    console.log('   - Bot Name:', authTest.user);
    console.log('   - Team ID:', authTest.team_id);
    console.log('   - Team Name:', authTest.team);
    console.log('   - App ID:', authTest.app_id);
    
    // Test additional permissions
    console.log('\n🔐 Testing Bot Permissions...');
    
    try {
      const conversations = await web.conversations.list({ limit: 1 });
      console.log('✅ Can list conversations');
    } catch (error) {
      console.log('❌ Cannot list conversations:', error.data?.error || error.message);
    }
    
    try {
      const users = await web.users.list({ limit: 1 });
      console.log('✅ Can list users');
    } catch (error) {
      console.log('❌ Cannot list users:', error.data?.error || error.message);
    }
    
  } catch (error) {
    console.log('❌ Bot Token Invalid!');
    console.log('   - Error:', error.data?.error || error.message);
    
    if (error.data?.error === 'invalid_auth') {
      console.log('\n🔧 Possible Solutions:');
      console.log('   1. Check if bot token is correct (should start with xoxb-)');
      console.log('   2. Verify the Slack app is installed in your workspace');
      console.log('   3. Regenerate the bot token in your Slack app settings');
      console.log('   4. Ensure the app has proper OAuth scopes');
    }
    
    return;
  }
  
  // Test App Token (for Socket Mode)
  if (process.env.SLACK_SOCKET_MODE === 'true') {
    console.log('\n📱 Testing App Token for Socket Mode...');
    try {
      const web = new WebClient(appToken);
      const authTest = await web.auth.test();
      
      console.log('✅ App Token Valid!');
      console.log('   - App ID:', authTest.app_id);
      
    } catch (error) {
      console.log('❌ App Token Invalid!');
      console.log('   - Error:', error.data?.error || error.message);
      
      if (error.data?.error === 'invalid_auth') {
        console.log('\n🔧 App Token Solutions:');
        console.log('   1. Check if app token is correct (should start with xapp-)');
        console.log('   2. Regenerate the app token in your Slack app settings');
        console.log('   3. Ensure Socket Mode is enabled in your Slack app');
      }
    }
  }
  
  console.log('\n🎯 Token Validation Complete!');
  console.log('\nIf all tokens are valid, the Slack bot should work properly.');
  console.log('If you see errors above, follow the suggested solutions.');
}

// Run validation
if (require.main === module) {
  validateSlackTokens().catch(error => {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = { validateSlackTokens };
