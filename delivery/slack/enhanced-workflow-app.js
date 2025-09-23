/**
 * Enhanced HeyJarvis Slack App with Workflow Intelligence
 * 
 * Features:
 * 1. Workflow pattern recognition
 * 2. Actionable insights delivery
 * 3. User behavior analysis
 * 4. Proactive assistance
 * 5. Analytics dashboard
 */

const { App } = require('@slack/bolt');
const express = require('express');
const winston = require('winston');
const WorkflowIntelligenceSystem = require('../../core/intelligence/workflow-analyzer');

class EnhancedWorkflowSlackApp {
  constructor(options = {}) {
    this.options = {
      port: process.env.PORT || 3000,
      logLevel: process.env.LOG_LEVEL || 'info',
      ...options
    };
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/enhanced-slack-app.log' })
      ],
      defaultMeta: { service: 'enhanced-slack-app' }
    });
    
    // Initialize Workflow Intelligence System
    this.workflowIntelligence = new WorkflowIntelligenceSystem({
      logLevel: this.options.logLevel
    });
    
    // Initialize Slack Bolt app
    this.slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: process.env.SLACK_SOCKET_MODE === 'true',
      appToken: process.env.SLACK_APP_TOKEN,
      port: this.options.port
    });
    
    // Initialize Express app for analytics
    this.expressApp = express();
    this.expressApp.use(express.json());
    
    // Track user interactions
    this.userSessions = new Map();
    this.insightQueue = new Map();
  }

  /**
   * Initialize the enhanced Slack app
   */
  async initialize() {
    try {
      this.logger.info('Initializing Enhanced Workflow Slack App...');
      
      // Setup workflow intelligence listeners
      this.setupWorkflowIntelligence();
      
      // Setup commands
      this.setupCommands();
      
      // Setup interactive elements
      this.setupInteractions();
      
      // Setup analytics dashboard
      this.setupAnalyticsDashboard();
      
      // Setup periodic insight delivery
      this.setupPeriodicInsights();
      
      // Start the app
      await this.slackApp.start();
      
      // Start Express server
      this.expressApp.listen(this.options.port + 1, () => {
        this.logger.info(`Analytics dashboard running on port ${this.options.port + 1}`);
      });
      
      this.logger.info('🤖 Enhanced HeyJarvis Slack app initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced Slack app', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup workflow intelligence listeners
   */
  setupWorkflowIntelligence() {
    // Capture all messages for workflow analysis
    this.slackApp.message(async ({ message, context, say }) => {
      try {
        // Skip bot messages
        if (message.subtype === 'bot_message' || message.bot_id) {
          return;
        }
        
        // Capture the inbound request
        const requestData = await this.workflowIntelligence.captureInboundRequest(
          message.user,
          message.channel,
          message.text,
          {
            messageType: message.type,
            timestamp: message.ts,
            thread_ts: message.thread_ts,
            channel_type: context.channelType
          }
        );

        // Update user session
        this.updateUserSession(message.user, 'message', requestData);

        // Check for immediate insights
        await this.checkForImmediateInsights(message.user, requestData, say);

        this.logger.debug('Message captured for workflow analysis', {
          user_id: message.user,
          message_type: requestData.context.messageType,
          intent: requestData.context.intent?.intent
        });

      } catch (error) {
        this.logger.error('Workflow intelligence capture failed', { 
          error: error.message,
          user_id: message.user 
        });
      }
    });

    // Capture reactions as feedback
    this.slackApp.event('reaction_added', async ({ event }) => {
      try {
        await this.workflowIntelligence.captureOutboundAction(
          event.user,
          event.item.channel,
          {
            type: 'reaction',
            reaction: event.reaction,
            item_type: event.item.type
          },
          {
            completion_status: 'completed',
            success: true,
            actionType: 'feedback'
          }
        );
      } catch (error) {
        this.logger.error('Reaction capture failed', { error: error.message });
      }
    });

    // Capture app mentions for direct assistance
    this.slackApp.event('app_mention', async ({ event, say }) => {
      try {
        const requestData = await this.workflowIntelligence.captureInboundRequest(
          event.user,
          event.channel,
          event.text,
          {
            messageType: 'app_mention',
            timestamp: event.ts,
            is_direct_request: true
          }
        );

        // Provide immediate intelligent response
        const response = await this.generateIntelligentResponse(requestData);
        await say(response);

      } catch (error) {
        this.logger.error('App mention handling failed', { error: error.message });
        await say("I'm having trouble processing your request right now. Please try again later.");
      }
    });
  }

  /**
   * Setup slash commands
   */
  setupCommands() {
    // Main HeyJarvis command
    this.slackApp.command('/heyjarvis', async ({ ack, command, respond }) => {
      await ack();
      
      try {
        // Capture command as inbound request
        const requestData = await this.workflowIntelligence.captureInboundRequest(
          command.user_id,
          command.channel_id,
          command.text,
          {
            messageType: 'slash_command',
            command: command.command
          }
        );

        // Process intelligent command
        const response = await this.processIntelligentCommand(command, requestData);
        await respond(response);

        // Capture command completion as outbound action
        await this.workflowIntelligence.captureOutboundAction(
          command.user_id,
          command.channel_id,
          { command: command.command, text: command.text },
          { completion_status: 'completed', success: true }
        );

      } catch (error) {
        this.logger.error('Command processing failed', { error: error.message });
        await respond({
          response_type: 'ephemeral',
          text: 'Sorry, I encountered an error processing your command.'
        });
      }
    });

    // Insights command
    this.slackApp.command('/insights', async ({ ack, command, respond }) => {
      await ack();
      
      try {
        const insights = await this.workflowIntelligence.getUserActionableInsights(command.user_id);
        const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(command.user_id);
        
        const response = this.formatInsightsResponse(insights, analytics);
        await respond(response);

      } catch (error) {
        this.logger.error('Insights command failed', { error: error.message });
        await respond({
          response_type: 'ephemeral',
          text: 'Sorry, I couldn\'t retrieve your insights right now.'
        });
      }
    });

    // Analytics command
    this.slackApp.command('/workflow-stats', async ({ ack, command, respond }) => {
      await ack();
      
      try {
        const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(command.user_id, 14);
        const response = this.formatAnalyticsResponse(analytics);
        await respond(response);

      } catch (error) {
        this.logger.error('Analytics command failed', { error: error.message });
        await respond({
          response_type: 'ephemeral',
          text: 'Sorry, I couldn\'t retrieve your analytics right now.'
        });
      }
    });
  }

  /**
   * Setup interactive elements (buttons, modals, etc.)
   */
  setupInteractions() {
    // Handle insight actions
    this.slackApp.action(/^insight_/, async ({ ack, body, respond }) => {
      await ack();
      
      try {
        const actionId = body.actions[0].action_id;
        const [, insightId, suggestionIndex] = actionId.split('_');
        
        // Show detailed insight information
        const insightDetails = await this.getInsightDetails(body.user.id, insightId, suggestionIndex);
        await respond(insightDetails);

        // Capture interaction
        await this.workflowIntelligence.captureOutboundAction(
          body.user.id,
          body.channel.id,
          { action: 'view_insight_details', insight_id: insightId },
          { completion_status: 'completed', success: true }
        );

      } catch (error) {
        this.logger.error('Insight action failed', { error: error.message });
      }
    });

    // Handle insight completion
    this.slackApp.action(/^complete_insight_/, async ({ ack, body, respond }) => {
      await ack();
      
      try {
        const insightId = body.actions[0].action_id.replace('complete_insight_', '');
        
        await this.workflowIntelligence.markInsightCompleted(body.user.id, insightId);
        
        await respond({
          response_type: 'ephemeral',
          text: '✅ Great! I\'ve marked this insight as completed. Keep up the good work!'
        });

      } catch (error) {
        this.logger.error('Insight completion failed', { error: error.message });
      }
    });

    // Handle insight dismissal
    this.slackApp.action(/^dismiss_insight_/, async ({ ack, body, respond }) => {
      await ack();
      
      try {
        const insightId = body.actions[0].action_id.replace('dismiss_insight_', '');
        
        await this.workflowIntelligence.dismissInsight(body.user.id, insightId);
        
        await respond({
          response_type: 'ephemeral',
          text: '👍 I\'ve dismissed this insight. I\'ll learn from your preferences.'
        });

      } catch (error) {
        this.logger.error('Insight dismissal failed', { error: error.message });
      }
    });

    // Handle insight snoozing
    this.slackApp.action(/^snooze_insight_/, async ({ ack, body, respond }) => {
      await ack();
      
      try {
        const insightId = body.actions[0].action_id.replace('snooze_insight_', '');
        
        // Add to snooze queue (remind in 24 hours)
        this.scheduleInsightReminder(body.user.id, insightId, 24);
        
        await respond({
          response_type: 'ephemeral',
          text: '⏰ I\'ll remind you about this insight tomorrow.'
        });

      } catch (error) {
        this.logger.error('Insight snoozing failed', { error: error.message });
      }
    });
  }

  /**
   * Check for immediate insights based on user request
   */
  async checkForImmediateInsights(userId, requestData, say) {
    try {
      // Check if user should receive insights
      if (!this.workflowIntelligence.shouldShareInsights(userId)) {
        return;
      }

      // Get current insights
      const insights = await this.workflowIntelligence.getUserActionableInsights(userId, 3);
      
      if (insights.length === 0) {
        return;
      }

      // Check if current request relates to existing insights
      const relevantInsights = this.findRelevantInsights(insights, requestData);
      
      if (relevantInsights.length > 0) {
        await this.shareWorkflowInsights(say, relevantInsights);
        this.workflowIntelligence.markInsightsShared(userId);
      }

    } catch (error) {
      this.logger.error('Immediate insights check failed', { error: error.message });
    }
  }

  /**
   * Find insights relevant to current request
   */
  findRelevantInsights(insights, requestData) {
    const requestIntent = requestData.context.intent?.intent;
    const requestTools = requestData.context.tools_mentioned || [];
    
    return insights.filter(insight => {
      // Check if insight relates to current intent
      const hasRelevantSuggestion = insight.actionable_suggestions?.some(suggestion => {
        return suggestion.category === requestIntent ||
               suggestion.suggestion.toLowerCase().includes(requestIntent) ||
               requestTools.some(tool => suggestion.suggestion.toLowerCase().includes(tool));
      });
      
      return hasRelevantSuggestion;
    });
  }

  /**
   * Share workflow insights with user
   */
  async shareWorkflowInsights(say, insights) {
    const topInsight = insights[0];
    const suggestions = topInsight.actionable_suggestions?.slice(0, 2) || [];

    if (suggestions.length === 0) {
      return;
    }

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🧠 *Workflow Intelligence Alert*\n\nI've noticed some patterns in your workflow that could help you save time:`
        }
      },
      {
        type: "divider"
      }
    ];

    suggestions.forEach((suggestion, index) => {
      const priorityEmoji = suggestion.priority === 'high' ? '🔥' : suggestion.priority === 'medium' ? '⚡' : '💡';
      
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${priorityEmoji} *${suggestion.suggestion}*\n${suggestion.rationale}\n_Estimated time savings: ${suggestion.estimated_time_savings || 'Significant'}_`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Learn More"
          },
          action_id: `insight_${topInsight.id}_${index}`,
          style: suggestion.priority === 'high' ? 'primary' : 'default'
        }
      });
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `💡 Based on your recent ${topInsight.key_observations?.length || 0} workflow patterns`
        }
      ]
    });

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "✅ Mark as Done"
          },
          style: "primary",
          action_id: `complete_insight_${topInsight.id}`
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "⏰ Remind Me Later"
          },
          action_id: `snooze_insight_${topInsight.id}`
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "❌ Dismiss"
          },
          action_id: `dismiss_insight_${topInsight.id}`
        }
      ]
    });

    await say({ blocks });
  }

  /**
   * Generate intelligent response to user request
   */
  async generateIntelligentResponse(requestData) {
    const intent = requestData.context.intent?.intent;
    const toolsMentioned = requestData.context.tools_mentioned || [];
    const urgency = requestData.context.urgency;

    // Get user's workflow history for context
    const recentWorkflow = await this.workflowIntelligence.getUserRecentWorkflow(
      requestData.userId, null, 3
    );

    // Generate contextual response based on patterns
    let response = "I'm here to help! ";

    if (intent === 'tool_recommendation') {
      response += "Based on your workflow patterns, I can suggest some tools that might help. ";
    } else if (intent === 'task_automation') {
      response += "I see you're interested in automation. Let me analyze your recent activities. ";
    } else if (intent === 'workflow_optimization') {
      response += "Great! I've been tracking your workflow patterns and have some optimization ideas. ";
    }

    if (urgency === 'high') {
      response += "I understand this is urgent - let me prioritize this for you. ";
    }

    if (toolsMentioned.length > 0) {
      response += `I notice you mentioned ${toolsMentioned.join(', ')}. I can help optimize how you use these tools. `;
    }

    // Add specific suggestions based on patterns
    const insights = await this.workflowIntelligence.getUserActionableInsights(requestData.userId, 1);
    if (insights.length > 0) {
      const topSuggestion = insights[0].actionable_suggestions?.[0];
      if (topSuggestion) {
        response += `\n\n💡 *Quick suggestion*: ${topSuggestion.suggestion} - ${topSuggestion.rationale}`;
      }
    }

    return {
      response_type: 'ephemeral',
      text: response
    };
  }

  /**
   * Process intelligent command with context
   */
  async processIntelligentCommand(command, requestData) {
    const text = command.text.toLowerCase().trim();
    
    if (!text || text === 'help') {
      return this.getHelpResponse();
    }
    
    if (text.includes('insight') || text.includes('suggestion')) {
      const insights = await this.workflowIntelligence.getUserActionableInsights(command.user_id);
      return this.formatInsightsResponse(insights);
    }
    
    if (text.includes('stats') || text.includes('analytics')) {
      const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(command.user_id);
      return this.formatAnalyticsResponse(analytics);
    }
    
    if (text.includes('automat')) {
      return this.getAutomationSuggestions(command.user_id);
    }
    
    if (text.includes('tool')) {
      return this.getToolRecommendations(command.user_id);
    }
    
    // Default contextual response
    return this.generateIntelligentResponse(requestData);
  }

  /**
   * Format insights response
   */
  formatInsightsResponse(insights, analytics = null) {
    if (insights.length === 0) {
      return {
        response_type: 'ephemeral',
        text: '🤔 No specific insights available yet. Keep using your tools and I\'ll learn your patterns!'
      };
    }

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📊 *Your Workflow Insights*\n\nI found ${insights.length} actionable suggestions for you:`
        }
      }
    ];

    insights.slice(0, 3).forEach((insight, index) => {
      const topSuggestion = insight.actionable_suggestions?.[0];
      if (topSuggestion) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${index + 1}. *${topSuggestion.suggestion}*\n${topSuggestion.rationale}\n_Priority: ${topSuggestion.priority}_`
          }
        });
      }
    });

    if (analytics) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `📈 Based on ${analytics.total_interactions} recent interactions`
          }
        ]
      });
    }

    return {
      response_type: 'ephemeral',
      blocks
    };
  }

  /**
   * Format analytics response
   */
  formatAnalyticsResponse(analytics) {
    const topIntent = analytics.top_intents[0];
    const topTool = analytics.tool_usage[0];

    const text = `📊 *Your Workflow Analytics (Last ${analytics.period_days} days)*

📈 *Activity Summary*
• Total interactions: ${analytics.total_interactions}
• Requests: ${analytics.inbound_requests}
• Actions: ${analytics.outbound_actions}
• Active insights: ${analytics.active_insights}

🎯 *Top Intent*
${topIntent ? `• ${topIntent.intent} (${topIntent.count} times)` : '• No dominant pattern yet'}

🛠️ *Most Mentioned Tool*
${topTool ? `• ${topTool.tool} (${topTool.count} mentions)` : '• No specific tool focus'}

⚡ *Urgency Distribution*
• High: ${analytics.urgency_distribution.high}
• Medium: ${analytics.urgency_distribution.medium}  
• Low: ${analytics.urgency_distribution.low}

🕒 *Peak Activity Hours*
${analytics.time_patterns.most_active_hours.slice(0, 3).map(h => `• ${h.hour}:00 (${h.count} interactions)`).join('\n')}`;

    return {
      response_type: 'ephemeral',
      text
    };
  }

  /**
   * Get automation suggestions
   */
  async getAutomationSuggestions(userId) {
    const insights = await this.workflowIntelligence.getUserActionableInsights(userId);
    const automationInsights = insights.filter(insight => 
      insight.automation_opportunities?.length > 0
    );

    if (automationInsights.length === 0) {
      return {
        response_type: 'ephemeral',
        text: '🤖 I haven\'t identified specific automation opportunities yet. Keep working with your tools and I\'ll find patterns to automate!'
      };
    }

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🤖 *Automation Opportunities*\n\nHere are processes I think you could automate:"
        }
      }
    ];

    automationInsights[0].automation_opportunities.slice(0, 3).forEach((opportunity, index) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${index + 1}. *${opportunity.process}*\n*Trigger:* ${opportunity.trigger}\n*Tools needed:* ${opportunity.tools.join(', ')}\n*Complexity:* ${opportunity.complexity}`
        }
      });
    });

    return {
      response_type: 'ephemeral',
      blocks
    };
  }

  /**
   * Get tool recommendations
   */
  async getToolRecommendations(userId) {
    const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(userId);
    const topIntents = analytics.top_intents.slice(0, 3);

    if (topIntents.length === 0) {
      return {
        response_type: 'ephemeral',
        text: '🛠️ I need to learn more about your workflow patterns before I can recommend specific tools. Keep interacting and I\'ll provide personalized suggestions!'
      };
    }

    const recommendations = this.generateToolRecommendations(topIntents);

    return {
      response_type: 'ephemeral',
      text: `🛠️ *Tool Recommendations*\n\nBased on your frequent activities:\n\n${recommendations}`
    };
  }

  /**
   * Generate tool recommendations based on user patterns
   */
  generateToolRecommendations(topIntents) {
    const toolMap = {
      'task_automation': ['Zapier', 'Microsoft Power Automate', 'IFTTT'],
      'tool_recommendation': ['Notion', 'Airtable', 'ClickUp'],
      'integration_help': ['Zapier', 'Integromat', 'Pipedream'],
      'workflow_optimization': ['Asana', 'Monday.com', 'Linear'],
      'information_seeking': ['Notion', 'Obsidian', 'Roam Research']
    };

    return topIntents.map((intent, index) => {
      const tools = toolMap[intent.intent] || ['General productivity tools'];
      return `${index + 1}. For *${intent.intent.replace('_', ' ')}* (${intent.count}x): ${tools.join(', ')}`;
    }).join('\n\n');
  }

  /**
   * Get help response
   */
  getHelpResponse() {
    return {
      response_type: 'ephemeral',
      text: `🤖 *HeyJarvis Workflow Intelligence*

I learn from your Slack interactions to provide personalized workflow insights and automation suggestions.

*Available Commands:*
• \`/heyjarvis insights\` - Get personalized workflow insights
• \`/heyjarvis stats\` - View your workflow analytics  
• \`/heyjarvis automation\` - See automation opportunities
• \`/heyjarvis tools\` - Get tool recommendations
• \`/insights\` - Quick insights overview
• \`/workflow-stats\` - Detailed analytics

*How it works:*
I analyze your messages, reactions, and interactions to identify patterns and suggest improvements to your workflow.

Just mention me (@HeyJarvis) or use these commands to get started! 🚀`
    };
  }

  /**
   * Setup analytics dashboard
   */
  setupAnalyticsDashboard() {
    // User workflow analytics endpoint
    this.expressApp.get('/api/workflow-insights/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const days = parseInt(req.query.days) || 7;
        
        const analytics = await this.workflowIntelligence.getUserWorkflowAnalytics(userId, days);
        const insights = await this.workflowIntelligence.getUserActionableInsights(userId);
        
        res.json({
          analytics,
          insights,
          generated_at: new Date()
        });
        
      } catch (error) {
        this.logger.error('Analytics API error', { error: error.message });
        res.status(500).json({ error: 'Failed to retrieve analytics' });
      }
    });

    // Team analytics endpoint
    this.expressApp.get('/api/team-analytics', async (req, res) => {
      try {
        // Aggregate team analytics (simplified for demo)
        const teamStats = {
          total_users: this.workflowIntelligence.userWorkflows.size,
          total_interactions: Array.from(this.workflowIntelligence.userWorkflows.values())
            .reduce((sum, workflows) => sum + workflows.length, 0),
          active_insights: Array.from(this.workflowIntelligence.actionableInsights.values())
            .reduce((sum, insights) => sum + insights.filter(i => !i.dismissed && !i.completed).length, 0)
        };
        
        res.json({
          team_stats: teamStats,
          generated_at: new Date()
        });
        
      } catch (error) {
        this.logger.error('Team analytics API error', { error: error.message });
        res.status(500).json({ error: 'Failed to retrieve team analytics' });
      }
    });

    // Health check endpoint
    this.expressApp.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date(),
        workflow_intelligence: 'active'
      });
    });
  }

  /**
   * Setup periodic insights delivery
   */
  setupPeriodicInsights() {
    // Check for insights to deliver every hour
    setInterval(async () => {
      try {
        await this.deliverScheduledInsights();
      } catch (error) {
        this.logger.error('Scheduled insights delivery failed', { error: error.message });
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Deliver scheduled insights
   */
  async deliverScheduledInsights() {
    // This would be more sophisticated in production
    // For now, just log that we're checking
    this.logger.debug('Checking for scheduled insights delivery');
  }

  /**
   * Update user session tracking
   */
  updateUserSession(userId, action, data) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        first_seen: new Date(),
        last_activity: new Date(),
        session_count: 0,
        actions: []
      });
    }
    
    const session = this.userSessions.get(userId);
    session.last_activity = new Date();
    session.actions.push({ action, timestamp: new Date(), data });
    
    // Keep only recent actions (last 100)
    if (session.actions.length > 100) {
      session.actions = session.actions.slice(-50);
    }
  }

  /**
   * Get insight details for user
   */
  async getInsightDetails(userId, insightId, suggestionIndex) {
    const insights = await this.workflowIntelligence.getUserActionableInsights(userId);
    const insight = insights.find(i => i.id === insightId);
    
    if (!insight || !insight.actionable_suggestions?.[suggestionIndex]) {
      return {
        response_type: 'ephemeral',
        text: 'Sorry, I couldn\'t find the details for this insight.'
      };
    }
    
    const suggestion = insight.actionable_suggestions[suggestionIndex];
    
    return {
      response_type: 'ephemeral',
      text: `🔍 *Insight Details*\n\n*Suggestion:* ${suggestion.suggestion}\n\n*Why this helps:* ${suggestion.rationale}\n\n*How to implement:* ${suggestion.implementation}\n\n*Priority:* ${suggestion.priority}\n*Estimated time savings:* ${suggestion.estimated_time_savings}\n*Category:* ${suggestion.category}`
    };
  }

  /**
   * Schedule insight reminder
   */
  scheduleInsightReminder(userId, insightId, hours) {
    setTimeout(async () => {
      try {
        // Find user's channel for DM
        const userInfo = await this.slackApp.client.users.info({ user: userId });
        if (userInfo.ok) {
          const dm = await this.slackApp.client.conversations.open({
            users: userId
          });
          
          if (dm.ok) {
            await this.slackApp.client.chat.postMessage({
              channel: dm.channel.id,
              text: `⏰ *Reminder*\n\nYou asked me to remind you about a workflow insight. Would you like me to show it again?`,
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `⏰ *Reminder*\n\nYou asked me to remind you about a workflow insight. Would you like me to show it again?`
                  }
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "Show Insight"
                      },
                      action_id: `show_insight_${insightId}`,
                      style: "primary"
                    },
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "Not Now"
                      },
                      action_id: `snooze_insight_${insightId}`
                    }
                  ]
                }
              ]
            });
          }
        }
      } catch (error) {
        this.logger.error('Insight reminder failed', { error: error.message });
      }
    }, hours * 60 * 60 * 1000);
  }
}

module.exports = EnhancedWorkflowSlackApp;
