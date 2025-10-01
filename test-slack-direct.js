/**
 * Direct Slack Integration Test
 * 
 * This test directly uses the Slack Bolt framework to monitor messages
 * without relying on the complex app structure.
 */

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const { App } = require('@slack/bolt');

async function testSlackDirect() {
  console.log('🚀 Direct Slack Integration Test\n');
  
  try {
    // Check environment variables
    console.log('🔍 Environment Check:');
    console.log('   - SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? '✅ Present' : '❌ Missing');
    console.log('   - SLACK_SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? '✅ Present' : '❌ Missing');
    console.log('   - SLACK_APP_TOKEN:', process.env.SLACK_APP_TOKEN ? '✅ Present' : '❌ Missing');
    console.log('   - SLACK_SOCKET_MODE:', process.env.SLACK_SOCKET_MODE);
    
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET || !process.env.SLACK_APP_TOKEN) {
      throw new Error('Missing required Slack environment variables');
    }
    
    console.log('\n📱 Initializing Slack Bolt App...');
    
    // Initialize Slack Bolt app directly
    const app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: process.env.SLACK_SOCKET_MODE === 'true',
      appToken: process.env.SLACK_APP_TOKEN,
      port: 3001
    });
    
    // Message handler - captures all messages
    app.message(async ({ message, context }) => {
      // Skip bot messages
      if (message.subtype === 'bot_message' || message.bot_id) {
        return;
      }
      
      console.log('\n🎯 NEW MESSAGE CAPTURED!');
      console.log('   - User ID:', message.user);
      console.log('   - Channel ID:', message.channel);
      console.log('   - Message Text:', message.text);
      console.log('   - Timestamp:', message.ts);
      console.log('   - Channel Type:', context.channelType);
      
      // Simulate workflow intelligence processing
      console.log('\n💡 Workflow Intelligence Processing:');
      
      // Simple intent detection
      const text = message.text.toLowerCase();
      let intent = 'general';
      let urgency = 'normal';
      let entities = [];
      let tools = [];
      
      if (text.includes('help') || text.includes('need')) {
        intent = 'request_help';
        urgency = 'medium';
      }
      if (text.includes('urgent') || text.includes('asap') || text.includes('emergency')) {
        urgency = 'high';
      }
      if (text.includes('crm') || text.includes('hubspot') || text.includes('salesforce')) {
        tools.push('CRM');
        entities.push('crm_system');
      }
      if (text.includes('lead') || text.includes('qualification') || text.includes('prospect')) {
        entities.push('lead_management');
      }
      if (text.includes('automation') || text.includes('workflow') || text.includes('process')) {
        entities.push('process_automation');
      }
      
      console.log('   - Detected Intent:', intent);
      console.log('   - Urgency Level:', urgency);
      console.log('   - Entities:', entities.length > 0 ? entities.join(', ') : 'none');
      console.log('   - Tools Mentioned:', tools.length > 0 ? tools.join(', ') : 'none');
      
      // This is the data structure that would be used in session context
      const workflowData = {
        id: `msg_${Date.now()}`,
        userId: message.user,
        channelId: message.channel,
        timestamp: new Date(),
        type: 'inbound',
        content: message.text,
        context: {
          messageType: 'message',
          urgency: urgency,
          intent: { intent: intent, confidence: 0.8 },
          entities: entities,
          tools_mentioned: tools,
          sentiment: 'neutral',
          channel_name: context.channelType
        }
      };
      
      console.log('\n📋 Session Context Data Structure:');
      console.log('   This message would be stored as:', JSON.stringify(workflowData, null, 2));
      
      console.log('\n🔄 Next Steps in Session Architecture:');
      console.log('   1. Store this message in WorkflowIntelligenceSystem');
      console.log('   2. Add to fresh Slack workflows for current session');
      console.log('   3. Combine with persistent CRM context');
      console.log('   4. Generate AI recommendations using combined context');
    });
    
    // App mention handler
    app.event('app_mention', async ({ event }) => {
      console.log('\n🤖 BOT MENTIONED!');
      console.log('   - User ID:', event.user);
      console.log('   - Channel ID:', event.channel);
      console.log('   - Mention Text:', event.text);
      console.log('   - This would trigger immediate AI assistance');
    });
    
    // Start the app
    console.log('\n🔄 Starting Slack Bot...');
    await app.start();
    
    console.log('\n✅ Slack Bot Started Successfully!');
    console.log('🎯 Ready to Monitor Messages');
    console.log('\n📋 Test Instructions:');
    console.log('   1. Go to your Slack workspace where the bot is installed');
    console.log('   2. Send messages in any channel - the bot will capture them');
    console.log('   3. Try these test messages:');
    console.log('      - "I need help with lead qualification"');
    console.log('      - "Our CRM process is taking too long"');
    console.log('      - "Can someone help me set up HubSpot workflows?"');
    console.log('      - "URGENT: The sales team needs automation ASAP"');
    console.log('   4. Mention the bot: @HeyJarvis help me with something');
    console.log('   5. Watch this console for real-time message processing');
    
    console.log('\n🔄 The bot will automatically:');
    console.log('   - Capture your messages in real-time');
    console.log('   - Analyze intent, urgency, and entities');
    console.log('   - Extract mentioned tools and systems');
    console.log('   - Show the data structure for session context');
    console.log('   - Demonstrate workflow intelligence processing');
    
    console.log('\n⏹️  Press Ctrl+C to stop monitoring\n');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Stopping Slack bot...');
      await app.stop();
      console.log('✅ Slack bot stopped');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Slack integration test failed:', error.message);
    
    if (error.message.includes('Missing required Slack')) {
      console.log('\n🔧 Fix: Ensure your .env file has:');
      console.log('   SLACK_BOT_TOKEN=xoxb-...');
      console.log('   SLACK_SIGNING_SECRET=...');
      console.log('   SLACK_APP_TOKEN=xapp-...');
      console.log('   SLACK_SOCKET_MODE=true');
    }
    
    if (error.message.includes('invalid_auth') || error.message.includes('not_authed')) {
      console.log('\n🔧 Fix: Your Slack tokens may be expired or invalid');
      console.log('   - Check your Slack app configuration');
      console.log('   - Regenerate tokens if needed');
      console.log('   - Ensure the app is installed in your workspace');
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSlackDirect().catch(console.error);
}

module.exports = { testSlackDirect };
