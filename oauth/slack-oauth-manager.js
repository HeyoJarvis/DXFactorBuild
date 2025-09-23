/**
 * Production Slack OAuth Manager
 * 
 * Handles user OAuth flow, token storage, and personal token usage
 * for comprehensive Slack data access (DMs, channels, everything)
 */

require('dotenv').config();

const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');
const winston = require('winston');

class SlackOAuthManager {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      encryptionKey: process.env.ENCRYPTION_KEY || this.generateEncryptionKey(),
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
        new winston.transports.File({ filename: 'logs/oauth-manager.log' })
      ],
      defaultMeta: { service: 'oauth-manager' }
    });
    
    // In-memory token storage (in production, use encrypted database)
    this.userTokens = new Map(); // userId -> encrypted token data
    this.activeUsers = new Map(); // userId -> user info
    
    // Slack clients
    this.appClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  /**
   * Generate encryption key if not provided
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.options.encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.options.encryptionKey, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Step 1: Generate OAuth URL for user
   */
  generateOAuthURL(userId, redirectUri = null) {
    const baseRedirectUri = redirectUri || process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/auth/slack/callback';
    
    const scopes = [
      // User scopes (what we need for personal data access)
      'channels:history',    // Read public channel messages
      'groups:history',      // Read private channel messages  
      'im:history',          // Read DM messages
      'mpim:history',        // Read group DM messages
      'users:read',          // Read user information
      'channels:read',       // List channels
      'groups:read',         // List private channels
      'im:read',             // List DMs
      'mpim:read'            // List group DMs
    ].join(',');
    
    const authUrl = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${process.env.SLACK_CLIENT_ID}&` +
      `scope=&` +  // No bot scopes needed
      `user_scope=${scopes}&` +
      `redirect_uri=${encodeURIComponent(baseRedirectUri)}&` +
      `state=${userId}&` +
      `response_type=code`;
    
    this.logger.info('Generated OAuth URL', { 
      userId, 
      scopes: scopes.split(','),
      redirectUri: baseRedirectUri 
    });
    
    return authUrl;
  }

  /**
   * Step 2: Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(code, state) {
    const userId = state;
    
    try {
      this.logger.info('Processing OAuth callback', { userId, code: code.substring(0, 10) + '...' });
      
      // Exchange code for tokens
      const result = await this.appClient.oauth.v2.access({
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/auth/slack/callback'
      });
      
      if (!result.ok) {
        throw new Error(`OAuth exchange failed: ${result.error}`);
      }
      
      // Extract user token and info
      const userToken = result.authed_user.access_token;
      const slackUserId = result.authed_user.id;
      const teamId = result.team.id;
      const teamName = result.team.name;
      const scopes = result.authed_user.scope.split(',');
      
      // Get user info with the new token
      const userClient = new WebClient(userToken);
      const userInfo = await userClient.users.info({ user: slackUserId });
      
      // Store encrypted token and user data
      const tokenData = {
        access_token: userToken,
        slack_user_id: slackUserId,
        team_id: teamId,
        team_name: teamName,
        scopes: scopes,
        real_name: userInfo.user.real_name,
        email: userInfo.user.profile.email,
        avatar: userInfo.user.profile.image_192,
        authorized_at: new Date().toISOString()
      };
      
      // Encrypt and store
      const encryptedTokenData = this.encrypt(JSON.stringify(tokenData));
      this.userTokens.set(userId, encryptedTokenData);
      
      // Store user info for quick access
      this.activeUsers.set(userId, {
        slack_user_id: slackUserId,
        real_name: userInfo.user.real_name,
        email: userInfo.user.profile.email,
        team_name: teamName,
        authorized: true,
        scopes: scopes
      });
      
      this.logger.info('OAuth successful', { 
        userId, 
        slackUserId, 
        teamName, 
        scopes: scopes.length,
        realName: userInfo.user.real_name 
      });
      
      return {
        success: true,
        user_id: userId,
        slack_user_id: slackUserId,
        team_name: teamName,
        real_name: userInfo.user.real_name,
        scopes: scopes
      };
      
    } catch (error) {
      this.logger.error('OAuth callback failed', { 
        userId, 
        error: error.message 
      });
      
      throw new Error(`OAuth failed: ${error.message}`);
    }
  }

  /**
   * Step 3: Get user's personal Slack client
   */
  async getUserSlackClient(userId) {
    const encryptedTokenData = this.userTokens.get(userId);
    
    if (!encryptedTokenData) {
      throw new Error(`No OAuth token found for user ${userId}`);
    }
    
    try {
      const tokenData = JSON.parse(this.decrypt(encryptedTokenData));
      return new WebClient(tokenData.access_token);
    } catch (error) {
      this.logger.error('Failed to decrypt user token', { userId, error: error.message });
      throw new Error('Failed to access user token');
    }
  }

  /**
   * Get user's token data
   */
  async getUserTokenData(userId) {
    const encryptedTokenData = this.userTokens.get(userId);
    
    if (!encryptedTokenData) {
      return null;
    }
    
    try {
      return JSON.parse(this.decrypt(encryptedTokenData));
    } catch (error) {
      this.logger.error('Failed to decrypt user token data', { userId });
      return null;
    }
  }

  /**
   * Check if user has authorized OAuth
   */
  isUserAuthorized(userId) {
    return this.userTokens.has(userId);
  }

  /**
   * Get all authorized users
   */
  getAuthorizedUsers() {
    return Array.from(this.activeUsers.entries()).map(([userId, userData]) => ({
      user_id: userId,
      ...userData
    }));
  }

  /**
   * Revoke user's OAuth access
   */
  async revokeUserAccess(userId) {
    try {
      const tokenData = await this.getUserTokenData(userId);
      
      if (tokenData) {
        // Revoke the token with Slack
        const userClient = new WebClient(tokenData.access_token);
        await userClient.auth.revoke();
      }
      
      // Remove from our storage
      this.userTokens.delete(userId);
      this.activeUsers.delete(userId);
      
      this.logger.info('User access revoked', { userId });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to revoke user access', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Test user's token and permissions
   */
  async testUserToken(userId) {
    try {
      const userClient = await this.getUserSlackClient(userId);
      const authTest = await userClient.auth.test();
      
      this.logger.info('User token test successful', { 
        userId, 
        slackUserId: authTest.user_id,
        team: authTest.team 
      });
      
      return {
        valid: true,
        slack_user_id: authTest.user_id,
        team: authTest.team,
        user: authTest.user
      };
    } catch (error) {
      this.logger.error('User token test failed', { userId, error: error.message });
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get comprehensive user statistics
   */
  getSystemStats() {
    return {
      total_authorized_users: this.userTokens.size,
      active_users: this.activeUsers.size,
      encryption_enabled: !!this.options.encryptionKey,
      authorized_users: this.getAuthorizedUsers()
    };
  }
}

module.exports = SlackOAuthManager;
