/**
 * Check Captured Slack Workflows
 * 
 * This script checks what Slack workflow data has been captured
 * and shows how it would be used in the session-based context system.
 */

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');

async function checkSlackWorkflows() {
  console.log('🔍 Checking Captured Slack Workflows\n');
  
  try {
    // Initialize the workflow intelligence system
    const workflowSystem = new WorkflowIntelligenceSystem({
      logLevel: 'info'
    });
    
    console.log('📊 Workflow Intelligence System Status:');
    console.log('   - User workflows map size:', workflowSystem.userWorkflows.size);
    console.log('   - Team patterns map size:', workflowSystem.teamPatterns.size);
    console.log('   - Actionable insights map size:', workflowSystem.actionableInsights.size);
    
    if (workflowSystem.userWorkflows.size === 0) {
      console.log('\n📝 No workflow data captured yet.');
      console.log('\n🎯 To capture workflow data:');
      console.log('   1. Make sure the Slack monitoring test is running:');
      console.log('      npm run test:slack-monitoring');
      console.log('   2. Send messages in your Slack workspace');
      console.log('   3. The bot will automatically capture and analyze them');
      console.log('\n💡 Example messages to try:');
      console.log('   - "I need help with lead qualification"');
      console.log('   - "Our CRM process is taking too long"');
      console.log('   - "Can someone help me set up HubSpot workflows?"');
      console.log('   - "The sales team is struggling with follow-ups"');
      
      return;
    }
    
    console.log('\n🎉 Found captured workflow data!');
    
    // Analyze captured workflows
    let totalMessages = 0;
    const userSummary = new Map();
    const channelSummary = new Map();
    const intentSummary = new Map();
    const toolMentions = new Map();
    
    workflowSystem.userWorkflows.forEach((userChannels, userId) => {
      let userMessageCount = 0;
      
      userChannels.forEach((channelDates, channelId) => {
        let channelMessageCount = 0;
        
        channelDates.forEach((interactions, dateKey) => {
          interactions.forEach((interaction) => {
            totalMessages++;
            userMessageCount++;
            channelMessageCount++;
            
            // Track intents
            if (interaction.context?.intent?.intent) {
              const intent = interaction.context.intent.intent;
              intentSummary.set(intent, (intentSummary.get(intent) || 0) + 1);
            }
            
            // Track tool mentions
            if (interaction.context?.tools_mentioned) {
              interaction.context.tools_mentioned.forEach(tool => {
                toolMentions.set(tool, (toolMentions.get(tool) || 0) + 1);
              });
            }
          });
        });
        
        channelSummary.set(channelId, channelMessageCount);
      });
      
      userSummary.set(userId, userMessageCount);
    });
    
    console.log('\n📈 Workflow Data Summary:');
    console.log('   - Total messages captured:', totalMessages);
    console.log('   - Active users:', userSummary.size);
    console.log('   - Active channels:', channelSummary.size);
    
    console.log('\n👥 User Activity:');
    userSummary.forEach((count, userId) => {
      console.log(`   - User ${userId}: ${count} messages`);
    });
    
    console.log('\n📱 Channel Activity:');
    channelSummary.forEach((count, channelId) => {
      console.log(`   - Channel ${channelId}: ${count} messages`);
    });
    
    if (intentSummary.size > 0) {
      console.log('\n🎯 Detected Intents:');
      intentSummary.forEach((count, intent) => {
        console.log(`   - ${intent}: ${count} occurrences`);
      });
    }
    
    if (toolMentions.size > 0) {
      console.log('\n🔧 Tool Mentions:');
      toolMentions.forEach((count, tool) => {
        console.log(`   - ${tool}: ${count} mentions`);
      });
    }
    
    // Show how this data would be used in session context
    console.log('\n💡 Session Context Usage:');
    console.log('   This captured data would be used as "fresh Slack workflows" in:');
    console.log('   - processSessionWithFreshSlack(orgId, sessionId, freshSlackWorkflows)');
    console.log('   - Combined with persistent CRM context for AI recommendations');
    console.log('   - Each chat session gets unique context based on latest messages');
    
    // Show sample data structure
    if (totalMessages > 0) {
      console.log('\n📋 Sample Workflow Data Structure:');
      const firstUser = workflowSystem.userWorkflows.keys().next().value;
      const firstUserData = workflowSystem.userWorkflows.get(firstUser);
      const firstChannel = firstUserData.keys().next().value;
      const firstChannelData = firstUserData.get(firstChannel);
      const firstDate = firstChannelData.keys().next().value;
      const firstInteractions = firstChannelData.get(firstDate);
      
      if (firstInteractions.length > 0) {
        const sampleInteraction = firstInteractions[0];
        console.log('   Sample message structure:');
        console.log('   {');
        console.log(`     id: "${sampleInteraction.id}",`);
        console.log(`     userId: "${sampleInteraction.userId}",`);
        console.log(`     channelId: "${sampleInteraction.channelId}",`);
        console.log(`     type: "${sampleInteraction.type}",`);
        console.log(`     content: "${sampleInteraction.content.substring(0, 50)}...",`);
        console.log('     context: {');
        console.log(`       messageType: "${sampleInteraction.context?.messageType}",`);
        console.log(`       urgency: "${sampleInteraction.context?.urgency}",`);
        console.log(`       intent: "${sampleInteraction.context?.intent?.intent}",`);
        console.log(`       sentiment: "${sampleInteraction.context?.sentiment}"`);
        console.log('     }');
        console.log('   }');
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to check workflow data:', error.message);
  }
}

// Run the check
if (require.main === module) {
  checkSlackWorkflows().catch(console.error);
}

module.exports = { checkSlackWorkflows };
