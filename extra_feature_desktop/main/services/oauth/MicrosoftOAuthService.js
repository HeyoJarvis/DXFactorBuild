/**
 * Microsoft OAuth Service for Team Sync Intelligence
 * 
 * Handles OAuth 2.0 authentication flow with PKCE
 * Stores tokens in team_sync_integrations table
 * Completely independent from Desktop2
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { shell } = require('electron');

class MicrosoftOAuthService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.supabaseAdapter = options.supabaseAdapter;
    
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    this.redirectUri = 'http://localhost:8891/auth/microsoft/callback'; // Different port from desktop2
    
    this.scopes = [
      'User.Read',
      'Calendars.ReadWrite',
      'OnlineMeetings.ReadWrite',
      'OnlineMeetingTranscript.Read.All',  // Read all transcripts (delegated)
      'OnlineMeetingRecording.Read.All',   // Read all recordings (delegated)
      'OnlineMeetingAIInsight.Read.All',   // Read all AI insights (delegated)
      'OnlineMeetingArtifact.Read.All',    // Read all meeting artifacts (delegated)
      'Files.Read.All',                    // For OneDrive transcript files (fallback)
      'Mail.Read',
      'offline_access'
    ];
    
    this.server = null;
    this.pendingAuth = null;
    this.codeVerifier = null;
    this.codeChallenge = null;
    
    this.logger.info('Microsoft OAuth Service initialized for Team Sync', {
      clientId: this.clientId?.substring(0, 8) + '...',
      redirectUri: this.redirectUri
    });
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  _generatePKCE() {
    // Generate random code verifier (43-128 characters)
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code challenge (SHA256 hash of verifier)
    this.codeChallenge = crypto
      .createHash('sha256')
      .update(this.codeVerifier)
      .digest('base64url');
    
    this.logger.debug('PKCE generated', {
      verifierLength: this.codeVerifier.length,
      challengeLength: this.codeChallenge.length
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
        // Generate PKCE
        this._generatePKCE();
        
        // Start local server to catch callback
        this.server = http.createServer(async (req, res) => {
          const parsedUrl = url.parse(req.url, true);
          
          if (parsedUrl.pathname === '/auth/microsoft/callback') {
            const { code, error, error_description } = parsedUrl.query;
            
            if (error) {
              this.logger.error('OAuth error', { error, error_description });
              
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #FF3B30;">❌ Authentication Failed</h1>
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
                
                // Store tokens in database
                await this.supabaseAdapter.supabase
                  .from('team_sync_integrations')
                  .upsert({
                    user_id: userId,
                    service_name: 'microsoft',
                    access_token: tokenResult.access_token,
                    refresh_token: tokenResult.refresh_token,
                    token_expiry: new Date(Date.now() + tokenResult.expires_in * 1000).toISOString(),
                    metadata: {
                      scope: tokenResult.scope,
                      token_type: tokenResult.token_type
                    },
                    connected_at: new Date().toISOString(),
                    last_synced_at: new Date().toISOString()
                  }, {
                    onConflict: 'user_id,service_name'
                  });
                
                this.logger.info('Microsoft authentication successful', { userId });
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #34C759;">✅ Microsoft Connected!</h1>
                      <p>Successfully connected to Microsoft 365</p>
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
                    service: 'microsoft',
                    connected_at: new Date().toISOString()
                  });
                  this.pendingAuth = null;
                }
                
                this._stopServer();
              } catch (error) {
                this.logger.error('Token exchange failed', { error: error.message });
                
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #FF3B30;">❌ Authentication Error</h1>
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

        this.server.listen(8891, () => {
          this.logger.info('OAuth server started on port 8891');
          
          // Build authorization URL
          const authUrl = this._buildAuthUrl();
          
          this.logger.info('Opening authorization URL', { 
            authUrl: authUrl.substring(0, 80) + '...' 
          });
          
          // Store promise resolver
          this.pendingAuth = { resolve, reject };
          
          // Open browser to authorization URL
          shell.openExternal(authUrl);
        });

        // Handle server errors
        this.server.on('error', (error) => {
          this.logger.error('OAuth server error', { error: error.message });
          reject(error);
        });

      } catch (error) {
        this.logger.error('Failed to start auth flow', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Build authorization URL
   */
  _buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      response_mode: 'query',
      scope: this.scopes.join(' '),
      state: crypto.randomBytes(16).toString('hex'),
      code_challenge: this.codeChallenge,
      code_challenge_method: 'S256'
    });

    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async _exchangeCodeForTokens(code) {
    const tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.redirectUri,
      code_verifier: this.codeVerifier
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || errorData.error || 'Token exchange failed');
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
        .eq('service_name', 'microsoft')
        .single();

      if (error || !data) {
        throw new Error('No Microsoft integration found for user');
      }

      const tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: this.clientId,
        grant_type: 'refresh_token',
        refresh_token: data.refresh_token,
        scope: this.scopes.join(' ')
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Token refresh failed');
      }

      const tokenResult = await response.json();

      // Update tokens in database
      await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .update({
          access_token: tokenResult.access_token,
          refresh_token: tokenResult.refresh_token || data.refresh_token, // Keep old refresh token if not returned
          token_expiry: new Date(Date.now() + tokenResult.expires_in * 1000).toISOString(),
          last_synced_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('service_name', 'microsoft');

      this.logger.info('Access token refreshed', { userId });

      return tokenResult.access_token;
    } catch (error) {
      this.logger.error('Failed to refresh access token', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get valid access token (refresh if needed)
   * @param {string} userId - User ID
   * @returns {Promise<string>} Valid access token
   */
  async getAccessToken(userId) {
    const { data, error } = await this.supabaseAdapter.supabase
      .from('team_sync_integrations')
      .select('access_token, token_expiry')
      .eq('user_id', userId)
      .eq('service_name', 'microsoft')
      .single();

    if (error || !data) {
      throw new Error('Microsoft not connected');
    }

    // Check if token is expired or will expire in next 5 minutes
    const expiryTime = new Date(data.token_expiry).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiryTime - now < fiveMinutes) {
      this.logger.info('Token expired or expiring soon, refreshing...', { userId });
      return await this.refreshAccessToken(userId);
    }

    return data.access_token;
  }

  /**
   * Disconnect Microsoft integration
   * @param {string} userId - User ID
   */
  async disconnect(userId) {
    try {
      await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('service_name', 'microsoft');

      this.logger.info('Microsoft disconnected', { userId });
      
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to disconnect Microsoft', { 
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
          this.logger.info('OAuth server stopped');
        });
        this.server = null;
      }, 1000);
    }
  }
}

module.exports = MicrosoftOAuthService;


