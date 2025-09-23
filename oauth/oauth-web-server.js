/**
 * OAuth Web Server
 * 
 * Handles OAuth flow, user consent, and token management
 * Production-ready web interface for Slack OAuth
 */

require('dotenv').config({ path: '../.env' });

const express = require('express');
const path = require('path');
const winston = require('winston');
const SlackOAuthManager = require('./slack-oauth-manager');
const MessageCollector = require('./message-collector');

class OAuthWebServer {
  constructor(options = {}) {
    this.options = {
      port: process.env.OAUTH_PORT || 3001,
      logLevel: 'info',
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
        new winston.transports.File({ filename: 'logs/oauth-server.log' })
      ],
      defaultMeta: { service: 'oauth-server' }
    });
    
    // Initialize OAuth manager and message collector
    this.oauthManager = new SlackOAuthManager();
    this.messageCollector = new MessageCollector(this.oauthManager);
    
    // Initialize Express app
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Home page
    this.app.get('/', (req, res) => {
      res.send(this.getHomePage());
    });
    
    // Initiate OAuth
    this.app.get('/auth/slack', async (req, res) => {
      try {
        const userId = req.query.user_id || this.generateUserId();
        const oauthUrl = this.oauthManager.generateOAuthURL(userId);
        res.redirect(oauthUrl);
      } catch (error) {
        res.status(500).json({ error: 'Failed to initiate OAuth' });
      }
    });
    
    // OAuth callback
    this.app.get('/auth/slack/callback', async (req, res) => {
      try {
        const { code, state, error } = req.query;
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        const result = await this.oauthManager.handleOAuthCallback(code, state);
        await this.messageCollector.initializeUserCollection(result.user_id);
        
        res.send(this.getSuccessPage(result));
        
      } catch (error) {
        res.send(this.getErrorPage(error.message));
      }
    });
    
    // API endpoints
    this.app.get('/api/users', (req, res) => {
      const users = this.oauthManager.getAuthorizedUsers();
      res.json({ success: true, users, total: users.length });
    });
    
    this.app.get('/api/system/stats', (req, res) => {
      const oauthStats = this.oauthManager.getSystemStats();
      const messageStats = this.messageCollector.getSystemStats();
      
      res.json({
        success: true,
        oauth: oauthStats,
        messages: messageStats,
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      });
    });
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });
  }

  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  getHomePage() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>HeyJarvis OAuth</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
            .button { background: #4A154B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; }
        </style>
    </head>
    <body>
        <h1>🤖 HeyJarvis Slack Integration</h1>
        <p>Connect your Slack account to enable workflow intelligence.</p>
        <a href="/auth/slack" class="button">Connect Slack Account</a>
        <div id="stats"><p>Loading stats...</p></div>
        <script>
            fetch('/api/system/stats')
                .then(res => res.json())
                .then(data => {
                    document.getElementById('stats').innerHTML = 
                        '<h3>System Status</h3>' +
                        '<p>Authorized Users: ' + data.oauth.total_authorized_users + '</p>' +
                        '<p>Messages Collected: ' + (data.messages.total_messages || 0) + '</p>';
                });
        </script>
    </body>
    </html>`;
  }

  getSuccessPage(result) {
    return `
    <!DOCTYPE html>
    <html>
    <head><title>OAuth Success</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
        <h1>✅ Successfully Connected!</h1>
        <p>Your Slack account has been authorized.</p>
        <div style="background: #f0f0f0; padding: 20px; border-radius: 5px;">
            <h3>Connected Account</h3>
            <p><strong>Name:</strong> ${result.real_name}</p>
            <p><strong>Team:</strong> ${result.team_name}</p>
            <p><strong>User ID:</strong> ${result.user_id}</p>
        </div>
        <a href="/" style="display: inline-block; margin-top: 20px; background: #4A154B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Return Home</a>
    </body>
    </html>`;
  }

  getErrorPage(errorMessage) {
    return `
    <!DOCTYPE html>
    <html>
    <head><title>OAuth Error</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
        <h1>❌ OAuth Failed</h1>
        <p>There was an error connecting your Slack account.</p>
        <div style="background: #ffe6e6; padding: 20px; border-radius: 5px; font-family: monospace;">
            ${errorMessage}
        </div>
        <a href="/auth/slack" style="display: inline-block; margin-top: 20px; background: #c44569; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Try Again</a>
    </body>
    </html>`;
  }

  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.options.port, () => {
        console.log(`🌐 OAuth Server: http://localhost:${this.options.port}`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = OAuthWebServer;
