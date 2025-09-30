/**
 * Enhanced CEO Monitoring with Full OAuth Access
 * 
 * Leverages personal OAuth tokens to provide comprehensive CEO insights
 * including DMs, private conversations, and complete team visibility
 */

require('dotenv').config();

const { App } = require('@slack/bolt');
const winston = require('winston');
const SlackOAuthManager = require('./slack-oauth-manager');
const MessageCollector = require('./message-collector');
const WorkflowIntelligenceSystem = require('../core/intelligence/workflow-analyzer');

class EnhancedCEOMonitoring {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      ceoUserId: process.env.CEO_SLACK_USER_ID || 'U01EVR49DDX',
      organizationName: process.env.ORGANIZATION_NAME || 'CIPIO',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/enhanced-ceo-monitoring.log' })
      ],
      defaultMeta: { service: 'enhanced-ceo-monitoring' }
    });
    
    // Initialize components
    this.oauthManager = new SlackOAuthManager();
    this.messageCollector = new MessageCollector(this.oauthManager);
    this.workflowIntelligence = new WorkflowIntelligenceSystem();
    
    // Initialize task processing pipeline
    const TaskProcessingPipeline = require('../core/pipelines/task-processing-pipeline');
    this.taskPipeline = new TaskProcessingPipeline({
      logLevel: this.options.logLevel,
      taskServiceUrl: 'http://localhost:3002'
    });
    
    // Setup task pipeline event handlers
    this.setupTaskPipelineHandlers();
    
    // Initialize Slack app for commands
    this.slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: process.env.SLACK_SOCKET_MODE === 'true',
      appToken: process.env.SLACK_APP_TOKEN,
    });
    
    this.setupSlackCommands();
    
    // CEO session
    this.ceoSession = null;
  }

  /**
   * Initialize CEO monitoring system
   */
  async initialize() {
    try {
      this.logger.info('Initializing Enhanced CEO Monitoring System', {
        ceoUserId: this.options.ceoUserId,
        organization: this.options.organizationName
      });
      
      // Set up CEO role in workflow intelligence
      this.workflowIntelligence.setUserRole(this.options.ceoUserId, 'ceo', 'cipio_org');
      
      // Create CEO session
      this.ceoSession = this.workflowIntelligence.createSession(this.options.ceoUserId, {
        slack_workspace: this.options.organizationName,
        role: 'ceo',
        enhanced_oauth: true
      });
      
      this.logger.info('CEO monitoring initialized', {
        sessionId: this.ceoSession.sessionId
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize CEO monitoring', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup Slack commands for CEO
   */
  setupSlackCommands() {
    // Enhanced CEO dashboard with OAuth data
    this.slackApp.command('/ceo-dashboard-enhanced', async ({ ack, command, respond }) => {
      await ack();
      
      if (command.user_id !== this.options.ceoUserId) {
        await respond({
          response_type: 'ephemeral',
          text: '🚫 This command is only available to the CEO.'
        });
        return;
      }
      
      try {
        const dashboard = await this.generateEnhancedCEODashboard();
        await respond({
          response_type: 'ephemeral',
          blocks: dashboard
        });
      } catch (error) {
        await respond({
          response_type: 'ephemeral',
          text: `❌ Error generating enhanced dashboard: ${error.message}`
        });
      }
    });
    
    // Team conversation analysis
    this.slackApp.command('/team-conversations', async ({ ack, command, respond }) => {
      await ack();
      
      if (command.user_id !== this.options.ceoUserId) {
        await respond({
          response_type: 'ephemeral',
          text: '🚫 This command is only available to the CEO.'
        });
        return;
      }
      
      try {
        const analysis = await this.analyzeTeamConversations();
        await respond({
          response_type: 'ephemeral',
          text: analysis
        });
      } catch (error) {
        await respond({
          response_type: 'ephemeral',
          text: `❌ Error analyzing conversations: ${error.message}`
        });
      }
    });
    
    // Cross-user task tracking
    this.slackApp.command('/task-tracking-enhanced', async ({ ack, command, respond }) => {
      await ack();
      
      if (command.user_id !== this.options.ceoUserId) {
        await respond({
          response_type: 'ephemeral',
          text: '🚫 This command is only available to the CEO.'
        });
        return;
      }
      
      try {
        const taskReport = await this.generateEnhancedTaskReport();
        await respond({
          response_type: 'ephemeral',
          blocks: taskReport
        });
      } catch (error) {
        await respond({
          response_type: 'ephemeral',
          text: `❌ Error generating task report: ${error.message}`
        });
      }
    });
    
    // User interaction analysis
    this.slackApp.command('/user-interaction-analysis', async ({ ack, command, respond }) => {
      await ack();
      
      if (command.user_id !== this.options.ceoUserId) {
        await respond({
          response_type: 'ephemeral',
          text: '🚫 This command is only available to the CEO.'
        });
        return;
      }
      
      try {
        const userIds = command.text.trim().split(/\s+/);
        if (userIds.length !== 2) {
          await respond({
            response_type: 'ephemeral',
            text: '📋 Usage: /user-interaction-analysis user1_id user2_id'
          });
          return;
        }
        
        const analysis = await this.analyzeUserInteractions(userIds[0], userIds[1]);
        await respond({
          response_type: 'ephemeral',
          blocks: analysis
        });
      } catch (error) {
        await respond({
          response_type: 'ephemeral',
          text: `❌ Error analyzing user interactions: ${error.message}`
        });
      }
    });
  }

  /**
   * Generate enhanced CEO dashboard with OAuth data
   */
  async generateEnhancedCEODashboard() {
    const authorizedUsers = this.oauthManager.getAuthorizedUsers();
    const systemStats = this.messageCollector.getSystemStats();
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "👑 Enhanced CEO Dashboard - Complete Team Visibility"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*📊 Authorized Users*\n${authorizedUsers.length}`
          },
          {
            type: "mrkdwn",
            text: `*💬 Total Messages*\n${systemStats.total_messages || 0}`
          },
          {
            type: "mrkdwn",
            text: `*🗨️ Conversations*\n${systemStats.total_conversations || 0}`
          },
          {
            type: "mrkdwn",
            text: `*🔍 Data Coverage*\nDMs + Channels + Groups`
          }
        ]
      },
      {
        type: "divider"
      }
    ];
    
    // Add authorized users section
    if (authorizedUsers.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*👥 Team Members with OAuth Access:*"
        }
      });
      
      for (const user of authorizedUsers.slice(0, 10)) {
        const userStats = this.messageCollector.getUserStats(user.user_id);
        const statsText = userStats ? 
          `${userStats.total_messages} messages, ${userStats.total_conversations} conversations` :
          'Collecting data...';
        
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• *${user.real_name}* (${user.team_name})\n  ${statsText}`
          }
        });
      }
      
      if (authorizedUsers.length > 10) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `... and ${authorizedUsers.length - 10} more team members`
          }
        });
      }
    } else {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*⚠️ No team members have authorized OAuth access yet.*\nDirect them to the OAuth server to connect their Slack accounts."
        }
      });
    }
    
    return blocks;
  }

  /**
   * Analyze team conversations across all authorized users
   */
  async analyzeTeamConversations() {
    const authorizedUsers = this.oauthManager.getAuthorizedUsers();
    
    if (authorizedUsers.length === 0) {
      return "📊 *Team Conversation Analysis*\n\nNo authorized users found. Team members need to connect their Slack accounts via OAuth first.";
    }
    
    let totalMessages = 0;
    let totalConversations = 0;
    let dmCount = 0;
    let channelCount = 0;
    let privateCount = 0;
    
    const conversationTypes = {
      'im': 0,
      'mpim': 0,
      'private_channel': 0,
      'public_channel': 0
    };
    
    // Analyze each user's data
    for (const user of authorizedUsers) {
      const userStats = this.messageCollector.getUserStats(user.user_id);
      if (userStats) {
        totalMessages += userStats.total_messages;
        totalConversations += userStats.total_conversations;
        
        // Breakdown by type
        Object.entries(userStats.conversation_breakdown).forEach(([type, data]) => {
          if (conversationTypes.hasOwnProperty(type)) {
            conversationTypes[type] += data.messages;
          }
        });
      }
    }
    
    let analysis = "📊 *Enhanced Team Conversation Analysis*\n\n";
    analysis += `👥 *Authorized Users:* ${authorizedUsers.length}\n`;
    analysis += `💬 *Total Messages Analyzed:* ${totalMessages.toLocaleString()}\n`;
    analysis += `🗨️ *Total Conversations:* ${totalConversations}\n\n`;
    
    analysis += "*📈 Message Distribution:*\n";
    analysis += `• DMs: ${conversationTypes.im.toLocaleString()} messages\n`;
    analysis += `• Group DMs: ${conversationTypes.mpim.toLocaleString()} messages\n`;
    analysis += `• Private Channels: ${conversationTypes.private_channel.toLocaleString()} messages\n`;
    analysis += `• Public Channels: ${conversationTypes.public_channel.toLocaleString()} messages\n\n`;
    
    // Calculate percentages
    if (totalMessages > 0) {
      const dmPercent = ((conversationTypes.im / totalMessages) * 100).toFixed(1);
      const channelPercent = (((conversationTypes.private_channel + conversationTypes.public_channel) / totalMessages) * 100).toFixed(1);
      
      analysis += "*🎯 Communication Insights:*\n";
      analysis += `• ${dmPercent}% of communication happens in DMs\n`;
      analysis += `• ${channelPercent}% happens in channels\n`;
      
      if (parseFloat(dmPercent) > 60) {
        analysis += `• ⚠️ High DM usage suggests need for more transparent communication\n`;
      }
      
      if (conversationTypes.private_channel > conversationTypes.public_channel) {
        analysis += `• 🔒 More private than public channel usage\n`;
      }
    }
    
    return analysis;
  }

  /**
   * Generate enhanced task report with cross-conversation tracking
   */
  async generateEnhancedTaskReport() {
    const authorizedUsers = this.oauthManager.getAuthorizedUsers();
    const taskKeywords = ['task', 'assigned', 'todo', 'deadline', 'completed', 'finished', 'done'];
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📋 Enhanced Task Tracking Report"
        }
      }
    ];
    
    if (authorizedUsers.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*⚠️ No authorized users found.*\nTeam members need to connect their Slack accounts to enable comprehensive task tracking."
        }
      });
      return blocks;
    }
    
    let totalTaskMentions = 0;
    const userTaskActivity = new Map();
    
    // Analyze task-related messages for each user
    for (const user of authorizedUsers) {
      const userMessages = this.messageCollector.getUserMessages(user.user_id) || [];
      let userTaskCount = 0;
      
      for (const message of userMessages) {
        const lowerText = message.text.toLowerCase();
        if (taskKeywords.some(keyword => lowerText.includes(keyword))) {
          userTaskCount++;
          totalTaskMentions++;
        }
      }
      
      userTaskActivity.set(user.user_id, {
        name: user.real_name,
        taskMentions: userTaskCount,
        totalMessages: userMessages.length
      });
    }
    
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*📊 Total Task Mentions*\n${totalTaskMentions}`
        },
        {
          type: "mrkdwn",
          text: `*👥 Users Analyzed*\n${authorizedUsers.length}`
        },
        {
          type: "mrkdwn",
          text: `*🎯 Coverage*\nDMs + Channels + Groups`
        },
        {
          type: "mrkdwn",
          text: `*📈 Detection Rate*\n${((totalTaskMentions / (this.messageCollector.getSystemStats().total_messages || 1)) * 100).toFixed(2)}%`
        }
      ]
    });
    
    blocks.push({
      type: "divider"
    });
    
    // Top task-active users
    const sortedUsers = Array.from(userTaskActivity.entries())
      .sort(([,a], [,b]) => b.taskMentions - a.taskMentions)
      .slice(0, 5);
    
    if (sortedUsers.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🏆 Most Task-Active Team Members:*"
        }
      });
      
      sortedUsers.forEach(([userId, data], index) => {
        const taskRate = data.totalMessages > 0 ? 
          ((data.taskMentions / data.totalMessages) * 100).toFixed(1) : '0';
        
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${index + 1}. *${data.name}*: ${data.taskMentions} task mentions (${taskRate}% of messages)`
          }
        });
      });
    }
    
    return blocks;
  }

  /**
   * Analyze interactions between two specific users
   */
  async analyzeUserInteractions(userId1, userId2) {
    const conversation = this.messageCollector.getConversationBetweenUsers(userId1, userId2);
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "👥 User Interaction Analysis"
        }
      }
    ];
    
    if (conversation.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*No interactions found between these users.*\nThis could mean:\n• Neither user has authorized OAuth\n• No direct messages or mentions between them\n• Messages are in channels not accessible to both users"
        }
      });
      return blocks;
    }
    
    // Analyze conversation patterns
    const user1Messages = conversation.filter(msg => msg.direction?.includes('user1'));
    const user2Messages = conversation.filter(msg => msg.direction?.includes('user2'));
    const dmMessages = conversation.filter(msg => msg.conversation_type === 'im');
    const channelMentions = conversation.filter(msg => msg.conversation_type !== 'im');
    
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*📊 Total Interactions*\n${conversation.length}`
        },
        {
          type: "mrkdwn",
          text: `*💬 Direct Messages*\n${dmMessages.length}`
        },
        {
          type: "mrkdwn",
          text: `*📢 Channel Mentions*\n${channelMentions.length}`
        },
        {
          type: "mrkdwn",
          text: `*📅 Time Span*\n${this.getTimeSpan(conversation)}`
        }
      ]
    });
    
    // Recent interactions
    const recentMessages = conversation.slice(-5);
    if (recentMessages.length > 0) {
      blocks.push({
        type: "divider"
      });
      
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🕐 Recent Interactions:*"
        }
      });
      
      recentMessages.forEach(msg => {
        const date = new Date(msg.timestamp).toLocaleDateString();
        const preview = msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : '');
        const channel = msg.conversation_type === 'im' ? 'DM' : `#${msg.channel_name}`;
        
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${date}* in ${channel}:\n"${preview}"`
          }
        });
      });
    }
    
    return blocks;
  }

  /**
   * Get time span of conversation
   */
  getTimeSpan(conversation) {
    if (conversation.length === 0) return 'N/A';
    
    const timestamps = conversation.map(msg => new Date(msg.timestamp));
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));
    
    const daysDiff = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) return 'Same day';
    if (daysDiff === 1) return '1 day';
    if (daysDiff < 7) return `${daysDiff} days`;
    if (daysDiff < 30) return `${Math.ceil(daysDiff / 7)} weeks`;
    return `${Math.ceil(daysDiff / 30)} months`;
  }

  /**
   * Setup task pipeline event handlers
   */
  setupTaskPipelineHandlers() {
    // Handle task processing completion
    this.taskPipeline.on('task_processed', (result) => {
      this.logger.info('Task processed successfully', {
        task_id: result.task_id,
        assignee: result.assignee,
        confidence: result.confidence_score,
        has_recommendations: result.has_recommendations
      });
      
      // Store task result for CEO dashboard
      this.storeTaskResult(result);
    });
    
    // Handle processing errors
    this.taskPipeline.on('processing_error', (error) => {
      this.logger.error('Task processing error', {
        message_id: error.messageId,
        error: error.error.message
      });
    });
    
    // Handle desktop delivery requests
    this.taskPipeline.on('desktop_delivery', (deliveryData) => {
      this.handleDesktopDelivery(deliveryData);
    });
    
    // Handle Slack DM delivery requests
    this.taskPipeline.on('slack_dm_delivery', (deliveryData) => {
      this.handleSlackDMDelivery(deliveryData);
    });
    
    // Handle Slack thread delivery requests
    this.taskPipeline.on('slack_thread_delivery', (deliveryData) => {
      this.handleSlackThreadDelivery(deliveryData);
    });
  }

  /**
   * Process new OAuth user for workflow intelligence and task detection
   */
  async processNewOAuthUser(userId, slackUserId) {
    try {
      // Add user to workflow intelligence system
      this.workflowIntelligence.setUserRole(userId, 'user', 'cipio_org');
      
      // Collect their messages
      await this.messageCollector.initializeUserCollection(userId);
      
      // Process messages for workflow intelligence AND task detection
      const userMessages = this.messageCollector.getUserMessages(userId) || [];
      
      for (const message of userMessages.slice(-50)) { // Process last 50 messages
        // Existing workflow intelligence processing
        await this.workflowIntelligence.captureInboundRequest(
          userId,
          message.channel_id,
          message.text,
          {
            messageType: 'slack_message',
            timestamp: message.timestamp,
            conversation_type: message.conversation_type
          }
        );
        
        // NEW: Process through task pipeline for task detection
        await this.processMessageForTasks(message, userId, slackUserId);
      }
      
      this.logger.info('Processed new OAuth user for workflow intelligence and task detection', {
        userId,
        slackUserId,
        messagesProcessed: Math.min(50, userMessages.length)
      });
      
    } catch (error) {
      this.logger.error('Failed to process new OAuth user', { userId, error: error.message });
    }
  }

  /**
   * Process individual message for task detection
   */
  async processMessageForTasks(message, userId, slackUserId) {
    try {
      // Prepare message data for task pipeline
      const messageData = {
        text: message.text,
        ts: message.ts,
        thread_ts: message.thread_ts,
        user: message.user
      };
      
      const messageContext = {
        channel_id: message.channel_id,
        channel_name: message.channel_name,
        user_id: slackUserId,
        timestamp: message.timestamp,
        conversation_type: message.conversation_type,
        organization_id: 'default_org'
      };
      
      // Process through task pipeline (async, non-blocking)
      setImmediate(async () => {
        try {
          await this.taskPipeline.processMessage(messageData, messageContext);
        } catch (error) {
          this.logger.debug('Task processing failed for message', {
            message_id: message.ts,
            error: error.message
          });
        }
      });
      
    } catch (error) {
      this.logger.debug('Failed to process message for tasks', {
        message_ts: message.ts,
        error: error.message
      });
    }
  }

  /**
   * Store task result for CEO dashboard
   */
  storeTaskResult(taskResult) {
    // Store in memory for dashboard access
    if (!this.taskResults) {
      this.taskResults = new Map();
    }
    
    this.taskResults.set(taskResult.task_id, {
      ...taskResult,
      stored_at: new Date()
    });
    
    // Keep only last 100 task results
    if (this.taskResults.size > 100) {
      const oldestKey = this.taskResults.keys().next().value;
      this.taskResults.delete(oldestKey);
    }
  }

  /**
   * Handle desktop delivery
   */
  handleDesktopDelivery(deliveryData) {
    this.logger.info('Desktop delivery requested', {
      task_id: deliveryData.task_id,
      assignee: deliveryData.assignee,
      urgency: deliveryData.urgency
    });
    
    // Desktop delivery will be handled by the desktop app
    // through IPC or WebSocket connections
  }

  /**
   * Handle Slack DM delivery
   */
  async handleSlackDMDelivery(deliveryData) {
    try {
      // Find user ID for assignee
      const assigneeUserId = await this.findSlackUserByName(deliveryData.assignee);
      
      if (!assigneeUserId) {
        this.logger.warn('Could not find Slack user for assignee', {
          assignee: deliveryData.assignee,
          task_id: deliveryData.task_id
        });
        return;
      }
      
      // Create task guidance message
      const message = this.createTaskGuidanceMessage(deliveryData);
      
      // Send DM
      await this.slackApp.client.chat.postMessage({
        channel: assigneeUserId,
        blocks: message.blocks,
        text: message.text
      });
      
      this.logger.info('Task guidance sent via Slack DM', {
        task_id: deliveryData.task_id,
        assignee: deliveryData.assignee,
        user_id: assigneeUserId
      });
      
    } catch (error) {
      this.logger.error('Failed to send Slack DM', {
        task_id: deliveryData.task_id,
        error: error.message
      });
    }
  }

  /**
   * Handle Slack thread delivery
   */
  async handleSlackThreadDelivery(deliveryData) {
    try {
      const message = this.createTaskGuidanceMessage(deliveryData, true);
      
      await this.slackApp.client.chat.postMessage({
        channel: deliveryData.channel_id,
        thread_ts: deliveryData.thread_ts,
        blocks: message.blocks,
        text: message.text
      });
      
      this.logger.info('Task guidance sent via Slack thread', {
        task_id: deliveryData.task_id,
        channel_id: deliveryData.channel_id
      });
      
    } catch (error) {
      this.logger.error('Failed to send Slack thread message', {
        task_id: deliveryData.task_id,
        error: error.message
      });
    }
  }

  /**
   * Create task guidance message for Slack
   */
  createTaskGuidanceMessage(deliveryData, isThread = false) {
    const urgencyEmoji = deliveryData.urgency === 'high' ? '🚨' : 
                        deliveryData.urgency === 'medium' ? '⚡' : '📋';
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${urgencyEmoji} Task Guidance${deliveryData.assignee ? ` for ${deliveryData.assignee}` : ''}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Task:* ${deliveryData.task_summary}\n*Urgency:* ${deliveryData.urgency.toUpperCase()}`
        }
      }
    ];
    
    // Add recommendations if available
    if (deliveryData.recommendations && deliveryData.recommendations.tool_recommendations) {
      const topTools = deliveryData.recommendations.tool_recommendations.slice(0, 3);
      const toolText = topTools.map(tool => 
        `• *${tool.tool_name}*: ${tool.reasoning}`
      ).join('\n');
      
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Recommended Tools:*\n${toolText}`
        }
      });
    }
    
    // Add personalized message if available
    if (deliveryData.recommendations && deliveryData.recommendations.personalized_message) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: deliveryData.recommendations.personalized_message
        }
      });
    }
    
    return {
      blocks: blocks,
      text: `Task guidance: ${deliveryData.task_summary}`
    };
  }

  /**
   * Find Slack user by name
   */
  async findSlackUserByName(name) {
    if (!name) return null;
    
    try {
      // Simple implementation - in production, you'd want to maintain a user mapping
      const users = await this.slackApp.client.users.list();
      const user = users.members.find(member => 
        member.real_name?.toLowerCase().includes(name.toLowerCase()) ||
        member.display_name?.toLowerCase().includes(name.toLowerCase()) ||
        member.name?.toLowerCase().includes(name.toLowerCase())
      );
      
      return user?.id || null;
    } catch (error) {
      this.logger.error('Failed to find Slack user', { name, error: error.message });
      return null;
    }
  }

  /**
   * Get task results for dashboard
   */
  getTaskResults() {
    if (!this.taskResults) return [];
    return Array.from(this.taskResults.values()).sort((a, b) => 
      new Date(b.processed_at) - new Date(a.processed_at)
    );
  }

  /**
   * Start the enhanced CEO monitoring system
   */
  async start() {
    try {
      await this.initialize();
      await this.slackApp.start();
      
      // Start task processing pipeline
      this.taskPipeline.start();
      
      console.log('\n🚀 Enhanced CEO Monitoring System Running!');
      console.log('\n👑 Available CEO Commands:');
      console.log('   /ceo-dashboard-enhanced     - Complete team visibility dashboard');
      console.log('   /team-conversations         - Analyze team communication patterns');
      console.log('   /task-tracking-enhanced     - Cross-conversation task tracking');
      console.log('   /user-interaction-analysis  - Analyze interactions between users');
      console.log('\n🔍 OAuth Features:');
      console.log('   • Complete DM access (with user consent)');
      console.log('   • Private channel visibility');
      console.log('   • Cross-conversation task tracking');
      console.log('   • Comprehensive workflow intelligence');
      console.log('\n🤖 AI Task Intelligence:');
      console.log('   • Automatic task detection from conversations');
      console.log('   • AI-powered tool recommendations');
      console.log('   • Personalized task completion guidance');
      console.log('   • Real-time delivery to assignees');
      console.log('\n📊 System Status:');
      console.log(`   CEO User ID: ${this.options.ceoUserId}`);
      console.log(`   Organization: ${this.options.organizationName}`);
      console.log(`   Session ID: ${this.ceoSession?.sessionId}`);
      console.log(`   Task Pipeline: Active`);
      
      this.logger.info('Enhanced CEO monitoring system with AI task intelligence started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start enhanced CEO monitoring', { error: error.message });
      throw error;
    }
  }
}

module.exports = EnhancedCEOMonitoring;

// Start if run directly
if (require.main === module) {
  const monitoring = new EnhancedCEOMonitoring();
  monitoring.start().catch(console.error);
}
