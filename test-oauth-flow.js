/**
 * Test OAuth Flow - Shows what the OAuth URL looks like
 */

require('dotenv').config();

function generateTestOAuthURL() {
  // This is what the OAuth URL would look like with your real credentials
  const clientId = process.env.SLACK_CLIENT_ID || 'YOUR_CLIENT_ID';
  const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/auth/slack/callback';
  
  const scopes = [
    'channels:history',    // Read public channel messages
    'groups:history',      // Read private channel messages  
    'im:history',          // Read DM messages
    'mpim:history',        // Read group DM messages
    'users:read',          // Read user information
    'channels:read',       // List channels
    'groups:read',         // List private channels
    'im:read',             // List DMs
    'mpim:read'            // List group DMs
  ].join(',');
  
  const oauthUrl = `https://slack.com/oauth/v2/authorize?` +
    `client_id=${clientId}&` +
    `scope=&` +  // No bot scopes
    `user_scope=${scopes}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=test-user-123&` +
    `response_type=code`;
  
  return oauthUrl;
}

console.log('🔗 SLACK OAUTH FLOW EXPLANATION');
console.log('=' .repeat(50));

console.log('\n📱 Step 1: Sign into Slack Workspace');
console.log('   • Go to cipio.slack.com (or your workspace URL)');
console.log('   • Sign in with Google (or however you normally sign in)');
console.log('   • This gets you into your Slack workspace');

console.log('\n🔐 Step 2: Authorize HeyJarvis App');
console.log('   • Our system generates a special OAuth URL');
console.log('   • This URL asks for permission to access your Slack data');
console.log('   • You\'ll see a screen asking to authorize HeyJarvis');

console.log('\n🌐 Example OAuth URL (what our system generates):');
const oauthUrl = generateTestOAuthURL();
console.log(`   ${oauthUrl.substring(0, 100)}...`);

console.log('\n✅ What you\'ll see on the OAuth page:');
console.log('   • "HeyJarvis wants to access your Slack workspace"');
console.log('   • List of permissions (read messages, access DMs, etc.)');
console.log('   • "Allow" or "Deny" buttons');
console.log('   • You click "Allow" to give us access');

console.log('\n🎯 The Difference:');
console.log('   • Workspace sign-in = Access your Slack workspace');
console.log('   • OAuth authorization = Give HeyJarvis permission to read your data');

console.log('\n🚀 For Testing:');
console.log('   1. First: Sign into your Slack workspace normally');
console.log('   2. Then: Use our OAuth URL to authorize the HeyJarvis app');
console.log('   3. Result: We can read your DMs, channels, etc. with your consent');

console.log('\n📋 Environment Check:');
console.log(`   SLACK_CLIENT_ID: ${process.env.SLACK_CLIENT_ID ? '✅ Set' : '❌ Missing (needed for OAuth)'}`);
console.log(`   SLACK_CLIENT_SECRET: ${process.env.SLACK_CLIENT_SECRET ? '✅ Set' : '❌ Missing (needed for OAuth)'}`);

if (!process.env.SLACK_CLIENT_ID) {
  console.log('\n⚠️  To test OAuth, you need:');
  console.log('   1. Create a Slack App at api.slack.com/apps');
  console.log('   2. Get Client ID and Client Secret');
  console.log('   3. Add them to your .env file');
  console.log('   4. Configure OAuth scopes in the Slack App settings');
}

console.log('\n💡 Answer: You can sign in to Slack with Google normally,');
console.log('    but you still need to authorize our app via OAuth!');
