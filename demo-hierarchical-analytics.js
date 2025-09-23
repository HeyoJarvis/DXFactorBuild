/**
 * Demo: Enhanced Hierarchical Workflow Analytics
 * 
 * Demonstrates the new user → channel → date organization structure
 * and the advanced analytics capabilities it enables.
 */

require('dotenv').config();

const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');

class HierarchicalAnalyticsDemo {
  constructor() {
    this.workflowIntelligence = new WorkflowIntelligenceSystem({
      logLevel: 'info'
    });
    
    // Demo users and channels
    this.users = ['alice_123', 'bob_456', 'charlie_789'];
    this.channels = {
      'general': { name: 'general', type: 'public', team_id: 'team_001' },
      'dev-team': { name: 'dev-team', type: 'private', team_id: 'team_001' },
      'marketing': { name: 'marketing', type: 'public', team_id: 'team_001' },
      'alice-dm': { name: 'alice-dm', type: 'dm', team_id: 'team_001' }
    };
  }

  async runDemo() {
    console.log('🔗 Enhanced Hierarchical Workflow Analytics Demo\n');
    console.log('=' .repeat(60));
    
    try {
      // Step 1: Set up channel metadata
      await this.setupChannelMetadata();
      
      // Step 2: Simulate multi-user, multi-channel workflow data
      await this.simulateHierarchicalWorkflows();
      
      // Step 3: Demonstrate enhanced analytics
      await this.demonstrateEnhancedAnalytics();
      
      // Step 4: Show channel-specific insights
      await this.demonstrateChannelAnalytics();
      
      // Step 5: Show team-wide analytics
      await this.demonstrateTeamAnalytics();
      
      console.log('\n✅ Hierarchical Analytics Demo Completed!');
      console.log('\n🎯 Key Benefits Demonstrated:');
      console.log('• User behavior analysis by channel context');
      console.log('• Daily productivity patterns and trends');
      console.log('• Channel-specific workflow insights');
      console.log('• Team-wide collaboration analytics');
      console.log('• Temporal pattern recognition');
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      throw error;
    }
  }

  async setupChannelMetadata() {
    console.log('📋 Step 1: Setting up channel metadata...\n');
    
    Object.entries(this.channels).forEach(([channelId, metadata]) => {
      this.workflowIntelligence.setChannelMetadata(channelId, metadata);
      console.log(`  ✓ Channel: ${metadata.name} (${metadata.type})`);
    });
    
    console.log('\n✅ Channel metadata configured\n');
  }

  async simulateHierarchicalWorkflows() {
    console.log('📊 Step 2: Simulating multi-user, multi-channel workflows...\n');
    
    const scenarios = [
      // Alice - Active in dev-team, some general
      { user: 'alice_123', channel: 'dev-team', day: -5, interactions: 8, focus: 'automation' },
      { user: 'alice_123', channel: 'dev-team', day: -4, interactions: 12, focus: 'integration' },
      { user: 'alice_123', channel: 'dev-team', day: -3, interactions: 6, focus: 'tools' },
      { user: 'alice_123', channel: 'general', day: -2, interactions: 3, focus: 'general' },
      { user: 'alice_123', channel: 'dev-team', day: -1, interactions: 15, focus: 'automation' },
      
      // Bob - Marketing focused, some DMs
      { user: 'bob_456', channel: 'marketing', day: -5, interactions: 5, focus: 'tools' },
      { user: 'bob_456', channel: 'marketing', day: -4, interactions: 8, focus: 'reporting' },
      { user: 'bob_456', channel: 'alice-dm', day: -3, interactions: 2, focus: 'integration' },
      { user: 'bob_456', channel: 'marketing', day: -2, interactions: 10, focus: 'automation' },
      { user: 'bob_456', channel: 'general', day: -1, interactions: 4, focus: 'general' },
      
      // Charlie - Balanced across channels
      { user: 'charlie_789', channel: 'general', day: -5, interactions: 6, focus: 'tools' },
      { user: 'charlie_789', channel: 'dev-team', day: -4, interactions: 4, focus: 'integration' },
      { user: 'charlie_789', channel: 'marketing', day: -3, interactions: 3, focus: 'reporting' },
      { user: 'charlie_789', channel: 'general', day: -2, interactions: 7, focus: 'workflow' },
      { user: 'charlie_789', channel: 'dev-team', day: -1, interactions: 5, focus: 'automation' }
    ];

    for (const scenario of scenarios) {
      const baseTime = new Date(Date.now() + scenario.day * 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < scenario.interactions; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 60 * 60 * 1000); // Spread over day
        
        // Create realistic messages based on focus
        const messages = this.generateFocusMessages(scenario.focus);
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        await this.workflowIntelligence.captureInboundRequest(
          scenario.user,
          scenario.channel,
          message,
          {
            messageType: 'channel_message',
            timestamp,
            channel_name: this.channels[scenario.channel].name
          }
        );
        
        // Sometimes add outbound actions
        if (Math.random() > 0.7) {
          await this.workflowIntelligence.captureOutboundAction(
            scenario.user,
            scenario.channel,
            `completed_${scenario.focus}_task`,
            {
              completion_status: 'completed',
              success: true,
              timestamp: new Date(timestamp.getTime() + 30 * 60 * 1000)
            }
          );
        }
      }
      
      console.log(`  ✓ ${scenario.user} in #${this.channels[scenario.channel].name}: ${scenario.interactions} interactions (${scenario.focus} focus)`);
    }
    
