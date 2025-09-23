/**
 * CEO Monitoring Setup for Real Slack Environment
 * 
 * Sets up the CEO account to monitor tasks and get AI-curated suggestions
 */

require('dotenv').config();

const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');
const EnhancedWorkflowSlackApp = require('./delivery/slack/enhanced-workflow-app');

class CEOMonitoringSystem {
  constructor() {
    this.workflowIntelligence = new WorkflowIntelligenceSystem({
      logLevel: 'info'
    });
    
    // Your organization ID (you can customize this)
    this.orgId = 'cipio_org';
    this.ceoUserId = null; // Will be set when you authenticate
  }

  /**
   * Initialize CEO monitoring system
   */
  async initialize(ceoSlackUserId, organizationName = 'CIPIO') {
    console.log('👑 Setting up CEO Monitoring System...\n');
    
    this.ceoUserId = ceoSlackUserId;
    
    // Set up CEO role
    this.workflowIntelligence.setUserRole(ceoSlackUserId, 'ceo', this.orgId);
    
    console.log(`✅ CEO account configured:`);
    console.log(`   User ID: ${ceoSlackUserId}`);
    console.log(`   Role: CEO`);
    console.log(`   Organization: ${organizationName}`);
    console.log(`   Permissions: Full access to all team data\n`);
    
    // Create CEO session
    const ceoSession = this.workflowIntelligence.createSession(ceoSlackUserId, {
      slack_workspace: organizationName,
      role: 'ceo',
      monitoring_enabled: true
    });
    
    console.log(`🔑 CEO Session created: ${ceoSession.sessionId}\n`);
    
    return ceoSession;
  }

  /**
   * Add team member to monitoring
   */
  async addTeamMember(slackUserId, role = 'user', managerId = null) {
    this.workflowIntelligence.setUserRole(slackUserId, role, this.orgId);
    
    console.log(`👤 Added team member: ${slackUserId} (${role})`);
    
    // Update organization hierarchy if this is a manager relationship
    if (managerId) {
      const currentHierarchy = this.workflowIntelligence.organizationHierarchy.get(this.orgId) || {
        ceo: this.ceoUserId,
        admins: [],
        managers: new Map()
      };
      
      if (!currentHierarchy.managers.has(managerId)) {
        currentHierarchy.managers.set(managerId, []);
      }
      currentHierarchy.managers.get(managerId).push(slackUserId);
      
      this.workflowIntelligence.setOrganizationHierarchy(this.orgId, {
        ceo: currentHierarchy.ceo,
        admins: currentHierarchy.admins,
        managers: Object.fromEntries(currentHierarchy.managers)
      });
    }
  }

