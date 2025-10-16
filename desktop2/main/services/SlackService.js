/**
 * Slack Service
 * Handles Slack API communication and data retrieval using Slack Bolt
 */

const { App } = require('@slack/bolt');
const { EventEmitter } = require('events');

class SlackService extends EventEmitter {
  constructor({ logger }) {
    super();
    this.logger = logger;
    this.app = null;
    this.isInitialized = false;
    this.recentMessages = [];
    this.botToken = process.env.SLACK_BOT_TOKEN;
    this.signingSecret = process.env.SLACK_SIGNING_SECRET;
    this.appToken = process.env.SLACK_APP_TOKEN;
    this.socketMode = process.env.SLACK_SOCKET_MODE === 'true';
  }

  /**
   * Initialize the Slack service with Bolt
   */
  async initialize() {
    if (!this.botToken || !this.signingSecret) {
      this.logger.warn('SLACK tokens not set');
      return;
    }

    try {
      // Initialize Slack Bolt app
      this.app = new App({
        token: this.botToken,
        signingSecret: this.signingSecret,
        socketMode: this.socketMode,
        appToken: this.appToken,
        port: 3002
      });

      // Setup event handlers
      this.setupEventHandlers();
      
      // Start the app
      await this.app.start();
      
      this.isInitialized = true;
      this.logger.info('Slack Service initialized with Socket Mode');
    } catch (error) {
      this.logger.error('Slack initialization failed:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Setup Slack event handlers
   */
  setupEventHandlers() {
    // Handle mentions
    this.app.event('app_mention', async ({ event }) => {
      try {
        const message = {
          id: `mention_${Date.now()}`,
          type: 'mention',
          user: event.user,
          channel: event.channel,
          text: event.text,
          timestamp: new Date(event.ts * 1000),
          urgent: event.text.toLowerCase().includes('urgent'),
          raw: event
        };
        
        this.addMessage(message);
        this.emit('mention', message);
        
        // Auto-detect task from mention
        this.detectAndCreateTask(message);
      } catch (error) {
        this.logger.error('Error handling mention:', error);
      }
    });

    // Handle regular messages
    this.app.message(async ({ message }) => {
      try {
        // Skip bot messages
        if (message.subtype === 'bot_message' || message.bot_id) return;

        const msg = {
          id: `msg_${Date.now()}`,
          type: 'message',
          user: message.user,
          channel: message.channel,
          text: message.text,
          timestamp: new Date(message.ts * 1000),
          raw: message
        };
        
        this.addMessage(msg);
        this.emit('message', msg);
        
        // Auto-detect task from message
        this.detectAndCreateTask(msg);
      } catch (error) {
        this.logger.error('Error handling message:', error);
      }
    });

    this.logger.info('Slack event handlers configured');
  }
  
  /**
   * Detect if a message is a task and emit event for auto-creation
   */
  detectAndCreateTask(message) {
    try {
      const text = message.text.toLowerCase();
      
      // Simple task detection keywords
      const taskKeywords = ['task', 'todo', 'can you', 'could you', 'please', 'need to', 'should', 'must', 
                           'follow up', 'reach out', 'schedule', 'meeting', 'call', 'connect'];
      const hasTaskKeyword = taskKeywords.some(keyword => text.includes(keyword));
      
      if (!hasTaskKeyword) {
        return; // Not a task
      }
      
      // Detect calendar/outreach actions
      const calendarKeywords = ['meeting', 'schedule', 'calendar', 'call', 'sync', 'catch up', 'connect with'];
      const outreachKeywords = ['follow up', 'reach out', 'email', 'contact', 'send', 'ping'];
      const isCalendarAction = calendarKeywords.some(keyword => text.includes(keyword));
      const isOutreachAction = outreachKeywords.some(keyword => text.includes(keyword));
      
      // Count mentions to determine routing
      const mentions = this.extractMentions(message.text);
      const mentionCount = mentions.length;
      
      // ROUTING LOGIC:
      // Calendar actions with <4 people OR outreach to <5 people → Mission Control
      // Everything else → Tasks (Sales)
      const shouldRouteToMissionControl = (
        (isCalendarAction && mentionCount < 4) ||
        (isOutreachAction && mentionCount < 5)
      );
      
      // Extract priority from urgency words
      let priority = 'medium';
      if (text.includes('urgent') || text.includes('asap') || text.includes('critical')) {
        priority = 'urgent';
      } else if (text.includes('important') || text.includes('high priority')) {
        priority = 'high';
      } else if (text.includes('low priority') || text.includes('whenever')) {
        priority = 'low';
      }
      
      // Extract task title
      const title = this.extractTaskTitle(message.text);
      
      // Determine work type
      let workType = 'task';
      if (isCalendarAction) workType = 'calendar';
      else if (isOutreachAction) workType = 'outreach';
      
      // Create task data
      const taskData = {
        title,
        priority,
        description: message.text,
        tags: ['slack-auto', message.type, workType],
        assignor: message.user,
        mentionedUsers: mentions,
        workType: workType,
        routeTo: shouldRouteToMissionControl ? 'mission-control' : 'tasks-sales'
      };
      
      // Emit event for task creation (main process will handle it)
      this.emit('task-detected', taskData);
      
      this.logger.info('Task detected from Slack', {
        title,
        priority,
        type: message.type,
        workType,
        mentionCount,
        routeTo: taskData.routeTo
      });
    } catch (error) {
      this.logger.error('Error detecting task:', error);
    }
  }
  
  /**
   * Extract task title from message text
   */
  extractTaskTitle(text) {
    // Remove Slack mentions (<@U123|user> format)
    const cleanText = text.replace(/<@[UW][A-Z0-9]+(\|[^>]+)?>/g, '').trim();
    
    // Remove common prefixes
    const withoutPrefixes = cleanText
      .replace(/^(hey|hi|hello|yo),?\s+/i, '')
      .replace(/^(can you|could you|please)\s+/i, '')
      .trim();
    
    // Take first sentence or first 100 chars
    const firstSentence = withoutPrefixes.split(/[.!?]/)[0].trim();
    return firstSentence.length > 100 
      ? firstSentence.substring(0, 97) + '...' 
      : firstSentence || 'Task from Slack';
  }
  
  /**
   * Extract mentioned users from text
   */
  extractMentions(text) {
    const mentions = [];
    const mentionRegex = /<@([UW][A-Z0-9]+)(\|[^>]+)?>/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }

  /**
   * Add message to recent messages cache
   */
  addMessage(message) {
    this.recentMessages.unshift(message);
    if (this.recentMessages.length > 100) {
      this.recentMessages = this.recentMessages.slice(0, 100);
    }
  }

  /**
   * Get recent messages from cache
   */
  async getRecentMessages(limit = 20) {
    if (!this.isInitialized) {
      this.logger.warn('Slack Service not initialized');
      return [];
    }

    // Return cached messages
    return this.recentMessages.slice(0, limit);
  }

  /**
   * Get user mentions from cache
   */
  async getUserMentions() {
    if (!this.isInitialized) {
      return [];
    }

    return this.recentMessages.filter(msg => msg.type === 'mention');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      connected: this.isInitialized,
      hasToken: !!this.botToken,
      messageCount: this.recentMessages.length
    };
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.app) {
      await this.app.stop();
    }
    this.app = null;
    this.isInitialized = false;
    this.recentMessages = [];
    this.logger.info('Slack Service cleaned up');
  }
}

module.exports = SlackService;

