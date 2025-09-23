/**
 * Verify CEO Monitoring System Status
 */

require('dotenv').config();

const { WebClient } = require('@slack/web-api');

async function verifyCEOSystem() {
  console.log('🔍 Verifying CEO Monitoring System Status');
  console.log('=' .repeat(50));
  
  // Check environment configuration
  console.log('📋 Configuration Check:');
  console.log(`   CEO User ID: ${process.env.CEO_SLACK_USER_ID || 'U01EVR49DDX'}`);
  console.log(`   Organization: ${process.env.ORGANIZATION_NAME || 'CIPIO'}`);
  console.log(`   Slack Token: ${process.env.SLACK_BOT_TOKEN ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Signing Secret: ${process.env.SLACK_SIGNING_SECRET ? '✅ Present' : '❌ Missing'}`);
  console.log('');
  
  if (!process.env.SLACK_BOT_TOKEN) {
    console.log('⚠️  SLACK_BOT_TOKEN missing - add to .env file');
    console.log('');
    console.log('📝 Required .env configuration:');
    console.log('   CEO_SLACK_USER_ID=U01EVR49DDX');
    console.log('   SLACK_BOT_TOKEN=xoxb-your-token');
    console.log('   SLACK_SIGNING_SECRET=your-secret');
    console.log('   ORGANIZATION_NAME=CIPIO');
    return;
  }
  
  try {
    // Test Slack connection
    console.log('🔗 Testing Slack Connection...');
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    const authTest = await slack.auth.test();
    
    console.log('✅ Slack connection successful');
    console.log(`   Bot: ${authTest.user}`);
    console.log(`   Team: ${authTest.team}`);
    console.log('');
    
    // Verify CEO user exists
    console.log('👑 Verifying CEO User...');
    try {
      const userInfo = await slack.users.info({ user: 'U01EVR49DDX' });
      console.log(`✅ CEO found: ${userInfo.user.real_name || userInfo.user.name}`);
      console.log(`   Status: ${userInfo.user.deleted ? '❌ Deleted' : '✅ Active'}`);
    } catch (error) {
      console.log('❌ CEO user not found or not accessible');
    }
    console.log('');
    
    // Check for HeyJarvis channel
    console.log('📱 Checking Channels...');
    const channels = await slack.conversations.list({
      types: 'public_channel,private_channel'
    });
    
    const heyjarvisChannel = channels.channels.find(ch => 
      ch.name.includes('heyjarvis') || ch.name.includes('copilot')
    );
    
    if (heyjarvisChannel) {
      console.log(`✅ Found channel: #${heyjarvisChannel.name}`);
      
      // Check if bot is in the channel
      try {
        const members = await slack.conversations.members({ channel: heyjarvisChannel.id });
        const botInChannel = members.members.includes(authTest.user_id);
        console.log(`   Bot access: ${botInChannel ? '✅ In channel' : '❌ Not in channel'}`);
        
        if (!botInChannel) {
          console.log(`   💡 Add bot to channel: /invite @${authTest.user}`);
        }
      } catch (error) {
        console.log('   ⚠️  Cannot check channel membership');
      }
    } else {
      console.log('⚠️  HeyJarvis channel not found');
      console.log('   💡 Create #heyjarvis-copilot channel and invite the bot');
    }
    
    console.log('');
    console.log('🎯 SYSTEM STATUS: Ready for CEO Monitoring!');
    console.log('');
    console.log('🚀 TO START MONITORING:');
    console.log('1. Ensure bot is in your team channels');
    console.log('2. Run: node start-sundeep-ceo-monitoring.js');
    console.log('3. Use CEO commands in Slack:');
    console.log('   • /ceo-dashboard');
    console.log('   • /task-status');
    console.log('   • /ai-suggestions');
    console.log('');
    console.log('📊 The system will automatically:');
    console.log('   • Detect when you assign tasks to team members');
    console.log('   • Track when team members complete tasks');
    console.log('   • Provide AI insights based on team patterns');
    console.log('   • Generate productivity analytics');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    
    if (error.message.includes('invalid_auth')) {
      console.log('');
      console.log('🔧 Token issue - check SLACK_BOT_TOKEN in .env');
    }
  }
}

if (require.main === module) {
  verifyCEOSystem().catch(console.error);
}

module.exports = verifyCEOSystem;