    console.log('\n✅ Hierarchical workflow data simulated\n');
  }

  generateFocusMessages(focus) {
    const messageMap = {
      'automation': [
        'How can I automate this weekly report?',
        'Looking for workflow automation tools',
        'Can we set up automated deployments?'
      ],
      'integration': [
        'Need to connect Slack with our CRM',
        'Integration between GitHub and Jira?',
        'How to sync data between systems?'
      ],
      'tools': [
        'What tool do you recommend for project management?',
        'Best analytics platform for our needs?',
        'Looking for a good design collaboration tool'
      ],
      'reporting': [
        'Need help with monthly reporting dashboard',
        'How to create automated reports?',
        'Best practices for data visualization?'
      ],
      'workflow': [
        'Our current process feels inefficient',
        'How to optimize team workflows?',
        'Need to streamline our approval process'
      ],
      'general': [
        'Quick question about the project timeline',
        'Any updates on the client meeting?',
        'Who can help with the documentation?'
      ]
    };
    
    return messageMap[focus] || messageMap['general'];
  }

  async demonstrateEnhancedAnalytics() {
    console.log('📈 Step 3: Enhanced Analytics Demonstration...\n');
    
    // Get analytics for Alice (most active user)
    const aliceAnalytics = await this.workflowIntelligence.getUserWorkflowAnalytics('alice_123', 7);
    
    console.log('👤 Alice\'s Enhanced Analytics:');
    console.log(`  📊 Total Interactions: ${aliceAnalytics.total_interactions}`);
    console.log(`  📥 Inbound Requests: ${aliceAnalytics.inbound_requests}`);
    console.log(`  📤 Outbound Actions: ${aliceAnalytics.outbound_actions}`);
    console.log('\n  🏢 Channel Breakdown:');
    
    Object.entries(aliceAnalytics.channel_breakdown).forEach(([channelId, data]) => {
      const channelName = this.channels[channelId]?.name || channelId;
      console.log(`    #${channelName}: ${data.total_interactions} interactions`);
      console.log(`      ├─ Inbound: ${data.inbound_requests}`);
      console.log(`      ├─ Outbound: ${data.outbound_actions}`);
      console.log(`      └─ Date range: ${data.date_range?.span_days || 0} days`);
    });
    
    console.log('\n  📅 Daily Patterns:');
    aliceAnalytics.daily_patterns.forEach(day => {
      console.log(`    ${day.date}: ${day.total} interactions (${day.unique_channels} channels, peak: ${day.peak_hour || 'N/A'}h)`);
    });
    
    console.log('\n  🎯 Most Active Channel:');
    if (aliceAnalytics.most_active_channel) {
      const channelName = this.channels[aliceAnalytics.most_active_channel.channel_id]?.name || 'unknown';
      console.log(`    #${channelName}: ${aliceAnalytics.most_active_channel.total_interactions} interactions`);
    }
    
    console.log('\n  📊 Workflow Consistency:');
    const consistency = aliceAnalytics.workflow_consistency;
    console.log(`    Score: ${consistency.consistency_score} (${consistency.pattern})`);
    console.log(`    Daily Average: ${consistency.daily_average}`);
    console.log(`    Most Active Day: ${consistency.most_active_day}`);
    
    console.log('\n  📈 Productivity Trends:');
    const trends = aliceAnalytics.productivity_trends;
    console.log(`    Trend: ${trends.trend} (slope: ${trends.slope})`);
    console.log(`    Weekly Average: ${trends.weekly_average}`);
    
    console.log('\n✅ Enhanced analytics demonstrated\n');
  }

  async demonstrateChannelAnalytics() {
    console.log('🏢 Step 4: Channel-Specific Analytics...\n');
    
    // Show dev-team channel analytics
    console.log('💻 #dev-team Channel Analysis:');
    
    for (const userId of this.users) {
      const channelData = await this.workflowIntelligence.getChannelWorkflow(userId, 'dev-team', 7);
      
      if (channelData.length > 0) {
        const userName = userId.split('_')[0];
        console.log(`  👤 ${userName}: ${channelData.length} interactions`);
        
        // Show intent distribution for this user in this channel
        const intents = {};
        channelData.filter(d => d.type === 'inbound').forEach(d => {
          const intent = d.context?.intent?.intent || 'unknown';
          intents[intent] = (intents[intent] || 0) + 1;
        });
        
        Object.entries(intents).forEach(([intent, count]) => {
          console.log(`    ├─ ${intent}: ${count}x`);
        });
      }
    }
    
    console.log('\n✅ Channel analytics demonstrated\n');
  }

  async demonstrateTeamAnalytics() {
    console.log('👥 Step 5: Team-Wide Analytics...\n');
    
    const teamAnalytics = await this.workflowIntelligence.getTeamAnalytics(7);
    
    console.log('🌟 Team Overview:');
    console.log(`  👥 Total Users: ${teamAnalytics.total_users}`);
    console.log(`  💬 Total Interactions: ${teamAnalytics.total_interactions}`);
    
    console.log('\n🏢 Channel Activity:');
    Object.entries(teamAnalytics.channels).forEach(([channelId, data]) => {
      const channelName = this.channels[channelId]?.name || channelId;
      const channelType = this.channels[channelId]?.type || 'unknown';
      console.log(`  #${channelName} (${channelType}):`);
      console.log(`    ├─ Users: ${data.unique_users}`);
      console.log(`    └─ Interactions: ${data.total_interactions}`);
    });
    
    console.log('\n🛠️ Top Tools (Team):');
    teamAnalytics.top_tools.slice(0, 5).forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.tool}: ${tool.count} mentions`);
    });
    
    console.log('\n🎯 Top Intents (Team):');
    teamAnalytics.top_intents.slice(0, 5).forEach((intent, index) => {
      console.log(`  ${index + 1}. ${intent.intent}: ${intent.count} requests`);
    });
    
    console.log('\n📅 Daily Team Activity:');
    Object.entries(teamAnalytics.daily_patterns)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, interactions]) => {
        console.log(`  ${date}: ${interactions} total interactions`);
      });
    
    console.log('\n✅ Team analytics demonstrated\n');
  }
}

// Run the demo
async function main() {
  const demo = new HierarchicalAnalyticsDemo();
  
  try {
    await demo.runDemo();
    
    console.log('\n🎉 Hierarchical Analytics Demo Completed Successfully!');
    console.log('\n🚀 The new organization structure provides:');
    console.log('✓ Better performance through organized data access');
    console.log('✓ Channel-specific behavioral insights');
    console.log('✓ Temporal pattern analysis');
    console.log('✓ Team collaboration analytics');
    console.log('✓ Context-aware workflow intelligence');
    console.log('\n💡 This enables much smarter insights like:');
    console.log('• "Alice is most productive in #dev-team on Tuesdays"');
    console.log('• "Marketing channel shows automation interest trend"');
    console.log('• "Team productivity increased 15% this week"');
    console.log('• "Integration requests peak in private channels"');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = HierarchicalAnalyticsDemo;

// Run if called directly
if (require.main === module) {
  main();
}
