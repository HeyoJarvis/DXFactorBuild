/**
 * GitHub OAuth Service for Team Sync Intelligence
 * 
 * Handles OAuth 2.0 authentication flow for GitHub
 * Stores tokens in team_sync_integrations table
 * Completely independent from Desktop2
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { shell } = require('electron');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

class GitHubOAuthService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.supabaseAdapter = options.supabaseAdapter;
    
    // Support multiple auth methods
    this.clientId = process.env.GITHUB_CLIENT_ID;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET;
    this.githubToken = process.env.GITHUB_TOKEN;
    
    // GitHub App credentials
    this.appId = process.env.GITHUB_APP_ID;
    this.installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    this.privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    
    this.redirectUri = 'http://localhost:8893/auth/github/callback';
    
    this.scopes = [
      'repo',
      'read:user',
      'user:email'
    ];
    
    this.server = null;
    this.pendingAuth = null;
    
    const authMethod = this._getAuthMethod();
    this.logger.info('GitHub OAuth Service initialized for Team Sync', {
      authMethod,
      redirectUri: this.redirectUri
    });
  }
  
  /**
   * Determine which authentication method to use
   */
  _getAuthMethod() {
    if (this.githubToken) return 'Personal Access Token';
    if (this.appId && this.installationId && this.privateKeyPath) return 'GitHub App';
    if (this.clientId && this.clientSecret) return 'OAuth App';
    return 'Not Configured';
  }

  /**
   * Check if we have any GitHub credentials configured
   */
  isConfigured() {
    return !!(
      this.githubToken ||
      (this.appId && this.installationId && this.privateKeyPath) ||
      (this.clientId && this.clientSecret)
    );
  }

  /**
   * Check if GitHub is connected for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isConnected(userId) {
    try {
      const { data, error } = await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('service_name', 'github')
        .single();

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start authentication (supports multiple methods)
   * @param {string} userId - User ID from Supabase auth
   * @returns {Promise<Object>} Authentication result with tokens
   */
  async startAuthFlow(userId) {
    // Method 1: Personal Access Token
    if (this.githubToken) {
      this.logger.info('Using GitHub Personal Access Token');
      return await this._storePersonalAccessToken(userId, this.githubToken);
    }

    // Method 2: GitHub App (your case!)
    if (this.appId && this.installationId && this.privateKeyPath) {
      this.logger.info('Using GitHub App authentication');
      return await this._connectGitHubApp(userId);
    }

    // Method 3: OAuth App
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GitHub not configured. Please set GitHub credentials in .env');
    }

    return new Promise((resolve, reject) => {
      try {
        // Start local server to catch callback
        this.server = http.createServer(async (req, res) => {
          const parsedUrl = url.parse(req.url, true);
          
          if (parsedUrl.pathname === '/auth/github/callback') {
            const { code, error, error_description } = parsedUrl.query;
            
            if (error) {
              this.logger.error('GitHub OAuth error', { error, error_description });
              
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #FF3B30;">❌ GitHub Authentication Failed</h1>
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
                
                // Get user info
                const userInfo = await this._getUserInfo(tokenResult.access_token);
                
                // Store tokens in database
                await this.supabaseAdapter.supabase
                  .from('team_sync_integrations')
                  .upsert({
                    user_id: userId,
                    service_name: 'github',
                    access_token: tokenResult.access_token,
                    refresh_token: tokenResult.refresh_token || null,
                    token_expiry: tokenResult.refresh_token ? 
                      new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() : // GitHub tokens expire in 8 hours
                      null, // Personal access tokens don't expire
                    metadata: {
                      scope: tokenResult.scope,
                      token_type: tokenResult.token_type,
                      username: userInfo.login,
                      name: userInfo.name
                    },
                    connected_at: new Date().toISOString(),
                    last_synced_at: new Date().toISOString()
                  }, {
                    onConflict: 'user_id,service_name'
                  });
                
                this.logger.info('GitHub authentication successful', { 
                  userId,
                  username: userInfo.login
                });
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #34C759;">✅ GitHub Connected!</h1>
                      <p>Successfully connected as ${userInfo.login}</p>
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
                    service: 'github',
                    connected_at: new Date().toISOString(),
                    username: userInfo.login
                  });
                  this.pendingAuth = null;
                }
                
                this._stopServer();
              } catch (error) {
                this.logger.error('GitHub token exchange failed', { error: error.message });
                
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #FF3B30;">❌ GitHub Authentication Error</h1>
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

        this.server.listen(8893, () => {
          this.logger.info('GitHub OAuth server started on port 8893');
          
          // Build authorization URL
          const authUrl = this._buildAuthUrl();
          
          this.logger.info('Opening GitHub authorization URL', { 
            authUrl: authUrl.substring(0, 80) + '...' 
          });
          
          // Store promise resolver
          this.pendingAuth = { resolve, reject };
          
          // Open browser to authorization URL
          shell.openExternal(authUrl);
        });

        // Handle server errors
        this.server.on('error', (error) => {
          this.logger.error('GitHub OAuth server error', { error: error.message });
          reject(error);
        });

      } catch (error) {
        this.logger.error('Failed to start GitHub auth flow', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Store personal access token
   */
  async _storePersonalAccessToken(userId, token) {
    try {
      // Verify token works
      const userInfo = await this._getUserInfo(token);
      
      // Store in database
      await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .upsert({
          user_id: userId,
          service_name: 'github',
          access_token: token,
          refresh_token: null,
          token_expiry: null, // PATs don't expire
          metadata: {
            username: userInfo.login,
            name: userInfo.name,
            token_type: 'personal_access_token'
          },
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,service_name'
        });
      
      this.logger.info('GitHub PAT stored', { userId, username: userInfo.login });
      
      return {
        success: true,
        service: 'github',
        connected_at: new Date().toISOString(),
        username: userInfo.login
      };
    } catch (error) {
      this.logger.error('Failed to store GitHub PAT', { error: error.message });
      throw error;
    }
  }

  /**
   * Build authorization URL
   */
  _buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state: crypto.randomBytes(16).toString('hex')
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async _exchangeCodeForTokens(code) {
    const tokenEndpoint = 'https://github.com/login/oauth/access_token';
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.redirectUri
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error('GitHub token exchange failed');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return data;
  }

  /**
   * Get GitHub user info
   */
  async _getUserInfo(accessToken) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get GitHub user info');
    }

    return await response.json();
  }

  /**
   * Get valid access token
   * @param {string} userId - User ID
   * @returns {Promise<string>} Valid access token
   */
  async getAccessToken(userId) {
    const { data, error } = await this.supabaseAdapter.supabase
      .from('team_sync_integrations')
      .select('access_token, token_expiry, metadata')
      .eq('user_id', userId)
      .eq('service_name', 'github')
      .single();

    if (error || !data) {
      throw new Error('GitHub not connected');
    }

    // Personal access tokens don't expire
    if (data.metadata?.token_type === 'personal_access_token') {
      return data.access_token;
    }

    // GitHub App tokens expire after 1 hour - refresh if needed
    if (data.metadata?.auth_type === 'github_app') {
      if (data.token_expiry) {
        const expiryTime = new Date(data.token_expiry).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        // Refresh token if expired or expiring within 5 minutes
        if (expiryTime - now < fiveMinutes) {
          this.logger.info('GitHub App token expired or expiring soon, refreshing...', { userId });
          
          try {
            const { token, expiresAt } = await this._getInstallationAccessToken();
            
            // Update token in database
            await this.supabaseAdapter.supabase
              .from('team_sync_integrations')
              .update({
                access_token: token,
                token_expiry: expiresAt,
                last_synced_at: new Date().toISOString()
              })
              .eq('user_id', userId)
              .eq('service_name', 'github');
            
            this.logger.info('GitHub App token refreshed', { userId, expiresAt });
            
            return token;
          } catch (refreshError) {
            this.logger.error('Failed to refresh GitHub App token', {
              userId,
              error: refreshError.message
            });
            throw new Error('Failed to refresh GitHub App token. Please reconnect.');
          }
        }
      }
      
      return data.access_token;
    }

    // Regular OAuth tokens expire in 8 hours (no refresh for OAuth apps)
    if (data.token_expiry) {
      const expiryTime = new Date(data.token_expiry).getTime();
      const now = Date.now();
      
      if (expiryTime < now) {
        // GitHub OAuth tokens don't have refresh tokens, user needs to re-authenticate
        throw new Error('GitHub token expired. Please reconnect.');
      }
    }

    return data.access_token;
  }

  /**
   * Disconnect GitHub integration
   * @param {string} userId - User ID
   */
  async disconnect(userId) {
    try {
      await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('service_name', 'github');

      this.logger.info('GitHub disconnected', { userId });
      
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to disconnect GitHub', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Generate JWT for GitHub App authentication
   * @returns {string} JWT token
   */
  _generateGitHubAppJWT() {
    try {
      // Read private key
      const privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');
      
      // Generate JWT
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iat: now - 60, // Issued 60 seconds in the past to allow for clock drift
        exp: now + (10 * 60), // Expires in 10 minutes
        iss: this.appId
      };
      
      return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    } catch (error) {
      this.logger.error('Failed to generate GitHub App JWT', {
        error: error.message,
        privateKeyPath: this.privateKeyPath
      });
      throw new Error(`Failed to generate JWT: ${error.message}`);
    }
  }

  /**
   * Get installation access token from GitHub
   * @returns {Promise<Object>} Token data with token and expires_at
   */
  async _getInstallationAccessToken() {
    try {
      const jwtToken = this._generateGitHubAppJWT();
      
      this.logger.info('Requesting installation access token', {
        appId: this.appId,
        installationId: this.installationId
      });
      
      const response = await fetch(
        `https://api.github.com/app/installations/${this.installationId}/access_tokens`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      this.logger.info('Installation access token obtained', {
        expiresAt: data.expires_at
      });
      
      return {
        token: data.token,
        expiresAt: data.expires_at
      };
    } catch (error) {
      this.logger.error('Failed to get installation access token', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Connect using GitHub App credentials
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Connection result
   */
  async _connectGitHubApp(userId) {
    try {
      this.logger.info('Connecting GitHub App', { 
        userId, 
        appId: this.appId,
        installationId: this.installationId
      });

      // Get installation access token
      const { token, expiresAt } = await this._getInstallationAccessToken();

      // Store in database
      await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .upsert({
          user_id: userId,
          service_name: 'github',
          access_token: token,
          token_expiry: expiresAt,
          metadata: {
            auth_type: 'github_app',
            app_id: this.appId,
            installation_id: this.installationId
          },
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,service_name'
        });

      this.logger.info('GitHub App connected successfully', { 
        userId,
        tokenExpiresAt: expiresAt
      });

      return {
        success: true,
        service: 'github',
        auth_type: 'github_app',
        connected_at: new Date().toISOString(),
        token_expires_at: expiresAt
      };

    } catch (error) {
      this.logger.error('Failed to connect GitHub App', { 
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
          this.logger.info('GitHub OAuth server stopped');
        });
        this.server = null;
      }, 1000);
    }
  }
}

module.exports = GitHubOAuthService;


