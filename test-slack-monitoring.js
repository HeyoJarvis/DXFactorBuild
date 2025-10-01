/**
 * Test Slack Message Monitoring
 * 
 * This test starts the enhanced Slack workflow app and monitors for new messages.
 * It will capture messages when you send them and show how they're processed.
 */

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const EnhancedWorkflowSlackApp = require('./delivery/slack/enhanced-workflow-app');

async function testSlackMonitoring() {
  console.log('🚀 Testing Slack Message Monitoring\n');
  
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
    
    console.log('\n📱 Starting Enhanced Slack Workflow App...');
    
    // Initialize the enhanced Slack app
    const slackApp = new EnhancedWorkflowSlackApp({
      logLevel: 'info',
      port: 3001
    });
    
    // Add custom message handler to show captured data
    slackApp.workflowIntelligence.on('message_captured', (data) => {
      console.log('\n🎯 NEW MESSAGE CAPTURED!');
      console.log('   - User ID:', data.userId);
      console.log('   - Channel ID:', data.channelId);
      console.log('   - Message Type:', data.context.messageType);
      console.log('   - Intent:', data.context.intent?.intent || 'unknown');
      console.log('   - Urgency:', data.context.urgency);
      console.log('   - Sentiment:', data.context.sentiment);
      console.log('   - Tools Mentioned:', data.context.tools_mentioned?.length || 0);
      console.log('   - Content Preview:', data.content.substring(0, 100) + '...');
      console.log('   - Timestamp:', data.timestamp);
      
      // Show how this would be used in session context
      console.log('\n💡 Session Context Usage:');
      console.log('   This message would be added to fresh Slack workflows for the session');
      console.log('   Combined with persistent CRM context for AI recommendations');
    });
    
    // Add pattern detection handler
    slackApp.workflowIntelligence.on('pattern_detected', (pattern) => {
      console.log('\n🔍 WORKFLOW PATTERN DETECTED!');
      console.log('   - Pattern Type:', pattern.type);
      console.log('   - Confidence:', pattern.confidence);
      console.log('   - Affected Users:', pattern.users?.length || 0);
      console.log('   - Description:', pattern.description);
    });
    
    // Start the app
    await slackApp.initialize();
    
    console.log('\n✅ Slack Bot Started Successfully!');
    console.log('🎯 Ready to Monitor Messages');
    console.log('\n📋 Test Instructions:');
    console.log('   1. Go to your Slack workspace where the bot is installed');
    console.log('   2. Send a message in any channel (the bot will capture it)');
    console.log('   3. Try different types of messages:');
    console.log('      - "I need help with lead qualification"');
    console.log('      - "Our CRM process is too slow"');
    console.log('      - "Can someone help me with HubSpot?"');
    console.log('   4. Watch this console for captured message data');
    console.log('\n🔄 The bot will automatically:');
    console.log('   - Capture your messages');
    console.log('   - Analyze intent and sentiment');
    console.log('   - Extract mentioned tools');
    console.log('   - Store workflow data for session context');
    
    console.log('\n⏹️  Press Ctrl+C to stop monitoring\n');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Stopping Slack monitoring...');
      await slackApp.stop();
      
      // Show captured workflow data
      const workflowData = slackApp.workflowIntelligence.userWorkflows;
      console.log('\n📊 Captured Workflow Data Summary:');
      console.log('   - Total users with data:', workflowData.size);
      
      workflowData.forEach((userChannels, userId) => {
        let totalMessages = 0;
        userChannels.forEach((channelDates) => {
          channelDates.forEach((interactions) => {
            totalMessages += interactions.length;
          });
        });
        console.log(`   - User ${userId}: ${totalMessages} messages captured`);
      });
      
      console.log('\n✅ Slack monitoring stopped');
      process.exit(0);
    });
    
    // Keep alive
    setInterval(() => {
      // Just keep the process running
    }, 1000);
    
  } catch (error) {
    console.error('❌ Slack monitoring test failed:', error.message);
    
    if (error.message.includes('Missing required Slack')) {
      console.log('\n🔧 Fix: Ensure your .env file has:');
      console.log('   SLACK_BOT_TOKEN=xoxb-...');
      console.log('   SLACK_SIGNING_SECRET=...');
      console.log('   SLACK_APP_TOKEN=xapp-...');
      console.log('   SLACK_SOCKET_MODE=true');
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSlackMonitoring().catch(console.error);
}

module.exports = { testSlackMonitoring };