  /**
   * Monitor task assignments and progress
   */
  async monitorTaskAssignments(ceoSessionId) {
    console.log('📋 CEO Task Monitoring Dashboard\n');
    console.log('=' .repeat(50));
    
    try {
      // Get all accessible users (your team)
      const teamData = await this.workflowIntelligence.getAccessibleUsersAnalytics(
        this.ceoUserId, 7, ceoSessionId
      );
      
      console.log(`👥 Team Overview:`);
      console.log(`   Total team members: ${teamData.accessible_users.length}`);
      console.log(`   Monitoring period: Last 7 days\n`);
      
      // Analyze each team member's activity
      console.log('👤 Individual Team Member Analysis:');
      console.log('-'.repeat(40));
      
      for (const [userId, analytics] of Object.entries(teamData.analytics)) {
        if (userId === this.ceoUserId) continue; // Skip CEO's own data
        
        console.log(`\n📊 ${userId}:`);
        console.log(`   Total interactions: ${analytics.total_interactions}`);
        console.log(`   Active channels: ${Object.keys(analytics.channel_breakdown || {}).length}`);
        
        // Show channel breakdown
        if (analytics.channel_breakdown) {
          console.log(`   Channel activity:`);
          Object.entries(analytics.channel_breakdown).forEach(([channelId, data]) => {
            console.log(`     • ${channelId}: ${data.total_interactions} interactions`);
          });
        }
        
        // Show productivity trends
        if (analytics.productivity_trends) {
          console.log(`   Productivity trend: ${analytics.productivity_trends.trend}`);
          console.log(`   Weekly average: ${analytics.productivity_trends.weekly_average}`);
        }
        
        // Show workflow consistency
        if (analytics.workflow_consistency) {
          console.log(`   Workflow consistency: ${analytics.workflow_consistency.pattern}`);
          console.log(`   Consistency score: ${analytics.workflow_consistency.consistency_score}`);
        }
      }
      
      // Get team-wide analytics
      const teamAnalytics = await this.workflowIntelligence.getFilteredTeamAnalytics(
        this.ceoUserId, 7, ceoSessionId
      );
      
      console.log('\n📈 Team Analytics Summary:');
      console.log('-'.repeat(40));
      console.log(`   Total team interactions: ${teamAnalytics.total_interactions}`);
      console.log(`   Active team members: ${teamAnalytics.total_users}`);
      console.log(`   Team channels: ${Object.keys(teamAnalytics.channels || {}).length}`);
      
      if (teamAnalytics.top_tools?.length > 0) {
        console.log(`\n🛠️  Most mentioned tools:`);
        teamAnalytics.top_tools.slice(0, 5).forEach((tool, i) => {
          console.log(`     ${i+1}. ${tool.tool} (${tool.count} mentions)`);
        });
      }
      
      if (teamAnalytics.top_intents?.length > 0) {
        console.log(`\n🎯 Common team requests:`);
        teamAnalytics.top_intents.slice(0, 5).forEach((intent, i) => {
          console.log(`     ${i+1}. ${intent.intent.replace(/_/g, ' ')} (${intent.count} times)`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Monitoring error: ${error.message}`);
    }
  }

  /**
   * Get AI-curated suggestions for the CEO
   */
  async getCEOSuggestions(ceoSessionId) {
    console.log('\n🤖 AI-Curated CEO Suggestions\n');
    console.log('=' .repeat(50));
    
    try {
      // Get CEO's own insights
      const ceoInsights = await this.workflowIntelligence.getUserActionableInsights(
        this.ceoUserId, 10, this.ceoUserId, ceoSessionId
      );
      
      if (ceoInsights.length > 0) {
        console.log('💡 Personal Leadership Insights:');
        ceoInsights.forEach((insight, i) => {
          console.log(`\n${i+1}. Insight from ${new Date(insight.timestamp).toLocaleDateString()}:`);
          
          if (insight.key_observations?.length > 0) {
            console.log(`   📋 Observations:`);
            insight.key_observations.forEach(obs => {
              console.log(`     • ${obs}`);
            });
          }
          
          if (insight.actionable_suggestions?.length > 0) {
            console.log(`   🎯 Suggestions:`);
            insight.actionable_suggestions.forEach(suggestion => {
              console.log(`     • ${suggestion.suggestion}`);
              console.log(`       Priority: ${suggestion.priority} | Category: ${suggestion.category}`);
              console.log(`       Time savings: ${suggestion.estimated_time_savings}`);
            });
          }
        });
      } else {
        console.log('📊 Generating new insights based on team patterns...');
        
        // Generate CEO-specific insights based on team data
        const teamData = await this.workflowIntelligence.getAccessibleUsersAnalytics(
          this.ceoUserId, 7, ceoSessionId
        );
        
        const ceoSuggestions = this.generateCEOSuggestions(teamData);
        
        console.log('\n💡 AI-Generated CEO Recommendations:');
        ceoSuggestions.forEach((suggestion, i) => {
          console.log(`\n${i+1}. ${suggestion.title}`);
          console.log(`   📝 ${suggestion.description}`);
          console.log(`   🎯 Action: ${suggestion.action}`);
          console.log(`   📊 Impact: ${suggestion.impact}`);
          console.log(`   ⏱️  Time to implement: ${suggestion.timeToImplement}`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Suggestions error: ${error.message}`);
    }
  }

  /**
   * Generate CEO-specific suggestions based on team data
   */
  generateCEOSuggestions(teamData) {
    const suggestions = [];
    
    // Analyze team activity levels
    const totalInteractions = Object.values(teamData.analytics)
      .reduce((sum, user) => sum + user.total_interactions, 0);
    
    const avgInteractionsPerUser = totalInteractions / Object.keys(teamData.analytics).length;
    
    if (avgInteractionsPerUser < 5) {
      suggestions.push({
        title: 'Team Engagement Opportunity',
        description: 'Team activity levels are lower than optimal. Consider implementing more structured check-ins.',
        action: 'Schedule weekly team syncs or implement daily standups',
        impact: 'Increase team communication by 40-60%',
        timeToImplement: '1-2 hours setup'
      });
    }
    
    // Check for automation opportunities
    const automationMentions = Object.values(teamData.analytics)
      .reduce((count, user) => {
        const tools = user.tool_usage || [];
        return count + tools.filter(tool => 
          tool.tool.includes('automat') || tool.tool.includes('workflow')
        ).length;
      }, 0);
    
    if (automationMentions > 2) {
      suggestions.push({
        title: 'Automation Investment Opportunity',
        description: 'Multiple team members are discussing automation needs. This indicates ROI potential.',
        action: 'Evaluate workflow automation tools like Zapier, Microsoft Power Automate',
        impact: 'Potential 10-20% productivity increase',
        timeToImplement: '2-4 weeks implementation'
      });
    }
    
    // Check for tool consolidation opportunities
    const uniqueTools = new Set();
    Object.values(teamData.analytics).forEach(user => {
      (user.tool_usage || []).forEach(tool => uniqueTools.add(tool.tool));
    });
    
    if (uniqueTools.size > 10) {
      suggestions.push({
        title: 'Tool Stack Optimization',
        description: `Team is using ${uniqueTools.size} different tools. Consolidation could reduce complexity.`,
        action: 'Audit current tools and identify consolidation opportunities',
        impact: 'Reduce tool licensing costs by 20-30%',
        timeToImplement: '1-2 months evaluation'
      });
    }
    
    // Default strategic suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        title: 'Team Performance Baseline Established',
        description: 'Your team monitoring system is active and collecting valuable workflow data.',
        action: 'Continue monitoring for 2-4 weeks to identify patterns and optimization opportunities',
        impact: 'Data-driven leadership insights',
        timeToImplement: 'Ongoing monitoring'
      });
    }
    
    return suggestions;
  }

