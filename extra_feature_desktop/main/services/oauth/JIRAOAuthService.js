/**
 * JIRA OAuth Service for Team Sync Intelligence
 * 
 * Handles OAuth 2.0 authentication flow for JIRA
 * Stores tokens in team_sync_integrations table
 * Completely independent from Desktop2
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { shell } = require('electron');

class JIRAOAuthService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.supabaseAdapter = options.supabaseAdapter;
    
    this.clientId = process.env.JIRA_CLIENT_ID;
    this.clientSecret = process.env.JIRA_CLIENT_SECRET;
    this.redirectUri = 'http://localhost:8892/auth/jira/callback'; // Different port
    
    this.scopes = [
      'read:jira-work',
      'read:jira-user',
      'offline_access'
    ];
    
    this.server = null;
    this.pendingAuth = null;
    
    this.logger.info('JIRA OAuth Service initialized for Team Sync', {
      clientId: this.clientId?.substring(0, 8) + '...',
      redirectUri: this.redirectUri
    });
  }

  /**
   * Start OAuth flow
   * @param {string} userId - User ID from Supabase auth
   * @returns {Promise<Object>} Authentication result with tokens
   */
  async startAuthFlow(userId) {
    return new Promise((resolve, reject) => {
      try {
        // Start local server to catch callback
        this.server = http.createServer(async (req, res) => {
          const parsedUrl = url.parse(req.url, true);
          
          if (parsedUrl.pathname === '/auth/jira/callback') {
            const { code, error, error_description } = parsedUrl.query;
            
            if (error) {
              this.logger.error('JIRA OAuth error', { error, error_description });
              
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #FF3B30;">❌ JIRA Authentication Failed</h1>
                    <p>${error_description || error}</p>
                    <p style="color: #666;">You can close this window and return to Team Sync.</p>
                  </body>
                </html>
              `);
              
              if (this.pendingAuth) {
                this.pendingAuth.reject(new Error(error_description || error));
                this.pendingAuth = null;
              }
              
              this._stopServer();
              return;
            }
            
            if (code) {
              try {
                // Exchange code for tokens
                const tokenResult = await this._exchangeCodeForTokens(code);
                
                // Get accessible resources (sites)
                const resources = await this._getAccessibleResources(tokenResult.access_token);
                
                // Store tokens in database
                await this.supabaseAdapter.supabase
                  .from('team_sync_integrations')
                  .upsert({
                    user_id: userId,
                    service_name: 'jira',
                    access_token: tokenResult.access_token,
                    refresh_token: tokenResult.refresh_token,
                    token_expiry: new Date(Date.now() + tokenResult.expires_in * 1000).toISOString(),
                    cloud_id: resources[0]?.id,
                    site_url: resources[0]?.url,
                    metadata: {
                      scope: tokenResult.scope,
                      resources: resources
                    },
                    connected_at: new Date().toISOString(),
                    last_synced_at: new Date().toISOString()
                  }, {
                    onConflict: 'user_id,service_name'
                  });
                
                this.logger.info('JIRA authentication successful', { 
                  userId,
                  cloudId: resources[0]?.id,
                  siteUrl: resources[0]?.url
                });
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #34C759;">✅ JIRA Connected!</h1>
                      <p>Successfully connected to ${resources[0]?.name || 'JIRA'}</p>
                      <p style="color: #666;">You can close this window and return to Team Sync.</p>
                      <script>
                        setTimeout(() => window.close(), 3000);
                      </script>
                    </body>
                  </html>
                `);
                
                if (this.pendingAuth) {
                  this.pendingAuth.resolve({
                    success: true,
                    service: 'jira',
                    connected_at: new Date().toISOString(),
                    cloudId: resources[0]?.id
                  });
                  this.pendingAuth = null;
                }
                
                this._stopServer();
              } catch (error) {
                this.logger.error('JIRA token exchange failed', { error: error.message });
                
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #FF3B30;">❌ JIRA Authentication Error</h1>
                      <p>${error.message}</p>
                      <p style="color: #666;">You can close this window.</p>
                    </body>
                  </html>
                `);
                
                if (this.pendingAuth) {
                  this.pendingAuth.reject(error);
                  this.pendingAuth = null;
                }
                
                this._stopServer();
              }
            }
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        });

        this.server.listen(8892, () => {
          this.logger.info('JIRA OAuth server started on port 8892');
          
          // Build authorization URL
          const authUrl = this._buildAuthUrl();
          
          this.logger.info('Opening JIRA authorization URL', { 
            authUrl: authUrl.substring(0, 80) + '...' 
          });
          
          // Store promise resolver
          this.pendingAuth = { resolve, reject };
          
          // Open browser to authorization URL
          shell.openExternal(authUrl);
        });

        // Handle server errors
        this.server.on('error', (error) => {
          this.logger.error('JIRA OAuth server error', { error: error.message });
          reject(error);
        });

      } catch (error) {
        this.logger.error('Failed to start JIRA auth flow', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Build authorization URL
   */
  _buildAuthUrl() {
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId,
      scope: this.scopes.join(' '),
      redirect_uri: this.redirectUri,
      state: crypto.randomBytes(16).toString('hex'),
      response_type: 'code',
      prompt: 'consent'
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async _exchangeCodeForTokens(code) {
    const tokenEndpoint = 'https://auth.atlassian.com/oauth/token';
    
    const body = {
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.redirectUri
    };

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || errorData.error || 'JIRA token exchange failed');
    }

    return await response.json();
  }

  /**
   * Get accessible JIRA resources (sites)
   */
  async _getAccessibleResources(accessToken) {
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get accessible JIRA resources');
    }

    return await response.json();
  }

  /**
   * Refresh access token
   * @param {string} userId - User ID
   * @returns {Promise<string>} New access token
   */
  async refreshAccessToken(userId) {
    try {
      // Get current tokens from database
      const { data, error } = await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .select('refresh_token')
        .eq('user_id', userId)
        .eq('service_name', 'jira')
        .single();

      if (error || !data) {
        throw new Error('No JIRA integration found for user');
      }

      const tokenEndpoint = 'https://auth.atlassian.com/oauth/token';
      
      const body = {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: data.refresh_token
      };

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'JIRA token refresh failed');
      }

      const tokenResult = await response.json();

      // Update tokens in database
      await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .update({
          access_token: tokenResult.access_token,
          refresh_token: tokenResult.refresh_token || data.refresh_token,
          token_expiry: new Date(Date.now() + tokenResult.expires_in * 1000).toISOString(),
          last_synced_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('service_name', 'jira');

      this.logger.info('JIRA access token refreshed', { userId });

      return tokenResult.access_token;
    } catch (error) {
      this.logger.error('Failed to refresh JIRA access token', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get valid access token (refresh if needed)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Token and cloud ID
   */
  async getAccessToken(userId) {
    const { data, error } = await this.supabaseAdapter.supabase
      .from('team_sync_integrations')
      .select('access_token, token_expiry, cloud_id, site_url')
      .eq('user_id', userId)
      .eq('service_name', 'jira')
      .single();

    if (error || !data) {
      throw new Error('JIRA not connected');
    }

    // Check if token is expired or will expire in next 5 minutes
    const expiryTime = new Date(data.token_expiry).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    let accessToken = data.access_token;
    if (expiryTime - now < fiveMinutes) {
      this.logger.info('JIRA token expired or expiring soon, refreshing...', { userId });
      accessToken = await this.refreshAccessToken(userId);
    }

    return {
      accessToken,
      cloudId: data.cloud_id,
      siteUrl: data.site_url
    };
  }

  /**
   * Disconnect JIRA integration
   * @param {string} userId - User ID
   */
  async disconnect(userId) {
    try {
      await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('service_name', 'jira');

      this.logger.info('JIRA disconnected', { userId });
      
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to disconnect JIRA', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Stop OAuth server
   */
  _stopServer() {
    if (this.server) {
      setTimeout(() => {
        this.server.close(() => {
          this.logger.info('JIRA OAuth server stopped');
        });
        this.server = null;
      }, 1000);
    }
  }
}

module.exports = JIRAOAuthService;


