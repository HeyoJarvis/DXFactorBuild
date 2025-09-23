/**
 * Test Script for Workflow Intelligence System
 * 
 * Demonstrates:
 * 1. Capturing user workflow data
 * 2. Pattern recognition
 * 3. Insight generation
 * 4. Analytics dashboard
 */

require('dotenv').config();

const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');
const EnhancedWorkflowSlackApp = require('./delivery/slack/enhanced-workflow-app');
const WorkflowAnalyticsAPI = require('./delivery/api/workflow-analytics-api');

class WorkflowIntelligenceDemo {
  constructor() {
    this.workflowIntelligence = new WorkflowIntelligenceSystem({
      logLevel: 'info'
    });
    
    this.testUserId = 'demo_user_123';
    this.testChannelId = 'demo_channel_456';
  }

  /**
   * Run comprehensive demo
   */
  async runDemo() {
    console.log('🧠 Starting Workflow Intelligence Demo...\n');
    
    try {
      // Test 1: Simulate user workflow patterns
      await this.simulateUserWorkflow();
      
      // Test 2: Generate insights
      await this.testInsightGeneration();
      
      // Test 3: Test analytics
      await this.testAnalytics();
      
      // Test 4: Test API endpoints
      await this.testAPIEndpoints();
      
      console.log('✅ All tests completed successfully!\n');
      console.log('🚀 Ready to integrate with your Slack app!');
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      throw error;
    }
  }

