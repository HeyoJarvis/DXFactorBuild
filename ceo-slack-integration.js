/**
 * CEO Slack Integration for Task Monitoring and AI Suggestions
 * 
 * Integrates with your real Slack workspace to monitor tasks and provide CEO insights
 */

require('dotenv').config();

const { App } = require('@slack/bolt');
const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');

class CEOSlackMonitoring {
  constructor() {
    this.workflowIntelligence = new WorkflowIntelligenceSystem({
      logLevel: 'info'
    });
    
    // Your real organization
    this.orgId = 'cipio_org';
    this.ceoUserId = null;
    this.ceoSession = null;
    
    // Initialize Slack app
    this.slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: process.env.SLACK_SOCKET_MODE === 'true',
      appToken: process.env.SLACK_APP_TOKEN,
    });
    
    this.setupSlackHandlers();
  }

  /**
   * Initialize CEO account with real Slack user ID
   */
  async initializeCEO(realSlackUserId) {
    console.log('👑 Initializing CEO monitoring...');
    
    this.ceoUserId = realSlackUserId;
    
    // Set CEO role
    this.workflowIntelligence.setUserRole(realSlackUserId, 'ceo', this.orgId);
    
    // Create CEO session
    this.ceoSession = this.workflowIntelligence.createSession(realSlackUserId, {
      slack_workspace: 'CIPIO',
      role: 'ceo',
      monitoring_enabled: true
    });
    
    console.log(`✅ CEO initialized: ${realSlackUserId}`);
    console.log(`🔑 Session: ${this.ceoSession.sessionId}`);
    
    return this.ceoSession;
  }

  /**
   * Set up Slack event handlers
   */
  setupSlackHandlers() {
    // Capture all messages for workflow analysis
    this.slackApp.message(async ({ message, context, say }) => {
      try {
        // Skip bot messages
        if (message.subtype === 'bot_message' || message.bot_id) return;
        
        // Auto-add team members as they interact
        await this.autoAddTeamMember(message.user);
        
        // Capture the workflow data
        await this.workflowIntelligence.captureInboundRequest(
          message.user,
          message.channel,
          message.text,
          {
            messageType: 'slack_message',
            timestamp: new Date(parseFloat(message.ts) * 1000),
            thread_ts: message.thread_ts,
            channel_type: context.channelType
          }
        );
        
        // Check if this looks like a task assignment or completion
        await this.detectTaskActivity(message, say);
        
      } catch (error) {
        console.error('Message processing error:', error.message);
      }
    });

    // CEO-specific commands
    this.slackApp.command('/ceo-dashboard', async ({ ack, command, respond }) => {
      await ack();
      
      if (command.user_id !== this.ceoUserId) {
        await respond({
          response_type: 'ephemeral',
          text: '🚫 This command is only available to the CEO.'
        });
        return;
      }
      
      try {
        const dashboard = await this.generateCEODashboard();
        await respond({
          response_type: 'ephemeral',
          blocks: dashboard
        });
      } catch (error) {
        await respond({
          response_type: 'ephemeral',
          text: `❌ Error generating dashboard: ${error.message}`
        });
      }
    });

    // Task monitoring command
    this.slackApp.command('/task-status', async ({ ack, command, respond }) => {
      await ack();
      
      if (command.user_id !== this.ceoUserId) {
        await respond({
          response_type: 'ephemeral',
          text: '🚫 This command is only available to the CEO.'
        });
        return;
      }
      
      try {
        const taskStatus = await this.getTaskStatusReport();
        await respond({
          response_type: 'ephemeral',
          text: taskStatus
        });
      } catch (error) {
        await respond({
          response_type: 'ephemeral',
          text: `❌ Error getting task status: ${error.message}`
        });
      }
    });

    // AI suggestions command
    this.slackApp.command('/ai-suggestions', async ({ ack, command, respond }) => {
      await ack();
      
      if (command.user_id !== this.ceoUserId) {
        await respond({
          response_type: 'ephemeral',
          text: '🚫 This command is only available to the CEO.'
        });
        return;
      }
      
      try {
        const suggestions = await this.getAISuggestions();
        await respond({
          response_type: 'ephemeral',
          blocks: suggestions
        });
      } catch (error) {
        await respond({
          response_type: 'ephemeral',
          text: `❌ Error getting AI suggestions: ${error.message}`
        });
      }
    });
  }

  /**
   * Auto-add team members as they interact
   */
  async autoAddTeamMember(slackUserId) {
    // Skip if already added or if it's the CEO
    if (slackUserId === this.ceoUserId) return;
    
    const permissions = this.workflowIntelligence.getUserPermissions(slackUserId);
    if (permissions.role !== 'user') return; // Already configured
    
    // Add as regular user by default
    this.workflowIntelligence.setUserRole(slackUserId, 'user', this.orgId);
    console.log(`👤 Auto-added team member: ${slackUserId}`);
  }

  /**
   * Detect task-related activity
   */
  async detectTaskActivity(message, say) {
    const text = message.text.toLowerCase();
    
    // Look for task assignment keywords
    const assignmentKeywords = ['assigned', 'task', 'please do', 'need you to', 'can you', 'work on'];
    const completionKeywords = ['completed', 'finished', 'done', 'ready', 'delivered'];
    
    const isAssignment = assignmentKeywords.some(keyword => text.includes(keyword));
    const isCompletion = completionKeywords.some(keyword => text.includes(keyword));
    
    if (isAssignment && message.user === this.ceoUserId) {
      // CEO assigning a task
      await this.workflowIntelligence.captureOutboundAction(
        message.user,
        message.channel,
        { action: 'task_assignment', content: message.text },
        {
          actionType: 'task_management',
          completion_status: 'assigned',
          success: true,
          task_type: 'assignment'
        }
      );
      
      console.log('📋 Task assignment detected from CEO');
    } else if (isCompletion) {
      // Someone completing a task
      await this.workflowIntelligence.captureOutboundAction(
        message.user,
        message.channel,
        { action: 'task_completion', content: message.text },
        {
          actionType: 'task_management',
          completion_status: 'completed',
          success: true,
          task_type: 'completion'
        }
      );
      
      console.log(`✅ Task completion detected from ${message.user}`);
    }
  }

  /**
   * Generate CEO dashboard
   */
  async generateCEODashboard() {
    if (!this.ceoSession) {
      throw new Error('CEO session not initialized');
    }
    
    // Get team analytics
    const teamData = await this.workflowIntelligence.getAccessibleUsersAnalytics(
      this.ceoUserId, 7, this.ceoSession.sessionId
    );
    
    const teamAnalytics = await this.workflowIntelligence.getFilteredTeamAnalytics(
      this.ceoUserId, 7, this.ceoSession.sessionId
    );
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "👑 CEO Dashboard - Team Overview"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*📊 Total Team Members*\n${teamData.accessible_users.length}`
          },
          {
            type: "mrkdwn",
            text: `*💬 Total Interactions*\n${teamAnalytics.total_interactions}`
          },
          {
            type: "mrkdwn",
            text: `*📈 Active Channels*\n${Object.keys(teamAnalytics.channels || {}).length}`
          },
          {
            type: "mrkdwn",
            text: `*⏱️ Monitoring Period*\n7 days`
          }
        ]
      },
      {
        type: "divider"
      }
    ];
    
    // Add individual team member performance
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*👥 Team Member Activity:*"
      }
    });
    
    Object.entries(teamData.analytics).forEach(([userId, analytics]) => {
      if (userId === this.ceoUserId) return; // Skip CEO
      
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• *${userId}*: ${analytics.total_interactions} interactions\n  Channels: ${Object.keys(analytics.channel_breakdown || {}).length} | Trend: ${analytics.productivity_trends?.trend || 'stable'}`
        }
      });
    });
    
    // Add top tools if available
    if (teamAnalytics.top_tools?.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🛠️ Top Tools Mentioned:*\n${teamAnalytics.top_tools.slice(0, 5).map((tool, i) => `${i+1}. ${tool.tool} (${tool.count})`).join('\n')}`
        }
      });
    }
    
    return blocks;
  }

  /**
   * Get task status report
   */
  async getTaskStatusReport() {
    if (!this.ceoSession) {
      throw new Error('CEO session not initialized');
    }
    
    const teamData = await this.workflowIntelligence.getAccessibleUsersAnalytics(
      this.ceoUserId, 7, this.ceoSession.sessionId
    );
    
    let report = `📋 *Task Status Report*\n\n`;
    report += `📊 *Team Overview:*\n`;
    report += `• Total team members: ${teamData.accessible_users.length}\n`;
    report += `• Monitoring period: Last 7 days\n\n`;
    
    report += `👤 *Individual Performance:*\n`;
    Object.entries(teamData.analytics).forEach(([userId, analytics]) => {
      if (userId === this.ceoUserId) return;
      
      report += `• *${userId}*:\n`;
      report += `  - Interactions: ${analytics.total_interactions}\n`;
      report += `  - Channels: ${Object.keys(analytics.channel_breakdown || {}).length}\n`;
      report += `  - Consistency: ${analytics.workflow_consistency?.pattern || 'unknown'}\n`;
      report += `  - Trend: ${analytics.productivity_trends?.trend || 'stable'}\n\n`;
    });
    
    return report;
  }

  /**
   * Get AI-curated suggestions
   */
  async getAISuggestions() {
    if (!this.ceoSession) {
      throw new Error('CEO session not initialized');
    }
    
    const teamData = await this.workflowIntelligence.getAccessibleUsersAnalytics(
      this.ceoUserId, 7, this.ceoSession.sessionId
    );
    
    const suggestions = this.generateCEOSuggestions(teamData);
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🤖 AI-Curated CEO Suggestions"
        }
      }
    ];
    
    suggestions.forEach((suggestion, i) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${i+1}. ${suggestion.title}*\n${suggestion.description}\n\n*Action:* ${suggestion.action}\n*Impact:* ${suggestion.impact}\n*Time:* ${suggestion.timeToImplement}`
        }
      });
      
      if (i < suggestions.length - 1) {
        blocks.push({ type: "divider" });
      }
    });
    
    return blocks;
  }

  /**
   * Generate CEO suggestions based on team data
   */
  generateCEOSuggestions(teamData) {
    const suggestions = [];
    
    // Calculate team metrics
    const totalInteractions = Object.values(teamData.analytics)
      .reduce((sum, user) => sum + user.total_interactions, 0);
    const teamSize = Object.keys(teamData.analytics).length - 1; // Exclude CEO
    const avgInteractionsPerUser = teamSize > 0 ? totalInteractions / teamSize : 0;
    
    // Low engagement suggestion
    if (avgInteractionsPerUser < 5) {
      suggestions.push({
        title: 'Team Engagement Opportunity',
        description: 'Team activity levels suggest room for improvement in communication and collaboration.',
        action: 'Consider implementing daily standups or weekly team check-ins',
        impact: 'Could increase team communication by 40-60%',
        timeToImplement: '1-2 hours setup, ongoing maintenance'
      });
    }
    
    // Tool usage analysis
    const allTools = new Set();
    Object.values(teamData.analytics).forEach(user => {
      (user.tool_usage || []).forEach(tool => allTools.add(tool.tool));
    });
    
    if (allTools.size > 8) {
      suggestions.push({
        title: 'Tool Stack Optimization',
        description: `Team is using ${allTools.size} different tools. Consolidation could improve efficiency.`,
        action: 'Conduct tool audit and identify consolidation opportunities',
        impact: 'Reduce complexity and licensing costs by 20-30%',
        timeToImplement: '2-4 weeks evaluation'
      });
    }
    
    // Productivity trends
    const productivityTrends = Object.values(teamData.analytics)
      .map(user => user.productivity_trends?.trend)
      .filter(trend => trend);
    
    const decliningCount = productivityTrends.filter(trend => trend === 'decreasing').length;
    if (decliningCount > teamSize * 0.3) {
      suggestions.push({
        title: 'Productivity Trend Alert',
        description: 'Multiple team members show declining productivity patterns.',
        action: 'Schedule 1:1s to identify blockers and provide support',
        impact: 'Prevent productivity decline and improve team morale',
        timeToImplement: '2-3 hours for initial meetings'
      });
    }
    
    // Default suggestion if no specific issues found
    if (suggestions.length === 0) {
      suggestions.push({
        title: 'Team Performance Monitoring Active',
        description: 'Your team monitoring system is collecting valuable data. Continue monitoring to identify optimization opportunities.',
        action: 'Review weekly reports and look for emerging patterns',
        impact: 'Data-driven leadership insights and proactive team management',
        timeToImplement: 'Ongoing - 15 minutes weekly'
      });
    }
    
    return suggestions;
  }

  /**
   * Start the Slack app
   */
  async start() {
    try {
      await this.slackApp.start();
      console.log('🚀 CEO Slack monitoring app is running!');
      console.log('\n💡 Available CEO commands:');
      console.log('   /ceo-dashboard - Get team overview');
      console.log('   /task-status - View task assignments and completions');
      console.log('   /ai-suggestions - Get AI-curated leadership insights');
      
    } catch (error) {
      console.error('❌ Failed to start Slack app:', error.message);
      throw error;
    }
  }
}

