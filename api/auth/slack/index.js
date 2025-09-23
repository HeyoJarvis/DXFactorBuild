// Vercel serverless function for Slack OAuth initiation
const { WebClient } = require('@slack/web-api');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // OAuth configuration
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI || `${req.headers.origin || 'https://beach-baby-vk73.vercel.app'}/api/auth/slack/callback`;
    
    if (!clientId) {
      return res.status(500).json({ error: 'OAuth not configured' });
    }

    // Generate state for security
    const state = req.query.user_id || 'user_' + Math.random().toString(36).substr(2, 9);
    
    // OAuth URL with required scopes
    const scopes = [
      'channels:history',
      'groups:history', 
      'im:history',
      'mpim:history',
      'users:read',
      'channels:read',
      'groups:read',
      'im:read',
      'mpim:read'
    ].join(',');

    const oauthUrl = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${clientId}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;

    // Redirect to Slack OAuth
    res.redirect(302, oauthUrl);

  } catch (error) {
    console.error('OAuth initiation error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate OAuth',
      message: error.message 
    });
  }
};
