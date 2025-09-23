/**
 * Vercel Serverless Entry Point for HeyJarvis OAuth System
 */

require('dotenv').config({ path: '../.env' });

const express = require('express');
const SlackOAuthManager = require('../slack-oauth-manager');
const MessageCollector = require('../message-collector');

const app = express();

// Initialize OAuth components
const oauthManager = new SlackOAuthManager();
const messageCollector = new MessageCollector(oauthManager);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>HeyJarvis OAuth</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 40px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: white;
            }
            .container {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
            }
            .button { 
                background: #4A154B; 
                color: white; 
                padding: 15px 30px; 
                text-decoration: none; 
                border-radius: 10px; 
                display: inline-block;
                margin: 20px;
                font-weight: bold;
                transition: all 0.3s ease;
            }
            .button:hover { 
                background: #611f69; 
                transform: translateY(-2px);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 HeyJarvis Slack OAuth</h1>
            <p>Transform your Slack conversations into actionable workflow intelligence</p>
            <a href="/auth/slack" class="button">🔗 Connect Your Slack Account</a>
            <div id="stats"><p>Loading stats...</p></div>
        </div>
        <script>
            fetch('/api/system/stats')
                .then(res => res.json())
                .then(data => {
                    document.getElementById('stats').innerHTML = 
                        '<h3>System Status</h3>' +
                        '<p><strong>' + data.oauth.total_authorized_users + '</strong> users authorized</p>' +
                        '<p><strong>' + (data.messages.total_messages || 0) + '</strong> messages collected</p>';
                })
                .catch(() => {
                    document.getElementById('stats').innerHTML = '<h3>System Status</h3><p>Ready for connections</p>';
                });
        </script>
    </body>
    </html>
  `);
});

// OAuth initiation
app.get('/auth/slack', async (req, res) => {
  try {
    const userId = req.query.user_id || generateUserId();
    const oauthUrl = oauthManager.generateOAuthURL(userId);
    res.redirect(oauthUrl);
  } catch (error) {
    res.status(500).json({ error: 'Failed to initiate OAuth' });
  }
});

// OAuth callback
app.get('/auth/slack/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }
    
    const result = await oauthManager.handleOAuthCallback(code, state);
    await messageCollector.initializeUserCollection(result.user_id);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Success</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: white;">
          <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; text-align: center;">
              <h1>✅ Successfully Connected!</h1>
              <p>Your Slack account has been authorized and we're collecting your workflow data.</p>
              <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0;">
                  <h3>Connected Account</h3>
                  <p><strong>Name:</strong> ${result.real_name}</p>
                  <p><strong>Team:</strong> ${result.team_name}</p>
                  <p><strong>User ID:</strong> ${result.user_id}</p>
              </div>
              <a href="/" style="background: #4A154B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; display: inline-block; margin-top: 20px;">Return Home</a>
          </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); min-height: 100vh; color: white;">
          <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; text-align: center;">
              <h1>❌ OAuth Failed</h1>
              <p>There was an error connecting your Slack account.</p>
              <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; font-family: monospace;">
                  ${error.message}
              </div>
              <a href="/auth/slack" style="background: #c44569; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; display: inline-block; margin-top: 20px;">Try Again</a>
          </div>
      </body>
      </html>
    `);
  }
});

// API endpoints
app.get('/api/users', (req, res) => {
  const users = oauthManager.getAuthorizedUsers();
  res.json({ success: true, users, total: users.length });
});

app.get('/api/system/stats', (req, res) => {
  const oauthStats = oauthManager.getSystemStats();
  const messageStats = messageCollector.getSystemStats();
  
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

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Helper function
function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Export for Vercel
module.exports = app;
