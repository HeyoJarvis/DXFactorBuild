// Vercel serverless function for Slack OAuth callback
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

    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send(getErrorPage(`OAuth error: ${error}`));
    }

    if (!code) {
      return res.status(400).send(getErrorPage('No authorization code received'));
    }

    // OAuth configuration
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI || `${req.headers.origin || 'https://beach-baby-vk73.vercel.app'}/api/auth/slack/callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).send(getErrorPage('OAuth not properly configured'));
    }

    // Exchange code for tokens
    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri
    });

    if (!result.ok) {
      return res.status(400).send(getErrorPage(`OAuth exchange failed: ${result.error}`));
    }

    // Extract user information
    const userToken = result.authed_user.access_token;
    const slackUserId = result.authed_user.id;
    const teamName = result.team.name;
    const scopes = result.authed_user.scope.split(',');

    // Get user info
    const userClient = new WebClient(userToken);
    const userInfo = await userClient.users.info({ user: slackUserId });

    // Success response
    res.send(getSuccessPage({
      user_id: state,
      slack_user_id: slackUserId,
      real_name: userInfo.user.real_name,
      email: userInfo.user.profile.email,
      team_name: teamName,
      scopes: scopes
    }));

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(getErrorPage(`Authentication failed: ${error.message}`));
  }
};

function getSuccessPage(result) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HeyJarvis - Authentication Successful</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0a0a0f 0%, #141923 50%, #0f141e 100%);
          color: #ffffff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          text-align: center;
          background: rgba(40, 45, 55, 0.8);
          border-radius: 20px;
          padding: 40px;
          border: 1px solid rgba(0, 212, 255, 0.2);
          backdrop-filter: blur(20px);
        }
        .success-icon {
          font-size: 4rem;
          margin-bottom: 20px;
          color: #00d4ff;
        }
        h1 {
          color: #00d4ff;
          margin-bottom: 20px;
        }
        .user-info {
          background: rgba(30, 35, 45, 0.6);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .user-info p {
          margin: 10px 0;
          color: rgba(255, 255, 255, 0.8);
        }
        .btn {
          background: linear-gradient(135deg, #00d4ff, #0099cc);
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 10px;
          text-decoration: none;
          display: inline-block;
          margin-top: 20px;
          transition: transform 0.2s;
        }
        .btn:hover {
          transform: scale(1.05);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">✅</div>
        <h1>Authentication Successful!</h1>
        <p>Welcome to HeyJarvis! Your Slack account has been successfully connected.</p>
        
        <div class="user-info">
          <p><strong>Name:</strong> ${result.real_name}</p>
          <p><strong>Team:</strong> ${result.team_name}</p>
          <p><strong>User ID:</strong> ${result.user_id}</p>
          <p><strong>Permissions:</strong> ${result.scopes.length} scopes granted</p>
        </div>
        
        <p>You can now use HeyJarvis for competitive intelligence monitoring and analysis.</p>
        <a href="/" class="btn">Return to Dashboard</a>
      </div>
    </body>
    </html>
  `;
}

function getErrorPage(message) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HeyJarvis - Authentication Error</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0a0a0f 0%, #141923 50%, #0f141e 100%);
          color: #ffffff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          text-align: center;
          background: rgba(40, 45, 55, 0.8);
          border-radius: 20px;
          padding: 40px;
          border: 1px solid rgba(220, 53, 69, 0.3);
          backdrop-filter: blur(20px);
        }
        .error-icon {
          font-size: 4rem;
          margin-bottom: 20px;
          color: #ff6b7d;
        }
        h1 {
          color: #ff6b7d;
          margin-bottom: 20px;
        }
        .btn {
          background: linear-gradient(135deg, #00d4ff, #0099cc);
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 10px;
          text-decoration: none;
          display: inline-block;
          margin-top: 20px;
          transition: transform 0.2s;
        }
        .btn:hover {
          transform: scale(1.05);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">❌</div>
        <h1>Authentication Failed</h1>
        <p>${message}</p>
        <p>Please try again or contact support if the problem persists.</p>
        <a href="/" class="btn">Return to Home</a>
      </div>
    </body>
    </html>
  `;
}
