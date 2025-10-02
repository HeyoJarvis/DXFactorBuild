/**
 * Slack Service for Electron Main Process
 * Integrates with the working hj2 Slack bot
 */

const { App } = require('@slack/bolt');
const { EventEmitter } = require('events');
const winston = require('winston');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const DesktopSupabaseAdapter = require('./supabase-adapter');

class SlackService extends EventEmitter {
  constructor() {
    super();
    
    this.logger = winston.createLogger({
      level: 'debug', // Changed from 'info' to 'debug' to see message events
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: path.join(__dirname, '../../logs/slack-service.log') })
      ],
      defaultMeta: { service: 'slack-service' }
    });
    
    this.isConnected = false;
    this.recentMessages = [];
    this.app = null;
    this.autoStartEnabled = true; // Enable auto-start by default
    
    // Initialize Supabase adapter
    this.dbAdapter = new DesktopSupabaseAdapter({ logger: this.logger });
    
    this.initialize();
  }
  
  async initialize() {
    try {
      this.logger.info('Initializing Slack service with hj2 bot');
      
      // Check if tokens are available
      if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET || !process.env.SLACK_APP_TOKEN) {
        throw new Error('Missing Slack tokens in environment variables');
      }
      
      // Initialize Slack Bolt app with your working hj2 tokens
      this.app = new App({
        token: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        socketMode: process.env.SLACK_SOCKET_MODE === 'true',
        appToken: process.env.SLACK_APP_TOKEN,
        port: 3002 // Different port from your test
      });
      
      this.setupEventHandlers();
      this.logger.info('Slack service initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Slack service', { error: error.message });
      this.emit('error', error);
    }
  }
  
  setupEventHandlers() {
    // Handle @hj2 mentions
    this.app.event('app_mention', async ({ event }) => {
      try {
        this.logger.info('🎯 BOT MENTIONED!', { 
          user: event.user, 
          channel: event.channel,
          text: event.text.substring(0, 100) 
        });
        
        const message = {
          id: `mention_${Date.now()}`,
          type: 'mention',
          user: event.user,
          channel: event.channel,
          text: event.text,
          timestamp: new Date(event.ts * 1000),
          urgent: event.text.toLowerCase().includes('urgent') || event.text.toLowerCase().includes('asap'),
          raw: event
        };
        
        this.addMessage(message);
        this.emit('mention', message);
        
        this.logger.info('✅ Mention processed and stored');
      } catch (error) {
        this.logger.error('Error handling app mention', { error: error.message, stack: error.stack });
      }
    });
    
    // Handle regular messages in channels where hj2 is present
    this.app.message(async ({ message, context }) => {
      try {
        // Skip bot messages
        if (message.subtype === 'bot_message' || message.bot_id) {
          this.logger.debug('Skipping bot message');
          return;
        }
        
        this.logger.info('💬 MESSAGE RECEIVED!', { 
          user: message.user, 
          channel: message.channel,
          channelType: context.channelType,
          text: message.text?.substring(0, 50) 
        });
        
        const msg = {
          id: `msg_${Date.now()}`,
          type: 'message',
          user: message.user,
          channel: message.channel,
          text: message.text,
          timestamp: new Date(message.ts * 1000),
          channelType: context.channelType,
          raw: message
        };
        
        this.addMessage(msg);
        this.emit('message', msg);
        
        this.logger.info('✅ Message processed and stored');
      } catch (error) {
        this.logger.error('Error handling message', { error: error.message, stack: error.stack });
      }
    });
    
    // Handle connection events
    this.app.error((error) => {
      this.logger.error('Slack app error', { error: error.message });
      this.emit('error', error);
    });
  }
  
  addMessage(message) {
    this.recentMessages.unshift(message);
    
    // Keep only last 100 messages
    if (this.recentMessages.length > 100) {
      this.recentMessages = this.recentMessages.slice(0, 100);
    }
    
    // Save to Supabase asynchronously (don't wait)
    this.dbAdapter.saveSlackMessage(message).catch(error => {
      this.logger.warn('Failed to save message to Supabase', { error: error.message });
    });
  }
  
  async start() {
    try {
      if (this.isConnected) {
        return { success: true, message: 'Slack service already running' };
      }
      
      this.logger.info('Starting Slack service...');
      this.logger.info('Socket Mode enabled:', process.env.SLACK_SOCKET_MODE === 'true');
      this.logger.info('Bot Token present:', !!process.env.SLACK_BOT_TOKEN);
      this.logger.info('App Token present:', !!process.env.SLACK_APP_TOKEN);
      
      await this.app.start();
      this.isConnected = true;
      
      this.logger.info('✅ Slack service started successfully and listening for events');
      this.logger.info('Waiting for messages... Make sure:');
      this.logger.info('  1. Bot is invited to channels (/invite @hj2)');
      this.logger.info('  2. Event subscriptions are configured in Slack App settings');
      this.logger.info('  3. Bot has proper OAuth scopes (channels:history, etc.)');
      
      this.emit('connected');
      
      return { success: true, message: 'Slack monitoring started' };
      
    } catch (error) {
      this.logger.error('Failed to start Slack service', { error: error.message, stack: error.stack });
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }
  
  async stop() {
    try {
      if (!this.isConnected) {
        return { success: true, message: 'Slack service already stopped' };
      }
      
      this.logger.info('Stopping Slack service...');
      if (this.app) {
        await this.app.stop();
      }
      this.isConnected = false;
      
      this.logger.info('Slack service stopped');
      this.emit('disconnected');
      
      return { success: true, message: 'Slack monitoring stopped' };
      
    } catch (error) {
      this.logger.error('Failed to stop Slack service', { error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  getStatus() {
    return {
      connected: this.isConnected,
      messageCount: this.recentMessages.length,
      mentionCount: this.recentMessages.filter(m => m.type === 'mention').length,
      botName: 'Jarvis-Shail',
      lastMessage: this.recentMessages.length > 0 ? this.recentMessages[0].timestamp : null
    };
  }
  
  getRecentMessages(limit = 20) {
    return this.recentMessages.slice(0, limit).map(msg => ({
      ...msg,
      raw: undefined // Don't send raw data to renderer for security
    }));
  }
  
  async sendMessage(channel, text) {
    try {
      if (!this.isConnected) {
        return { success: false, error: 'Slack service not connected' };
      }
      
      const result = await this.app.client.chat.postMessage({
        channel: channel,
        text: text
      });
      
      this.logger.info('Message sent', { channel, text: text.substring(0, 100) });
      return { success: true, result: { ts: result.ts, channel: result.channel } };
      
    } catch (error) {
      this.logger.error('Failed to send message', { channel, text, error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  // Get user info
  async getUserInfo(userId) {
    try {
      if (!this.isConnected) {
        return { success: false, error: 'Slack service not connected' };
      }
      
      const result = await this.app.client.users.info({
        user: userId
      });
      
      return { 
        success: true, 
        user: {
          id: result.user.id,
          name: result.user.name,
          real_name: result.user.real_name,
          display_name: result.user.profile.display_name,
          image: result.user.profile.image_72
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to get user info', { userId, error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  // Get channel info
  async getChannelInfo(channelId) {
    try {
      if (!this.isConnected) {
        return { success: false, error: 'Slack service not connected' };
      }
      
      const result = await this.app.client.conversations.info({
        channel: channelId
      });
      
      return { 
        success: true, 
        channel: {
          id: result.channel.id,
          name: result.channel.name,
          is_private: result.channel.is_private,
          is_im: result.channel.is_im
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to get channel info', { channelId, error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = SlackService;