  /**
   * Set up Slack integration for real-time monitoring
   */
  async setupSlackIntegration() {
    console.log('\n💬 Setting up Slack Integration...\n');
    
    if (!process.env.SLACK_BOT_TOKEN) {
      console.log('⚠️  SLACK_BOT_TOKEN not found in environment variables');
      console.log('   Please add your Slack bot token to .env file');
      return;
    }
    
    try {
      const slackApp = new EnhancedWorkflowSlackApp({
        logLevel: 'info'
      });
      
      // Override the workflow intelligence instance to use our configured one
      slackApp.workflowIntelligence = this.workflowIntelligence;
      
      console.log('✅ Slack integration configured');
      console.log('🤖 Your HeyJarvis bot will now:');
      console.log('   • Automatically capture all team interactions');
      console.log('   • Provide you with CEO-level analytics via /heyjarvis insights');
      console.log('   • Send proactive suggestions based on team patterns');
      console.log('   • Respect role-based permissions (you see everything, employees see personal data only)');
      
      return slackApp;
      
    } catch (error) {
      console.error('❌ Slack integration error:', error.message);
    }
  }
}

/**
 * Interactive setup for CEO
 */
async function setupCEOMonitoring() {
  console.log('🚀 HeyJarvis CEO Monitoring System Setup\n');
  
  const ceoSystem = new CEOMonitoringSystem();
  
  // For demo, we'll use placeholder values
  // In production, you'd get these from Slack OAuth or user input
  const ceoSlackUserId = process.env.CEO_SLACK_USER_ID || 'U_CEO_PLACEHOLDER';
  const orgName = process.env.ORGANIZATION_NAME || 'CIPIO';
  
  console.log('📋 Configuration:');
  console.log(`   CEO Slack User ID: ${ceoSlackUserId}`);
  console.log(`   Organization: ${orgName}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  
  // Initialize CEO account
  const ceoSession = await ceoSystem.initialize(ceoSlackUserId, orgName);
  
  // Add some example team members (in production, these would come from Slack API)
  console.log('👥 Adding team members...');
  await ceoSystem.addTeamMember('U_EMPLOYEE_1', 'user');
  await ceoSystem.addTeamMember('U_MANAGER_1', 'manager');
  await ceoSystem.addTeamMember('U_EMPLOYEE_2', 'user', 'U_MANAGER_1');
  console.log('✅ Team members added\n');
  
  // Simulate some team activity for demonstration
  console.log('📊 Simulating team workflow data...');
  await ceoSystem.workflowIntelligence.captureInboundRequest(
    'U_EMPLOYEE_1',
    'C_DEV_CHANNEL',
    'Working on the API integration task you assigned',
    { 
      messageType: 'slack_message', 
      timestamp: new Date(),
      assigned_by: ceoSlackUserId,
      task_type: 'development'
    }
  );
  
  await ceoSystem.workflowIntelligence.captureInboundRequest(
    'U_EMPLOYEE_2',
    'C_MARKETING_CHANNEL', 
    'Completed the market research task, preparing report',
    { 
      messageType: 'slack_message', 
      timestamp: new Date(),
      assigned_by: ceoSlackUserId,
      task_type: 'research',
      status: 'completed'
    }
  );
  
  await ceoSystem.workflowIntelligence.captureInboundRequest(
    'U_MANAGER_1',
    'C_MANAGEMENT_CHANNEL',
    'Team standup completed, all tasks on track',
    { 
      messageType: 'slack_message', 
      timestamp: new Date(),
      message_type: 'status_update'
    }
  );
  
  console.log('✅ Sample workflow data added\n');
  
  // Show CEO monitoring dashboard
  await ceoSystem.monitorTaskAssignments(ceoSession.sessionId);
  
  // Get AI suggestions
  await ceoSystem.getCEOSuggestions(ceoSession.sessionId);
  
  // Setup Slack integration
  const slackApp = await ceoSystem.setupSlackIntegration();
  
  console.log('\n🎉 CEO Monitoring System Setup Complete!');
  console.log('\n🚀 Next Steps:');
  console.log('1. Add your real Slack user IDs to the system');
  console.log('2. Start the enhanced Slack app: node delivery/slack/enhanced-workflow-app.js');
  console.log('3. Use /heyjarvis insights in Slack to get real-time CEO analytics');
  console.log('4. The system will automatically track task assignments and completions');
  console.log('\n💡 CEO Commands in Slack:');
  console.log('   • /heyjarvis insights - Get team performance overview');
  console.log('   • /heyjarvis stats - Detailed team analytics');
  console.log('   • /workflow-stats - Individual team member performance');
  
  return ceoSystem;
}

// Export for use in other modules
module.exports = { CEOMonitoringSystem, setupCEOMonitoring };

// Run if called directly
if (require.main === module) {
  setupCEOMonitoring().catch(console.error);
}
