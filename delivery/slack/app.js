/**
 * HeyJarvis Slack Bot - Main application entry point
 * 
 * Features:
 * 1. Signal delivery with rich interactive blocks
 * 2. Feedback collection and learning
 * 3. User commands and controls
 * 4. Team collaboration features
 * 5. Real-time notifications
 */

const { App } = require('@slack/bolt');
const winston = require('winston');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const AlertCard = require('./blocks/alert-card');
const DigestCard = require('./blocks/digest');
const FeedbackHandler = require('./blocks/feedback');
const CommandHandlers = require('./commands');
const WorkflowHandlers = require('./workflows');

class HeyJarvisSlackApp {
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
        new winston.transports.File({ filename: 'logs/slack-app.log' })
      ],
      defaultMeta: { service: 'slack-app' }
    });
    
    // Initialize Slack Bolt app
    this.slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: process.env.SLACK_SOCKET_MODE === 'true',
      appToken: process.env.SLACK_APP_TOKEN,
      port: this.options.port,
      logger: {
        debug: (...msgs) => this.logger.debug(msgs.join(' ')),
        info: (...msgs) => this.logger.info(msgs.join(' ')),
        warn: (...msgs) => this.logger.warn(msgs.join(' ')),
        error: (...msgs) => this.logger.error(msgs.join(' '))
      }
    });
    
    // Initialize Express app for webhooks and health checks
    this.expressApp = express();
    this.expressApp.use(cors());
    this.expressApp.use(bodyParser.json());
    
    // Initialize handlers
    this.alertCard = new AlertCard();
    this.digestCard = new DigestCard();
    this.feedbackHandler = new FeedbackHandler();
    this.commandHandlers = new CommandHandlers();
    this.workflowHandlers = new WorkflowHandlers();
    
    // Setup event handlers
    this.setupEventHandlers();
    this.setupCommands();
    this.setupInteractions();
    this.setupWebhooks();
  }
  
  /**
   * Setup Slack event handlers
   */
  setupEventHandlers() {
    // App home opened - show dashboard
    this.slackApp.event('app_home_opened', async ({ event, client }) => {
      try {
        await this.showAppHome(client, event.user);
      } catch (error) {
        this.logger.error('Error showing app home', { error: error.message, user: event.user });
      }
    });
    
    // App mention - respond with help
    this.slackApp.event('app_mention', async ({ event, client, say }) => {
      try {
        const helpMessage = this.commandHandlers.getHelpMessage();
        await say({
          text: helpMessage.text,
          blocks: helpMessage.blocks,
          thread_ts: event.ts
        });
      } catch (error) {
        this.logger.error('Error handling app mention', { error: error.message });
      }
    });
    
    // Team join - welcome new user
    this.slackApp.event('team_join', async ({ event, client }) => {
      try {
        await this.welcomeNewUser(client, event.user);
      } catch (error) {
        this.logger.error('Error welcoming new user', { error: error.message, user: event.user.id });
      }
    });
  }
  
  /**
   * Setup slash commands
   */
  setupCommands() {
    // Main jarvis command
    this.slackApp.command('/jarvis', async ({ command, ack, respond, client }) => {
      await ack();
      
      try {
        const response = await this.commandHandlers.handleCommand(command, client);
        await respond(response);
      } catch (error) {
        this.logger.error('Error handling /jarvis command', {
          error: error.message,
          command: command.text,
          user: command.user_id
        });
        
        await respond({
          text: '❌ Sorry, I encountered an error processing your command. Please try again.',
          response_type: 'ephemeral'
        });
      }
    });
    
    // Pause notifications
    this.slackApp.command('/jarvis-pause', async ({ command, ack, respond }) => {
      await ack();
      
      try {
        const response = await this.commandHandlers.handlePause(command);
        await respond(response);
      } catch (error) {
        this.logger.error('Error handling pause command', { error: error.message });
        await respond({
          text: '❌ Failed to pause notifications',
          response_type: 'ephemeral'
        });
      }
    });
    
    // Status check
    this.slackApp.command('/jarvis-status', async ({ command, ack, respond }) => {
      await ack();
      
      try {
        const response = await this.commandHandlers.handleStatus(command);
        await respond(response);
      } catch (error) {
        this.logger.error('Error handling status command', { error: error.message });
        await respond({
          text: '❌ Failed to get status',
          response_type: 'ephemeral'
        });
      }
    });
  }
  
  /**
   * Setup interactive components (buttons, modals, etc.)
   */
  setupInteractions() {
    // Feedback buttons (thumbs up/down)
    this.slackApp.action('signal_feedback', async ({ ack, body, client }) => {
      await ack();
      
      try {
        await this.feedbackHandler.handleFeedback(body, client);
      } catch (error) {
        this.logger.error('Error handling feedback', { error: error.message });
      }
    });
    
    // Signal action buttons
    this.slackApp.action(/signal_action_(.+)/, async ({ ack, body, action, client }) => {
      await ack();
      
      try {
        const actionType = action.action_id.replace('signal_action_', '');
        await this.workflowHandlers.handleSignalAction(actionType, body, client);
      } catch (error) {
        this.logger.error('Error handling signal action', { 
          error: error.message, 
          action: action.action_id 
        });
      }
    });
    
    // Settings modal
    this.slackApp.view('settings_modal', async ({ ack, body, view, client }) => {
      await ack();
      
      try {
        await this.commandHandlers.handleSettingsSubmission(body, view, client);
      } catch (error) {
        this.logger.error('Error handling settings submission', { error: error.message });
      }
    });
    
    // Snooze modal
    this.slackApp.view('snooze_modal', async ({ ack, body, view, client }) => {
      await ack();
      
      try {
        await this.workflowHandlers.handleSnoozeSubmission(body, view, client);
      } catch (error) {
        this.logger.error('Error handling snooze submission', { error: error.message });
      }
    });
  }
  
  /**
   * Setup webhook endpoints
   */
  setupWebhooks() {
    // Health check endpoint
    this.expressApp.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'heyjarvis-slack',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
    
    // Signal delivery webhook
    this.expressApp.post('/webhook/deliver-signal', async (req, res) => {
      try {
        const { signal, users, options = {} } = req.body;
        
        if (!signal || !users) {
          return res.status(400).json({ error: 'Missing signal or users' });
        }
        
        const results = await this.deliverSignalToUsers(signal, users, options);
        
        res.json({
          success: true,
          delivered_count: results.success_count,
          failed_count: results.failed_count,
          results: results.details
        });
        
      } catch (error) {
        this.logger.error('Error in signal delivery webhook', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Batch signal delivery
    this.expressApp.post('/webhook/deliver-batch', async (req, res) => {
      try {
        const { signals, user_id, options = {} } = req.body;
        
        if (!signals || !user_id) {
          return res.status(400).json({ error: 'Missing signals or user_id' });
        }
        
        const digestBlocks = this.digestCard.createDigest(signals, options);
        const result = await this.deliverDigest(user_id, digestBlocks, options);
        
        res.json({
          success: true,
          message_ts: result.ts,
          channel: result.channel
        });
        
      } catch (error) {
        this.logger.error('Error in batch delivery webhook', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }
  
  /**
   * Deliver a signal to multiple users
   */
  async deliverSignalToUsers(signal, users, options = {}) {
    const results = {
      success_count: 0,
      failed_count: 0,
      details: []
    };
    
    for (const user of users) {
      try {
        // Create alert card for the signal
        const blocks = this.alertCard.createAlertCard(signal, user, options);
        
        // Determine delivery channel (DM or specific channel)
        const channel = options.channel || user.slack_user_id;
        
        // Send message
        const result = await this.slackApp.client.chat.postMessage({
          channel,
          text: `🚨 ${signal.title}`,
          blocks,
          unfurl_links: false,
          unfurl_media: false
        });
        
        results.success_count++;
        results.details.push({
          user_id: user.id,
          slack_user_id: user.slack_user_id,
          success: true,
          message_ts: result.ts,
          channel: result.channel
        });
        
        this.logger.info('Signal delivered successfully', {
          signal_id: signal.id,
          user_id: user.id,
          channel: result.channel
        });
        
      } catch (error) {
        results.failed_count++;
        results.details.push({
          user_id: user.id,
          slack_user_id: user.slack_user_id,
          success: false,
          error: error.message
        });
        
        this.logger.error('Failed to deliver signal', {
          signal_id: signal.id,
          user_id: user.id,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Deliver digest to user
   */
  async deliverDigest(userId, digestBlocks, options = {}) {
    // In production, would look up user's Slack ID from database
    const slackUserId = options.slack_user_id || userId;
    
    return await this.slackApp.client.chat.postMessage({
      channel: slackUserId,
      text: '📊 Your HeyJarvis Daily Digest',
      blocks: digestBlocks,
      unfurl_links: false,
      unfurl_media: false
    });
  }
  
  /**
   * Show app home dashboard
   */
  async showAppHome(client, userId) {
    const homeBlocks = await this.createHomeView(userId);
    
    await client.views.publish({
      user_id: userId,
      view: {
        type: 'home',
        blocks: homeBlocks
      }
    });
  }
  
  /**
   * Create home view blocks
   */
  async createHomeView(userId) {
    // In production, would fetch real user data and stats
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Welcome to HeyJarvis! 🤖*\n\nYour AI-powered competitive intelligence assistant.'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*Signals Today:*\n12 new signals'
          },
          {
            type: 'mrkdwn',
            text: '*Actions Taken:*\n3 this week'
          },
          {
            type: 'mrkdwn',
            text: '*Time Saved:*\n~2.5 hours'
          },
          {
            type: 'mrkdwn',
            text: '*Relevance Score:*\n85% accurate'
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⚙️ Settings'
            },
            action_id: 'open_settings',
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📊 Dashboard'
            },
            action_id: 'open_dashboard',
            url: `${process.env.DASHBOARD_URL}/dashboard`
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '❓ Help'
            },
            action_id: 'show_help'
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Quick Commands:*\n• `/jarvis status` - Check your signal status\n• `/jarvis pause 2h` - Pause notifications\n• `/jarvis settings` - Update preferences\n• `/jarvis help` - Get help'
        }
      }
    ];
  }
  
  /**
   * Welcome new user
   */
  async welcomeNewUser(client, user) {
    const welcomeBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `👋 Welcome to HeyJarvis, <@${user.id}>!\n\nI'm your AI-powered competitive intelligence assistant. I'll help you stay on top of what's happening in your competitive landscape.`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Getting Started:*\n1. Set up your preferences with `/jarvis settings`\n2. Add your competitors and focus areas\n3. Start receiving personalized signals!\n\nI learn from your feedback to get better over time. 🎯'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🚀 Get Started'
            },
            action_id: 'onboarding_start',
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📖 Learn More'
            },
            action_id: 'show_onboarding_help'
          }
        ]
      }
    ];
    
    await client.chat.postMessage({
      channel: user.id,
      text: 'Welcome to HeyJarvis!',
      blocks: welcomeBlocks
    });
  }
  
  /**
   * Start the application
   */
  async start() {
    try {
      // Start Slack app
      await this.slackApp.start();
      
      // Start Express server for webhooks
      this.expressApp.listen(this.options.port + 1, () => {
        this.logger.info('Webhook server started', { 
          port: this.options.port + 1 
        });
      });
      
      this.logger.info('HeyJarvis Slack app started successfully', {
        port: this.options.port,
        webhook_port: this.options.port + 1
      });
      
    } catch (error) {
      this.logger.error('Failed to start HeyJarvis Slack app', { error: error.message });
      process.exit(1);
    }
  }
  
  /**
   * Stop the application
   */
  async stop() {
    try {
      await this.slackApp.stop();
      this.logger.info('HeyJarvis Slack app stopped');
    } catch (error) {
      this.logger.error('Error stopping Slack app', { error: error.message });
    }
  }
}

// Start the app if this file is run directly
if (require.main === module) {
  const app = new HeyJarvisSlackApp();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await app.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await app.stop();
    process.exit(0);
  });
  
  app.start();
}

module.exports = HeyJarvisSlackApp;
