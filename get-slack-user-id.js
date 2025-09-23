/**
 * Get Your Real Slack User ID
 * 
 * This script helps you find your Slack user ID for CEO setup
 */

require('dotenv').config();

const { WebClient } = require('@slack/web-api');

async function getSlackUserInfo() {
  console.log('🔍 Getting your Slack user information...\n');
  
  if (!process.env.SLACK_BOT_TOKEN) {
    console.error('❌ SLACK_BOT_TOKEN not found in .env file');
    console.log('\n📋 To get your Slack user ID:');
    console.log('1. Go to your Slack workspace');
    console.log('2. Type /me in any channel');
    console.log('3. Look for your user ID in the response (format: U############)');
    console.log('4. Add it to your .env file as CEO_SLACK_USER_ID=U############');
    return;
  }
  
  try {
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    
    // Get bot info to verify token works
    const authTest = await slack.auth.test();
    console.log('✅ Slack connection successful');
    console.log(`   Bot User ID: ${authTest.user_id}`);
    console.log(`   Team: ${authTest.team}`);
    console.log(`   Bot Name: ${authTest.user}\n`);
    
    // List users to help find the CEO
    console.log('👥 Team members in your workspace:');
    const usersList = await slack.users.list();
    
    usersList.members
      .filter(user => !user.is_bot && !user.deleted)
      .slice(0, 10) // Show first 10 real users
      .forEach(user => {
        const isAdmin = user.is_admin ? ' (Admin)' : '';
        const isOwner = user.is_owner ? ' (Owner)' : '';
        console.log(`   ${user.real_name || user.name}: ${user.id}${isAdmin}${isOwner}`);
      });
    
    console.log('\n💡 To set yourself as CEO:');
    console.log('1. Find your user ID from the list above');
    console.log('2. Add to .env file: CEO_SLACK_USER_ID=YOUR_USER_ID');
    console.log('3. Run: node ceo-slack-integration.js');
    
    // Get channel info for the heyjarvis-copilot channel
    console.log('\n📱 Channels information:');
    const channelsList = await slack.conversations.list({
      types: 'public_channel,private_channel'
    });
    
    const heyjarvisChannel = channelsList.channels.find(channel => 
      channel.name.includes('heyjarvis') || channel.name.includes('copilot')
    );
    
    if (heyjarvisChannel) {
      console.log(`   Found HeyJarvis channel: #${heyjarvisChannel.name} (${heyjarvisChannel.id})`);
      console.log('   ✅ Your bot is ready to monitor this channel');
    } else {
      console.log('   ⚠️  HeyJarvis channel not found. Make sure the bot is added to your channel.');
    }
    
  } catch (error) {
    console.error('❌ Error connecting to Slack:', error.message);
    
    if (error.message.includes('invalid_auth')) {
      console.log('\n🔧 Token issue:');
      console.log('1. Check that SLACK_BOT_TOKEN is correct in .env');
      console.log('2. Make sure the bot is installed in your workspace');
      console.log('3. Verify the token has necessary permissions');
    }
  }
}

if (require.main === module) {
  getSlackUserInfo().catch(console.error);
}

module.exports = getSlackUserInfo;