  /**
   * Simulate realistic user workflow patterns
   */
  async simulateUserWorkflow() {
    console.log('📊 Test 1: Simulating User Workflow Patterns');
    console.log('=' .repeat(50));
    
    // Simulate a week of user activity
    const workflowScenarios = [
      // Day 1: Tool discovery
      {
        type: 'inbound',
        message: 'I need help finding a good project management tool for my team',
        intent: 'tool_recommendation',
        urgency: 'medium',
        tools: ['project', 'management']
      },
      {
        type: 'outbound',
        action: 'researched_tools',
        completion: 'completed',
        tools: ['asana', 'trello', 'notion']
      },
      
      // Day 2: Automation inquiry
      {
        type: 'inbound',
        message: 'How can I automate my weekly reporting process?',
        intent: 'task_automation',
        urgency: 'low',
        tools: ['reporting', 'automation']
      },
      {
        type: 'outbound',
        action: 'setup_zapier_workflow',
        completion: 'incomplete',
        tools: ['zapier', 'google-sheets']
      },
      
      // Day 3: Integration help
      {
        type: 'inbound',
        message: 'I want to connect Slack with Notion for better team updates',
        intent: 'integration_help',
        urgency: 'medium',
        tools: ['slack', 'notion']
      },
      {
        type: 'outbound',
        action: 'configured_slack_notion_integration',
        completion: 'completed',
        tools: ['slack', 'notion', 'zapier']
      },
      
      // Day 4: Repeated automation request
      {
        type: 'inbound',
        message: 'I still need help with that weekly report automation',
        intent: 'task_automation',
        urgency: 'high',
        tools: ['reporting', 'automation']
      },
      
      // Day 5: More tool questions
      {
        type: 'inbound',
        message: 'What\'s the best tool for managing customer feedback?',
        intent: 'tool_recommendation',
        urgency: 'low',
        tools: ['customer', 'feedback']
      },
      
      // Day 6: Workflow optimization
      {
        type: 'inbound',
        message: 'My current workflow feels inefficient, can you help optimize it?',
        intent: 'workflow_optimization',
        urgency: 'medium',
        tools: ['workflow', 'optimization']
      }
    ];

    console.log(`Simulating ${workflowScenarios.length} workflow interactions...\n`);
    
    for (let i = 0; i < workflowScenarios.length; i++) {
      const scenario = workflowScenarios[i];
      const timestamp = new Date(Date.now() - (workflowScenarios.length - i) * 24 * 60 * 60 * 1000);
      
      if (scenario.type === 'inbound') {
        const result = await this.workflowIntelligence.captureInboundRequest(
          this.testUserId,
          this.testChannelId,
          scenario.message,
          {
            messageType: 'test_message',
            timestamp,
            tools_mentioned: scenario.tools,
            urgency: scenario.urgency
          }
        );
        
        console.log(`📥 Captured inbound: ${scenario.intent} (${scenario.urgency} urgency)`);
        
      } else {
        const result = await this.workflowIntelligence.captureOutboundAction(
          this.testUserId,
          this.testChannelId,
          scenario.action,
          {
            completion_status: scenario.completion,
            tools_used: scenario.tools,
            timestamp,
            success: scenario.completion === 'completed'
          }
        );
        
        console.log(`📤 Captured outbound: ${scenario.action} (${scenario.completion})`);
      }
      
      // Small delay to simulate real timing
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n✅ Workflow simulation completed\n');
  }

  /**
   * Test insight generation
   */
  async testInsightGeneration() {
    console.log('💡 Test 2: Testing Insight Generation');
    console.log('=' .repeat(50));
    
    // Wait a moment for pattern analysis to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get generated insights
    const insights = await this.workflowIntelligence.getUserActionableInsights(this.testUserId);
    
    console.log(`Generated ${insights.length} actionable insights:\n`);
    
    insights.forEach((insight, index) => {
      console.log(`${index + 1}. Insight ID: ${insight.id}`);
      console.log(`   Timestamp: ${insight.timestamp}`);
      console.log(`   Key Observations: ${insight.key_observations?.length || 0}`);
      console.log(`   Actionable Suggestions: ${insight.actionable_suggestions?.length || 0}`);
      console.log(`   Automation Opportunities: ${insight.automation_opportunities?.length || 0}`);
      
      if (insight.actionable_suggestions?.length > 0) {
        const topSuggestion = insight.actionable_suggestions[0];
        console.log(`   Top Suggestion: ${topSuggestion.suggestion}`);
        console.log(`   Priority: ${topSuggestion.priority}`);
        console.log(`   Category: ${topSuggestion.category}`);
      }
      console.log('');
    });
    
    // Test insight actions
    if (insights.length > 0) {
      const testInsight = insights[0];
      
      console.log('Testing insight actions...');
      
      // Test completion
      await this.workflowIntelligence.markInsightCompleted(this.testUserId, testInsight.id);
      console.log('✅ Marked insight as completed');
      
      // Test dismissal (if there's another insight)
      if (insights.length > 1) {
        await this.workflowIntelligence.dismissInsight(this.testUserId, insights[1].id);
        console.log('🔇 Dismissed insight');
      }
    }
    
    console.log('\n✅ Insight generation test completed\n');
  }

  /**
   * Test analytics functionality
   */
  async testAnalytics() {
    console.log('📈 Test 3: Testing Analytics');
    console.log('=' .repeat(50));
    
    // Get user analytics
    const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(this.testUserId, 7);
    
    console.log('User Analytics Summary:');
    console.log(`  Total Interactions: ${analytics.total_interactions}`);
    console.log(`  Inbound Requests: ${analytics.inbound_requests}`);
    console.log(`  Outbound Actions: ${analytics.outbound_actions}`);
    console.log(`  Active Insights: ${analytics.active_insights}`);
    console.log('');
    
    console.log('Top Intents:');
    analytics.top_intents.forEach((intent, index) => {
      console.log(`  ${index + 1}. ${intent.intent} (${intent.count} times)`);
    });
    console.log('');
    
    console.log('Tool Usage:');
    analytics.tool_usage.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.tool} (${tool.count} mentions)`);
    });
    console.log('');
    
    console.log('Urgency Distribution:');
    console.log(`  High: ${analytics.urgency_distribution.high}`);
    console.log(`  Medium: ${analytics.urgency_distribution.medium}`);
    console.log(`  Low: ${analytics.urgency_distribution.low}`);
    console.log('');
    
    console.log('Peak Activity Hours:');
    analytics.time_patterns.most_active_hours.forEach((hour, index) => {
      console.log(`  ${index + 1}. ${this.formatHour(hour.hour)} (${hour.count} interactions)`);
    });
    
    console.log('\n✅ Analytics test completed\n');
  }

  /**
   * Test API endpoints
   */
  async testAPIEndpoints() {
    console.log('🌐 Test 4: Testing API Endpoints');
    console.log('=' .repeat(50));
    
    try {
      // Create API instance
      const api = new WorkflowAnalyticsAPI({ port: 3002 });
      
      console.log('Starting API server for testing...');
      await api.start();
      
      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test health endpoint
      const healthResponse = await this.makeAPIRequest('http://localhost:3002/api/health');
      console.log('✅ Health check:', healthResponse.status);
      
      // Test user analytics endpoint
      const analyticsResponse = await this.makeAPIRequest(`http://localhost:3002/api/users/${this.testUserId}/analytics`);
      console.log('✅ User analytics:', analyticsResponse.analytics ? 'Success' : 'Failed');
      
      // Test insights endpoint
      const insightsResponse = await this.makeAPIRequest(`http://localhost:3002/api/users/${this.testUserId}/insights`);
      console.log('✅ User insights:', insightsResponse.insights ? 'Success' : 'Failed');
      
      // Test team analytics endpoint
      const teamResponse = await this.makeAPIRequest('http://localhost:3002/api/team/analytics');
      console.log('✅ Team analytics:', teamResponse.team_analytics ? 'Success' : 'Failed');
      
      // Stop API server
      await api.stop();
      
      console.log('\n✅ API endpoints test completed\n');
      
    } catch (error) {
      console.log(`❌ API test failed: ${error.message}\n`);
    }
  }

  /**
   * Make HTTP request (simple implementation)
   */
  async makeAPIRequest(url) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      // Fallback for environments without fetch
      return { error: 'Fetch not available in this environment' };
    }
  }

  /**
   * Format hour for display
   */
  formatHour(hour) {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
  }

  /**
   * Demo Slack app integration
   */
  async demoSlackIntegration() {
    console.log('🤖 Demo: Slack App Integration');
    console.log('=' .repeat(50));
    
    if (!process.env.SLACK_BOT_TOKEN) {
      console.log('⚠️  Slack bot token not found in environment variables');
      console.log('   Set SLACK_BOT_TOKEN to test Slack integration');
      return;
    }
    
    try {
      console.log('Creating Enhanced Slack App...');
      const slackApp = new EnhancedWorkflowSlackApp({
        logLevel: 'info'
      });
      
      console.log('✅ Slack app created successfully');
      console.log('🚀 To start the Slack app, run:');
      console.log('   node delivery/slack/enhanced-workflow-app.js');
      console.log('');
      console.log('📱 Available Slack commands:');
      console.log('   /heyjarvis insights - Get personalized insights');
      console.log('   /heyjarvis stats - View analytics');
      console.log('   /heyjarvis automation - Find automation opportunities');
      console.log('   /heyjarvis tools - Get tool recommendations');
      console.log('');
      
    } catch (error) {
      console.log(`❌ Slack integration demo failed: ${error.message}`);
    }
  }
}

// Run the demo
async function main() {
  const demo = new WorkflowIntelligenceDemo();
  
  try {
    await demo.runDemo();
    await demo.demoSlackIntegration();
    
    console.log('\n🎉 Workflow Intelligence System Demo Completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Update your .env file with Slack credentials');
    console.log('2. Run: node delivery/slack/enhanced-workflow-app.js');
    console.log('3. Start the analytics API: node delivery/api/workflow-analytics-api.js');
    console.log('4. Begin using your enhanced HeyJarvis in Slack!');
    console.log('\n🔗 Integration Points:');
    console.log('• Slack Bot: Captures all user interactions automatically');
    console.log('• Analytics API: http://localhost:3001/api/health');
    console.log('• Desktop Copilot: Can be enhanced with workflow intelligence');
    console.log('• Custom Integrations: Use the API to add intelligence to any app');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = WorkflowIntelligenceDemo;

// Run if called directly
if (require.main === module) {
  main();
}
