/**
 * Comprehensive Message Collector
 * 
 * Uses personal OAuth tokens to collect ALL user messages:
 * - DMs, Group DMs, Private Channels, Public Channels
 * - Real-time streaming and historical data
 */

require('dotenv').config();

const { WebClient } = require('@slack/web-api');
const winston = require('winston');

class MessageCollector {
  constructor(oauthManager, options = {}) {
    this.oauthManager = oauthManager;
    this.options = {
      logLevel: 'info',
      batchSize: 100,
      maxHistory: 1000, // messages per conversation
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
        new winston.transports.File({ filename: 'logs/message-collector.log' })
      ],
      defaultMeta: { service: 'message-collector' }
    });
    
    // Message storage
    this.userMessages = new Map(); // userId -> { conversations: Map(channelId -> messages[]) }
    this.conversationMetadata = new Map(); // channelId -> { type, participants, name, etc }
    
    // Real-time listeners
    this.realtimeConnections = new Map(); // userId -> WebSocket connection
  }

  /**
   * Initialize message collection for a user
   */
  async initializeUserCollection(userId) {
    try {
      const userClient = await this.oauthManager.getUserSlackClient(userId);
      const tokenData = await this.oauthManager.getUserTokenData(userId);
      
      this.logger.info('Initializing message collection', { 
        userId, 
        slackUserId: tokenData.slack_user_id 
      });
      
      // Initialize user storage
      if (!this.userMessages.has(userId)) {
        this.userMessages.set(userId, {
          conversations: new Map(),
          lastSync: new Date(),
          totalMessages: 0
        });
      }
      
      // Collect all conversation types
      await this.collectUserConversations(userId, userClient);
      
      this.logger.info('User collection initialized', { 
        userId,
        totalConversations: this.userMessages.get(userId).conversations.size
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize user collection', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Collect all conversations for a user
   */
  async collectUserConversations(userId, userClient) {
    const conversationTypes = [
      { type: 'public_channel', method: 'conversations.list', types: 'public_channel' },
      { type: 'private_channel', method: 'conversations.list', types: 'private_channel' },
      { type: 'mpim', method: 'conversations.list', types: 'mpim' },
      { type: 'im', method: 'conversations.list', types: 'im' }
    ];
    
    for (const convType of conversationTypes) {
      try {
        await this.collectConversationType(userId, userClient, convType);
      } catch (error) {
        this.logger.error('Failed to collect conversation type', { 
          userId, 
          type: convType.type, 
          error: error.message 
        });
      }
    }
  }

  /**
   * Collect specific conversation type
   */
  async collectConversationType(userId, userClient, convType) {
    let cursor = null;
    let totalConversations = 0;
    
    do {
      const params = {
        types: convType.types,
        limit: 100
      };
      
      if (cursor) {
        params.cursor = cursor;
      }
      
      const result = await userClient.conversations.list(params);
      
      if (!result.ok) {
        throw new Error(`Failed to list ${convType.type}: ${result.error}`);
      }
      
      // Process each conversation
      for (const conversation of result.channels) {
        await this.collectConversationHistory(userId, userClient, conversation, convType.type);
        totalConversations++;
      }
      
      cursor = result.response_metadata?.next_cursor;
      
    } while (cursor);
    
    this.logger.info('Collected conversation type', { 
      userId, 
      type: convType.type, 
      count: totalConversations 
    });
  }

  /**
   * Collect message history for a specific conversation
   */
  async collectConversationHistory(userId, userClient, conversation, conversationType) {
    try {
      const channelId = conversation.id;
      const channelName = conversation.name || 'DM';
      
      // Store conversation metadata
      this.conversationMetadata.set(channelId, {
        id: channelId,
        name: channelName,
        type: conversationType,
        is_private: conversation.is_private || conversationType.includes('private'),
        member_count: conversation.num_members || 0,
        created: conversation.created,
        participants: []
      });
      
      // Collect message history
      const messages = [];
      let cursor = null;
      let messageCount = 0;
      
      do {
        const params = {
          channel: channelId,
          limit: this.options.batchSize
        };
        
        if (cursor) {
          params.cursor = cursor;
        }
        
        const result = await userClient.conversations.history(params);
        
        if (!result.ok) {
          this.logger.warn('Failed to get conversation history', { 
            userId, 
            channelId, 
            error: result.error 
          });
          break;
        }
        
        // Process messages
        for (const message of result.messages) {
          if (message.type === 'message' && message.text) {
            messages.push({
              ts: message.ts,
              user: message.user,
              text: message.text,
              thread_ts: message.thread_ts,
              reply_count: message.reply_count || 0,
              timestamp: new Date(parseFloat(message.ts) * 1000),
              channel_id: channelId,
              channel_name: channelName,
              conversation_type: conversationType
            });
            messageCount++;
          }
        }
        
        cursor = result.response_metadata?.next_cursor;
        
        // Respect rate limits and max history
        if (messageCount >= this.options.maxHistory) {
          break;
        }
        
      } while (cursor);
      
      // Store messages for user
      const userStorage = this.userMessages.get(userId);
      userStorage.conversations.set(channelId, messages);
      userStorage.totalMessages += messageCount;
      
      this.logger.debug('Collected conversation history', { 
        userId, 
        channelId, 
        channelName, 
        messageCount,
        conversationType 
      });
      
    } catch (error) {
      this.logger.error('Failed to collect conversation history', { 
        userId, 
        channelId: conversation.id, 
        error: error.message 
      });
    }
  }

  /**
   * Get all messages for a user
   */
  getUserMessages(userId) {
    const userStorage = this.userMessages.get(userId);
    if (!userStorage) {
      return null;
    }
    
    const allMessages = [];
    
    for (const [channelId, messages] of userStorage.conversations) {
      const metadata = this.conversationMetadata.get(channelId);
      
      for (const message of messages) {
        allMessages.push({
          ...message,
          conversation_metadata: metadata
        });
      }
    }
    
    // Sort by timestamp
    allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return allMessages;
  }

  /**
   * Get messages between two users (DMs and mentions)
   */
  getConversationBetweenUsers(userId1, userId2) {
    const user1Messages = this.getUserMessages(userId1) || [];
    const user2Messages = this.getUserMessages(userId2) || [];
    
    const tokenData1 = this.oauthManager.getUserTokenData(userId1);
    const tokenData2 = this.oauthManager.getUserTokenData(userId2);
    
    if (!tokenData1 || !tokenData2) {
      return [];
    }
    
    const slackUserId1 = tokenData1.slack_user_id;
    const slackUserId2 = tokenData2.slack_user_id;
    
    // Find DMs between users and mentions
    const conversationMessages = [];
    
    // User 1's messages
    user1Messages.forEach(message => {
      // DMs where user2 is involved
      if (message.conversation_type === 'im' && 
          (message.user === slackUserId2 || message.text.includes(`<@${slackUserId2}>`))) {
        conversationMessages.push({
          ...message,
          direction: 'from_user1'
        });
      }
      
      // Channel messages mentioning user2
      if (message.text.includes(`<@${slackUserId2}>`)) {
        conversationMessages.push({
          ...message,
          direction: 'user1_mentions_user2'
        });
      }
    });
    
    // User 2's messages
    user2Messages.forEach(message => {
      // DMs where user1 is involved
      if (message.conversation_type === 'im' && 
          (message.user === slackUserId1 || message.text.includes(`<@${slackUserId1}>`))) {
        conversationMessages.push({
          ...message,
          direction: 'from_user2'
        });
      }
      
      // Channel messages mentioning user1
      if (message.text.includes(`<@${slackUserId1}>`)) {
        conversationMessages.push({
          ...message,
          direction: 'user2_mentions_user1'
        });
      }
    });
    
    // Sort by timestamp and remove duplicates
    const uniqueMessages = conversationMessages.filter((message, index, arr) => 
      arr.findIndex(m => m.ts === message.ts && m.channel_id === message.channel_id) === index
    );
    
    uniqueMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return uniqueMessages;
  }

  /**
   * Search messages by keyword
   */
  searchMessages(userId, keyword, options = {}) {
    const userMessages = this.getUserMessages(userId);
    if (!userMessages) {
      return [];
    }
    
    const searchTerm = keyword.toLowerCase();
    const results = [];
    
    userMessages.forEach(message => {
      if (message.text.toLowerCase().includes(searchTerm)) {
        results.push({
          ...message,
          relevance_score: this.calculateRelevance(message.text, keyword)
        });
      }
    });
    
    // Sort by relevance and timestamp
    results.sort((a, b) => {
      if (a.relevance_score !== b.relevance_score) {
        return b.relevance_score - a.relevance_score;
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    return results.slice(0, options.limit || 50);
  }

  /**
   * Calculate relevance score for search
   */
  calculateRelevance(text, keyword) {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    let score = 0;
    
    // Exact match
    if (lowerText.includes(lowerKeyword)) {
      score += 10;
    }
    
    // Word boundaries
    const words = lowerText.split(/\s+/);
    words.forEach(word => {
      if (word === lowerKeyword) {
        score += 5;
      } else if (word.includes(lowerKeyword)) {
        score += 2;
      }
    });
    
    return score;
  }

  /**
   * Get user statistics
   */
  getUserStats(userId) {
    const userStorage = this.userMessages.get(userId);
    if (!userStorage) {
      return null;
    }
    
    const stats = {
      total_conversations: userStorage.conversations.size,
      total_messages: userStorage.totalMessages,
      last_sync: userStorage.lastSync,
      conversation_breakdown: {}
    };
    
    // Breakdown by conversation type
    for (const [channelId, messages] of userStorage.conversations) {
      const metadata = this.conversationMetadata.get(channelId);
      const type = metadata?.type || 'unknown';
      
      if (!stats.conversation_breakdown[type]) {
        stats.conversation_breakdown[type] = {
          count: 0,
          messages: 0
        };
      }
      
      stats.conversation_breakdown[type].count++;
      stats.conversation_breakdown[type].messages += messages.length;
    }
    
    return stats;
  }

  /**
   * Get system-wide statistics
   */
  getSystemStats() {
    const totalUsers = this.userMessages.size;
    let totalMessages = 0;
    let totalConversations = 0;
    
    for (const [userId, userStorage] of this.userMessages) {
      totalMessages += userStorage.totalMessages;
      totalConversations += userStorage.conversations.size;
    }
    
    return {
      total_users: totalUsers,
      total_messages: totalMessages,
      total_conversations: totalConversations,
      unique_conversation_channels: this.conversationMetadata.size,
      authorized_users: this.oauthManager.getAuthorizedUsers().length
    };
  }

  /**
   * Sync messages for all authorized users
   */
  async syncAllUsers() {
    const authorizedUsers = this.oauthManager.getAuthorizedUsers();
    
    this.logger.info('Starting sync for all users', { userCount: authorizedUsers.length });
    
    for (const user of authorizedUsers) {
      try {
        await this.initializeUserCollection(user.user_id);
      } catch (error) {
        this.logger.error('Failed to sync user', { 
          userId: user.user_id, 
          error: error.message 
        });
      }
    }
    
    this.logger.info('Sync completed for all users');
  }
}

module.exports = MessageCollector;
