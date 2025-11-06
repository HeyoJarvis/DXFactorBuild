/**
 * Slack Service
 * Handles Slack API communication and data retrieval using Slack Bolt
 */

const { App } = require('@slack/bolt');
const { EventEmitter } = require('events');

class SlackService extends EventEmitter {
  constructor({ logger, supabaseAdapter }) {
    super();
    this.logger = logger;
    this.supabaseAdapter = supabaseAdapter;
    this.app = null;
    this.isInitialized = false;
    this.recentMessages = [];
    this.userCache = new Map(); // Cache for Slack user info
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
        // Fetch user info to get real name
        const userInfo = await this.getUserInfo(event.user);

        const message = {
          id: `mention_${Date.now()}`,
          type: 'mention',
          user: event.user,
          user_name: userInfo?.name || event.user,
          user_real_name: userInfo?.real_name || null,
          user_display_name: userInfo?.display_name || null,
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
        if (message.subtype === 'bot_message' || message.bot_id) {
          this.logger.debug('Skipping bot message');
          return;
        }

        // Fetch user info to get real name
        const userInfo = await this.getUserInfo(message.user);

        const msg = {
          id: `msg_${Date.now()}`,
          type: 'message',
          user: message.user,
          user_name: userInfo?.name || message.user,
          user_real_name: userInfo?.real_name || null,
          user_display_name: userInfo?.display_name || null,
          channel: message.channel,
          text: message.text,
          timestamp: new Date(message.ts * 1000),
          raw: message
        };

        this.logger.info('📨 Slack message received', {
          user: msg.user,
          real_name: msg.user_real_name,
          channel: msg.channel,
          text: msg.text?.substring(0, 50),
          cacheSize: this.recentMessages.length
        });

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
      const originalText = message.text; // Keep original case for mention extraction
      
      // Extract mentions to verify task assignment
      const mentions = this.extractMentions(originalText);
      
      // Must have at least one mention to be a task assignment
      if (mentions.length === 0) {
        return; // No one to assign to
      }
      
      // Check for polite request keywords (original logic)
      const politeKeywords = ['task', 'todo', 'can you', 'could you', 'please', 'need to', 
                              'should', 'must', 'need you to', 'want you to'];
      const hasPoliteKeyword = politeKeywords.some(keyword => text.includes(keyword));
      
      // Check for imperative action verbs (NEW - matches workflow-analyzer.js)
      const imperativeVerbs = ['schedule', 'set up', 'setup', 'create', 'send', 'draft', 'write',
                               'call', 'email', 'contact', 'reach out', 'review', 'analyze',
                               'check', 'update', 'complete', 'prepare', 'organize', 'coordinate',
                               'arrange', 'follow up', 'followup', 'respond', 'reply', 'book',
                               'reserve', 'confirm', 'finalize', 'meeting', 'connect', 'get started',
                               'start', 'begin', 'work on', 'build', 'implement', 'fix', 'debug'];
      const hasImperativeVerb = imperativeVerbs.some(verb => {
        // Check if message starts with verb (after removing mention)
        const textWithoutMention = text.replace(/<@[uw]\w+(\|\w+)?>/gi, '').trim();
        return textWithoutMention.startsWith(verb);
      });
      
      // Check if mention is immediately followed by imperative verb
      // Pattern: @user schedule, @user send, etc.
      const mentionImperativePattern = /<@[uw]\w+(?:\|\w+)?>\s+(schedule|set up|setup|create|send|draft|write|call|email|contact|reach out|review|analyze|check|update|complete|prepare|organize|coordinate|arrange|follow up|followup|respond|reply|book|reserve|confirm|finalize|meeting|get started|start|begin|work on|build|implement|fix|debug)/i;
      const hasMentionWithImperative = mentionImperativePattern.test(originalText);
      
      // Task detection: polite keywords OR imperative verbs OR mention+imperative
      const isTask = hasPoliteKeyword || hasImperativeVerb || hasMentionWithImperative;
      
      if (!isTask) {
        return; // Not a task
      }
      
      this.logger.info('Task detected in Slack message', {
        hasPoliteKeyword,
        hasImperativeVerb,
        hasMentionWithImperative,
        mentionCount: mentions.length,
        text: text.substring(0, 100)
      });
      
      // Detect calendar/outreach actions
      const calendarKeywords = ['meeting', 'schedule', 'calendar', 'call', 'sync', 'catch up', 'connect with'];
      const outreachKeywords = ['follow up', 'reach out', 'email', 'contact', 'send', 'ping'];
      const isCalendarAction = calendarKeywords.some(keyword => text.includes(keyword));
      const isOutreachAction = outreachKeywords.some(keyword => text.includes(keyword));
      
      // Use mention count from earlier extraction
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
      
      // Create task data with Slack metadata
      const messageId = message.raw?.ts || message.timestamp?.getTime?.() || Date.now();
      const channelId = message.channel;

      const taskData = {
        title,
        priority,
        description: message.text,
        tags: ['slack-auto', message.type, workType],
        assignor: message.user, // Who assigned the task (message sender)
        assignee: mentions[0] || null, // Who the task is assigned to (first mentioned user)
        mentionedUsers: mentions, // All mentioned users
        workType: workType,
        routeTo: shouldRouteToMissionControl ? 'mission-control' : 'tasks-sales',
        externalSource: 'slack',
        externalId: `slack_${channelId}_${messageId}`,
        externalKey: messageId,
        externalUrl: channelId ? `slack://channel?team=&id=${channelId}` : null
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
   * Get Slack user info (with caching)
   */
  async getUserInfo(userId) {
    if (!this.isInitialized || !this.app) {
      return null;
    }

    // Check cache first
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId);
    }

    try {
      const result = await this.app.client.users.info({
        token: this.botToken,
        user: userId
      });

      if (result.ok && result.user) {
        const userInfo = {
          id: result.user.id,
          name: result.user.name,
          real_name: result.user.real_name,
          display_name: result.user.profile?.display_name || result.user.real_name,
          email: result.user.profile?.email,
          image: result.user.profile?.image_72
        };

        // Cache it
        this.userCache.set(userId, userInfo);

        this.logger.debug('Fetched Slack user info', {
          userId,
          name: userInfo.real_name
        });

        return userInfo;
      }
    } catch (error) {
      this.logger.error('Failed to fetch Slack user info', {
        userId,
        error: error.message
      });
    }

    return null;
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
   * Get recent messages from cache (or load from database if cache is empty)
   */
  async getRecentMessages(limit = 20) {
    if (!this.isInitialized) {
      this.logger.warn('Slack Service not initialized');
      return [];
    }

    // If cache is empty, try to load from Supabase
    if (this.recentMessages.length === 0 && this.supabaseAdapter) {
      try {
        this.logger.info('Cache empty, loading recent Slack messages from database...');
        const result = await this.supabaseAdapter.getRecentSlackMessages(limit);
        
        if (result.success && result.messages) {
          this.logger.info(`Loaded ${result.messages.length} messages from database`);
          // Add to cache
          this.recentMessages = result.messages;
        }
      } catch (error) {
        this.logger.error('Failed to load messages from database', { error: error.message });
      }
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

