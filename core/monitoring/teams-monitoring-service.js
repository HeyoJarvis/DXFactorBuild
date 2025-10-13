/**
 * Teams Monitoring Service
 * 
 * Continuously monitors Microsoft Teams channels and chats for new messages
 * Detects work requests and auto-creates tasks (like Slack integration)
 * 
 * Features:
 * - Polls Teams channels and chats periodically
 * - Uses TeamsTaskDetector AI to identify work requests
 * - Auto-creates tasks in database
 * - Tracks processed messages to avoid duplicates
 * - Emits events for UI updates
 */

const EventEmitter = require('events');
const winston = require('winston');

class TeamsMonitoringService extends EventEmitter {
  constructor(graphService, teamsTaskDetector, dbAdapter, options = {}) {
    super();
    
    this.graphService = graphService;
    this.teamsTaskDetector = teamsTaskDetector;
    this.dbAdapter = dbAdapter;
    
    this.options = {
      pollInterval: options.pollInterval || 3 * 60 * 1000, // 3 minutes
      maxMessagesPerPoll: options.maxMessagesPerPoll || 50,
      includeChannels: options.includeChannels !== false,
      includeChats: options.includeChats !== false,
      autoCreateTasks: options.autoCreateTasks !== false,
      confidenceThreshold: options.confidenceThreshold || 0.6,
      ...options
    };
    
    // State tracking
    this.isMonitoring = false;
    this.pollTimer = null;
    this.processedMessages = new Set(); // Track message IDs to avoid duplicates
    this.lastPollTime = new Date();
    this.stats = {
      messagesProcessed: 0,
      tasksCreated: 0,
      errors: 0,
      lastPoll: null
    };
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'desktop/logs/teams-monitoring.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'teams-monitoring' }
    });
    
    this.logger.info('Teams Monitoring Service initialized', this.options);
  }
  
  /**
   * Start monitoring Teams
   */
  async startMonitoring(userId) {
    if (this.isMonitoring) {
      this.logger.warn('Monitoring already active');
      return;
    }
    
    this.userId = userId;
    this.isMonitoring = true;
    this.logger.info('Starting Teams monitoring', { userId });
    
    // Do initial poll immediately
    await this.pollTeamsMessages();
    
    // Set up recurring polling
    this.pollTimer = setInterval(() => {
      this.pollTeamsMessages().catch(error => {
        this.logger.error('Poll error', { error: error.message });
        this.stats.errors++;
      });
    }, this.options.pollInterval);
    
    this.emit('monitoring:started', { userId });
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    
    this.logger.info('Teams monitoring stopped', this.stats);
    this.emit('monitoring:stopped', this.stats);
  }
  
  /**
   * Poll Teams for new messages
   */
  async pollTeamsMessages() {
    const pollStartTime = Date.now();
    this.logger.debug('Starting Teams poll');
    
    try {
      const newMessages = [];
      
      // Poll channels if enabled
      if (this.options.includeChannels) {
        const channelMessages = await this.pollChannelMessages();
        newMessages.push(...channelMessages);
      }
      
      // Poll chats if enabled
      if (this.options.includeChats) {
        const chatMessages = await this.pollChatMessages();
        newMessages.push(...chatMessages);
      }
      
      this.logger.info('Poll completed', {
        messagesFound: newMessages.length,
        duration: Date.now() - pollStartTime
      });
      
      // Process messages for task detection
      if (newMessages.length > 0) {
        await this.processMessages(newMessages);
      }
      
      this.stats.lastPoll = new Date();
      this.lastPollTime = new Date();
      this.emit('poll:completed', { messageCount: newMessages.length });
      
    } catch (error) {
      this.logger.error('Poll failed', { error: error.message, stack: error.stack });
      this.stats.errors++;
      this.emit('poll:error', { error: error.message });
    }
  }
  
  /**
   * Poll all channel messages
   */
  async pollChannelMessages() {
    const messages = [];
    
    try {
      // Get user's teams
      const teams = await this.graphService.getUserTeams();
      
      for (const team of teams) {
        try {
          // Get channels for this team
          const channels = await this.graphService.getTeamChannels(team.id);
          
          for (const channel of channels) {
            try {
              // Get recent messages from this channel
              const channelMessages = await this.graphService.getTeamChannelMessages(
                team.id,
                channel.id,
                { maxResults: 20 }
              );
              
              // Filter new messages
              for (const msg of channelMessages) {
                if (!this.isMessageProcessed(msg.id)) {
                  messages.push({
                    ...msg,
                    sourceType: 'teams_channel',
                    teamId: team.id,
                    teamName: team.displayName,
                    channelId: channel.id,
                    channelName: channel.displayName
                  });
                }
              }
              
            } catch (channelError) {
              this.logger.debug('Failed to fetch channel messages', {
                team: team.displayName,
                channel: channel.displayName,
                error: channelError.message
              });
            }
          }
          
        } catch (teamError) {
          this.logger.debug('Failed to fetch team channels', {
            team: team.displayName,
            error: teamError.message
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to poll channel messages', { error: error.message });
    }
    
    return messages;
  }
  
  /**
   * Poll all chat messages
   */
  async pollChatMessages() {
    const messages = [];
    
    try {
      // Get user's chats
      const chats = await this.graphService.getUserChats();
      
      for (const chat of chats) {
        try {
          // Get recent messages from this chat
          const chatMessages = await this.graphService.getTeamChatMessages(
            chat.id,
            { maxResults: 20 }
          );
          
          // Filter new messages
          for (const msg of chatMessages) {
            if (!this.isMessageProcessed(msg.id)) {
              messages.push({
                ...msg,
                sourceType: 'teams_chat',
                chatId: chat.id,
                chatTopic: chat.topic || 'Direct chat'
              });
            }
          }
          
        } catch (chatError) {
          this.logger.debug('Failed to fetch chat messages', {
            chat: chat.topic || chat.id,
            error: chatError.message
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to poll chat messages', { error: error.message });
    }
    
    return messages;
  }
  
  /**
   * Process messages for task detection
   */
  async processMessages(messages) {
    for (const message of messages) {
      try {
        await this.processMessage(message);
        this.stats.messagesProcessed++;
      } catch (error) {
        this.logger.error('Failed to process message', {
          messageId: message.id,
          error: error.message
        });
      }
    }
  }
  
  /**
   * Process individual message
   */
  async processMessage(message) {
    // Mark as processed
    this.markMessageAsProcessed(message.id);
    
    // Skip bot messages
    if (message.from?.application) {
      return;
    }
    
    // Extract message text
    const messageText = this.extractMessageText(message);
    if (!messageText || messageText.length < 10) {
      return; // Too short
    }
    
    this.logger.debug('Processing message', {
      messageId: message.id,
      from: message.from?.user?.displayName,
      source: message.sourceType,
      textLength: messageText.length
    });
    
    // Run AI task detection
    const analysis = await this.teamsTaskDetector.analyzeForWorkRequest(messageText, {
      sender: message.from?.user?.displayName,
      channel: message.channelName || message.chatTopic,
      timestamp: message.createdDateTime,
      sourceType: message.sourceType
    });
    
    // Check if it's a work request
    if (!analysis.isWorkRequest || analysis.confidence < this.options.confidenceThreshold) {
      this.logger.debug('Not a work request', {
        messageId: message.id,
        confidence: analysis.confidence
      });
      return;
    }
    
    this.logger.info('Work request detected!', {
      messageId: message.id,
      confidence: analysis.confidence,
      title: analysis.taskTitle
    });
    
    // Auto-create task if enabled
    if (this.options.autoCreateTasks && this.userId) {
      await this.createTaskFromMessage(message, analysis);
    } else {
      // Just emit event for manual approval
      this.emit('task:detected', { message, analysis });
    }
  }
  
  /**
   * Create task from detected work request
   */
  async createTaskFromMessage(message, analysis) {
    try {
      // Build task data
      const taskData = {
        title: analysis.taskTitle || 'Task from Teams',
        priority: this.urgencyToPriority(analysis.urgency),
        description: this.extractMessageText(message),
        tags: [analysis.workType, 'teams-auto', message.sourceType],
        source: 'teams',
        source_id: message.id,
        source_context: {
          messageId: message.id,
          teamId: message.teamId,
          teamName: message.teamName,
          channelId: message.channelId,
          channelName: message.channelName,
          chatId: message.chatId,
          chatTopic: message.chatTopic,
          sender: message.from?.user?.displayName,
          senderEmail: message.from?.user?.userPrincipalName,
          createdDateTime: message.createdDateTime,
          webUrl: message.webUrl
        }
      };
      
      // Create task in database
      const result = await this.dbAdapter.createTask(this.userId, taskData);
      
      if (result.success) {
        this.stats.tasksCreated++;
        
        this.logger.info('Task auto-created from Teams', {
          taskId: result.task.id,
          title: taskData.title,
          source: message.sourceType
        });
        
        // Emit event for UI notification
        this.emit('task:created', {
          task: result.task,
          message,
          analysis
        });
      } else {
        this.logger.error('Failed to create task', {
          error: result.error,
          messageId: message.id
        });
      }
      
    } catch (error) {
      this.logger.error('Task creation error', {
        messageId: message.id,
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Extract text from message
   */
  extractMessageText(message) {
    if (message.body?.content) {
      // Strip HTML tags if present
      return message.body.content.replace(/<[^>]*>/g, '').trim();
    }
    return '';
  }
  
  /**
   * Convert urgency to priority
   */
  urgencyToPriority(urgency) {
    const mapping = {
      'critical': 'urgent',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    return mapping[urgency?.toLowerCase()] || 'medium';
  }
  
  /**
   * Check if message has been processed
   */
  isMessageProcessed(messageId) {
    return this.processedMessages.has(messageId);
  }
  
  /**
   * Mark message as processed
   */
  markMessageAsProcessed(messageId) {
    this.processedMessages.add(messageId);
    
    // Limit set size to prevent memory issues
    if (this.processedMessages.size > 10000) {
      const toDelete = Array.from(this.processedMessages).slice(0, 5000);
      toDelete.forEach(id => this.processedMessages.delete(id));
    }
  }
  
  /**
   * Get monitoring stats
   */
  getStats() {
    return {
      ...this.stats,
      isMonitoring: this.isMonitoring,
      userId: this.userId,
      processedMessageCount: this.processedMessages.size
    };
  }
  
  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      messagesProcessed: 0,
      tasksCreated: 0,
      errors: 0,
      lastPoll: null
    };
  }
}

module.exports = TeamsMonitoringService;