/**
 * Setup and start CEO monitoring
 */
async function startCEOMonitoring() {
  console.log('🚀 Starting CEO Slack Monitoring System...\n');
  
  if (!process.env.SLACK_BOT_TOKEN) {
    console.error('❌ SLACK_BOT_TOKEN not found in environment variables');
    console.log('\n📋 Setup required:');
    console.log('1. Add SLACK_BOT_TOKEN to your .env file');
    console.log('2. Add SLACK_SIGNING_SECRET to your .env file');
    console.log('3. Optionally add SLACK_APP_TOKEN for socket mode');
    return;
  }
  
  const ceoMonitoring = new CEOSlackMonitoring();
  
  // Initialize with your real Slack user ID
  // You can get this from Slack by typing /me in any channel
  const ceoSlackUserId = process.env.CEO_SLACK_USER_ID || 'YOUR_SLACK_USER_ID';
  
  await ceoMonitoring.initializeCEO(ceoSlackUserId);
  
  console.log('\n✅ CEO monitoring initialized');
  console.log('📱 Starting Slack integration...\n');
  
  await ceoMonitoring.start();
  
  return ceoMonitoring;
}

// Export for use in other modules
module.exports = { CEOSlackMonitoring, startCEOMonitoring };

// Run if called directly
if (require.main === module) {
  startCEOMonitoring().catch(console.error);
}
