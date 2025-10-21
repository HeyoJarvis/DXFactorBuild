/**
 * Electron OAuth Server
 * 
 * Simple OAuth server that supports multiple providers (Slack, Microsoft, Google, JIRA)
 * and exposes a /auth/status endpoint for the Electron app to poll
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');

class ElectronOAuthServer {
  constructor(port = 8890) {
    this.port = port;
    this.app = express();
    this.currentAuth = null; // Stores the most recent auth data
    this.servers = []; // Store multiple server instances
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for Electron
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', '*');
      res.header('Access-Control-Allow-Methods', '*');
      next();
    });
  }

  setupRoutes() {
    // ===== SLACK OAUTH =====
    this.app.get('/auth/slack', (req, res) => {
      const redirectUri = `http://localhost:${this.port}/auth/slack/callback`;
      const scopes = 'openid,profile,email';
      const state = this.generateState();
      
      const authUrl = `https://slack.com/openid/connect/authorize?` +
        `client_id=${process.env.SLACK_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code` +
        `&state=${state}`;
      
      res.redirect(authUrl);
    });

    this.app.get('/auth/slack/callback', async (req, res) => {
      try {
        const { code, error } = req.query;
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        // Exchange code for token
        const tokenResponse = await axios.post('https://slack.com/api/openid.connect.token', 
          new URLSearchParams({
            client_id: process.env.SLACK_CLIENT_ID,
            client_secret: process.env.SLACK_CLIENT_SECRET,
            code: code,
            redirect_uri: `http://localhost:${this.port}/auth/slack/callback`
          }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          }
        );
        
        if (!tokenResponse.data.ok) {
          throw new Error(tokenResponse.data.error || 'Token exchange failed');
        }
        
        // Get user info
        const userResponse = await axios.get('https://slack.com/api/openid.connect.userInfo', {
          headers: { 'Authorization': `Bearer ${tokenResponse.data.access_token}` }
        });
        
        // Store auth data
        this.currentAuth = {
          authenticated: true,
          provider: 'slack',
          user: {
            email: userResponse.data.email,
            name: userResponse.data.name,
            slack_user_id: userResponse.data.sub,
            slack_team_id: userResponse.data['https://slack.com/team_id'],
            slack_team_name: userResponse.data['https://slack.com/team_name'],
            avatar_url: userResponse.data.picture
          },
          timestamp: new Date().toISOString()
        };
        
        console.log('✅ Slack OAuth successful:', this.currentAuth.user.email);
        
        res.send(this.getSuccessPage('Slack'));
        
      } catch (error) {
        console.error('❌ Slack OAuth failed:', error.message);
        res.send(this.getErrorPage(error.message));
      }
    });

    // ===== MICROSOFT OAUTH =====
    this.app.get('/auth/microsoft', (req, res) => {
      // Use redirect URI from .env or default to current port
      const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${this.port}/auth/microsoft/callback`;
      // 🔥 CRITICAL: Include offline_access to get refresh_token
      const scopes = 'openid profile email offline_access User.Read Mail.ReadWrite Calendars.ReadWrite';
      const state = this.generateState();
      
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${process.env.MICROSOFT_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code` +
        `&state=${state}`;
      
      res.redirect(authUrl);
    });

    this.app.get('/auth/microsoft/callback', async (req, res) => {
      try {
        const { code, error } = req.query;
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        // Use redirect URI from .env or default to current port
        const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${this.port}/auth/microsoft/callback`;
        
        console.log('🔍 Token exchange request:', {
          client_id: process.env.MICROSOFT_CLIENT_ID,
          redirect_uri: redirectUri,
          has_code: !!code
        });
        
        // Exchange code for token (NO client_secret for public clients)
        const tokenParams = {
          client_id: process.env.MICROSOFT_CLIENT_ID,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        };
        
        // Only add client_secret if this is a confidential client
        // Public clients (mobile/desktop apps) don't use secrets
        // If you get "Client is public" error, remove MICROSOFT_CLIENT_SECRET from .env
        if (process.env.MICROSOFT_USE_CLIENT_SECRET === 'true') {
          tokenParams.client_secret = process.env.MICROSOFT_CLIENT_SECRET;
          console.log('📝 Using client_secret (confidential client)');
        } else {
          console.log('📝 Public client - no client_secret');
        }
        
        const tokenResponse = await axios.post(
          'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          new URLSearchParams(tokenParams), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          }
        );
        
        // Get user info from Graph API
        const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${tokenResponse.data.access_token}` }
        });

        // Store auth data WITH TOKENS for persistence
        this.currentAuth = {
          authenticated: true,
          provider: 'microsoft',
          user: {
            email: userResponse.data.userPrincipalName || userResponse.data.mail,
            name: userResponse.data.displayName,
            id: userResponse.data.id,
            microsoft_id: userResponse.data.id,
            avatar_url: `https://graph.microsoft.com/v1.0/users/${userResponse.data.id}/photo/$value`
          },
          // 🔥 CRITICAL FIX: Include tokens so they can be saved to database
          tokens: {
            access_token: tokenResponse.data.access_token,
            refresh_token: tokenResponse.data.refresh_token,
            expires_in: tokenResponse.data.expires_in,
            token_type: tokenResponse.data.token_type,
            scope: tokenResponse.data.scope
          },
          timestamp: new Date().toISOString()
        };

        console.log('✅ Microsoft OAuth successful:', this.currentAuth.user.email);
        console.log('💾 Tokens included for persistence (expires in', tokenResponse.data.expires_in, 'seconds)');
        
        res.send(this.getSuccessPage('Microsoft'));
        
      } catch (error) {
        console.error('❌ Microsoft OAuth failed:', error.message);
        
        // Log detailed error information
        if (error.response) {
          console.error('Error Status:', error.response.status);
          console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        const errorMessage = error.response?.data?.error_description || error.message;
        res.send(this.getErrorPage(errorMessage));
      }
    });

    // ===== GOOGLE OAUTH =====
    this.app.get('/auth/google', (req, res) => {
      // Use redirect URI from .env or default to current port
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${this.port}/auth/google/callback`;
      const scopes = 'openid profile email';
      const state = this.generateState();
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${process.env.GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code` +
        `&state=${state}` +
        `&access_type=offline` +
        `&prompt=consent`;
      
      res.redirect(authUrl);
    });

    this.app.get('/auth/google/callback', async (req, res) => {
      try {
        const { code, error } = req.query;
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        // Use redirect URI from .env or default to current port
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${this.port}/auth/google/callback`;
        
        // Exchange code for token
        const tokenResponse = await axios.post(
          'https://oauth2.googleapis.com/token',
          new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          }
        );
        
        // Get user info
        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokenResponse.data.access_token}` }
        });

        // Store auth data WITH TOKENS for persistence
        this.currentAuth = {
          authenticated: true,
          provider: 'google',
          user: {
            email: userResponse.data.email,
            name: userResponse.data.name,
            id: userResponse.data.id,
            google_id: userResponse.data.id,
            avatar_url: userResponse.data.picture
          },
          // 🔥 CRITICAL FIX: Include tokens so they can be saved to database
          tokens: {
            access_token: tokenResponse.data.access_token,
            refresh_token: tokenResponse.data.refresh_token,
            expires_in: tokenResponse.data.expires_in,
            token_type: tokenResponse.data.token_type,
            scope: tokenResponse.data.scope
          },
          timestamp: new Date().toISOString()
        };

        console.log('✅ Google OAuth successful:', this.currentAuth.user.email);
        console.log('💾 Tokens included for persistence (expires in', tokenResponse.data.expires_in, 'seconds)');
        
        res.send(this.getSuccessPage('Google'));
        
      } catch (error) {
        console.error('❌ Google OAuth failed:', error.message);
        res.send(this.getErrorPage(error.message));
      }
    });

    // ===== STATUS ENDPOINT (for Electron polling) =====
    this.app.get('/auth/status', (req, res) => {
      if (this.currentAuth && this.currentAuth.authenticated) {
        // Return the auth data and clear it (single use)
        const auth = { ...this.currentAuth };
        this.currentAuth = null;
        res.json(auth);
      } else {
        res.json({ authenticated: false });
      }
    });

    // ===== HEALTH CHECK =====
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', port: this.port });
    });
  }

  generateState() {
    return Math.random().toString(36).substring(2, 15);
  }

  getSuccessPage(provider) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Successful</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { background: white; padding: 48px; border-radius: 16px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; }
        h1 { color: #171717; margin: 0 0 16px 0; font-size: 24px; }
        p { color: #737373; margin: 0; font-size: 16px; }
        .icon { font-size: 48px; margin-bottom: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">✅</div>
        <h1>${provider} Authentication Successful!</h1>
        <p>You can close this window and return to HeyJarvis.</p>
      </div>
      <script>setTimeout(() => window.close(), 300);</script>
    </body>
    </html>
    `;
  }

  getErrorPage(error) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Error</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { background: white; padding: 48px; border-radius: 16px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; }
        h1 { color: #dc2626; margin: 0 0 16px 0; font-size: 24px; }
        p { color: #737373; margin: 0; font-size: 14px; }
        .icon { font-size: 48px; margin-bottom: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h1>Authentication Failed</h1>
        <p>${error}</p>
      </div>
    </body>
    </html>
    `;
  }

  start() {
    return new Promise((resolve) => {
      // Start primary server on main port
      const mainServer = this.app.listen(this.port, () => {
        console.log(`\n🔐 OAuth Server running on port ${this.port}`);
        this.servers.push(mainServer);
        
        // Also start on port 8889 if Microsoft redirect URI uses it
        if (process.env.MICROSOFT_REDIRECT_URI && process.env.MICROSOFT_REDIRECT_URI.includes(':8889')) {
          const microsoftServer = this.app.listen(8889, () => {
            console.log(`🔐 Also listening on port 8889 for Microsoft callbacks`);
            this.servers.push(microsoftServer);
          });
        }
        
        console.log(`\n📍 OAuth URLs:`);
        console.log(`   Slack:     http://localhost:${this.port}/auth/slack`);
        console.log(`   Microsoft: http://localhost:${this.port}/auth/microsoft`);
        console.log(`   Google:    http://localhost:${this.port}/auth/google`);
        console.log(`   Status:    http://localhost:${this.port}/auth/status`);
        
        resolve();
      });
    });
  }

  stop() {
    this.servers.forEach(server => {
      if (server) {
        server.close();
      }
    });
    console.log('🛑 OAuth server stopped');
  }
}

// Run if executed directly
if (require.main === module) {
  const server = new ElectronOAuthServer(8890);
  server.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    server.stop();
    process.exit(0);
  });
}

module.exports = ElectronOAuthServer;

