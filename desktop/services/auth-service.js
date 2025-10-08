/**
 * Authentication Service - Handles Slack OAuth via Supabase Auth
 * 
 * Features:
 * 1. Slack OAuth flow integration
 * 2. Session management and persistence
 * 3. User profile sync with Supabase
 * 4. Automatic token refresh
 */

const { BrowserWindow } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const Store = require('electron-store');
const winston = require('winston');

class AuthService {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'auth-service' }
    });
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    );
    
    // Local session storage
    this.store = new Store({
      name: 'heyjarvis-auth',
      encryptionKey: process.env.ENCRYPTION_KEY
    });
    
    this.currentUser = null;
    this.currentSession = null;
    
    this.logger.info('Auth service initialized');
  }
  
  /**
   * Start Slack OAuth flow with PKCE
   */
  async signInWithSlack() {
    try {
      this.logger.info('Starting Slack OAuth flow with PKCE...');
      
      // Start local callback server to catch the code
      const callbackServer = await this.startCallbackServer();
      const callbackPort = callbackServer.port;
      
      console.log(`🔐 Callback server ready on port ${callbackPort}`);
      
      // Generate OAuth URL with PKCE
      const redirectUrl = `http://localhost:${callbackPort}/auth/callback`;
      
      // Build OAuth URL manually to ensure proper PKCE flow
      const supabaseUrl = process.env.SUPABASE_URL;
      const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=slack_oidc&redirect_to=${encodeURIComponent(redirectUrl)}`;
      
      console.log('🌐 Opening OAuth in browser...');
      
      // Open OAuth in system browser
      await this.createAuthWindow(authUrl);
      
      console.log('⏳ Waiting for OAuth callback...');
      
      // Wait for callback from local server
      const session = await this.waitForCallback(callbackServer);
      
      // Close callback server
      callbackServer.close();
      
      if (session) {
        console.log('✅ Session received, saving user data...');
        await this.handleSuccessfulAuth(session);
        return {
          success: true,
          user: this.currentUser,
          session: this.currentSession
        };
      } else {
        throw new Error('Authentication cancelled or failed');
      }
      
    } catch (error) {
      this.logger.error('Slack OAuth failed', { error: error.message });
      console.error('❌ Auth error:', error);
      throw error;
    }
  }
  
  /**
   * Poll for session after OAuth completes
   */
  async pollForSession() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes (5 seconds interval)
      
      console.log('🔄 Starting session polling...');
      
      const pollInterval = setInterval(async () => {
        attempts++;
        console.log(`🔍 Polling attempt ${attempts}/${maxAttempts}...`);
        
        // Check if session exists
        const { data: { session }, error } = await this.supabase.auth.getSession();
        
        if (error) {
          console.log('⚠️ Session check error:', error.message);
        }
        
        if (session) {
          clearInterval(pollInterval);
          console.log('✅ Session detected via polling!');
          this.logger.info('Session detected via polling');
          resolve(session);
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          console.log('❌ Authentication timeout after', attempts, 'attempts');
          reject(new Error('Authentication timeout - please try again'));
        } else {
          console.log('⏳ No session yet, will retry in 5 seconds...');
        }
      }, 5000); // Poll every 5 seconds
    });
  }
  
  /**
   * Start local HTTP server to catch OAuth callback
   */
  async startCallbackServer() {
    const http = require('http');
    
    return new Promise((resolve) => {
      const server = http.createServer();
      let sessionResolver = null;
      
      server.on('request', async (req, res) => {
        console.log('📥 Received callback request:', req.url);
        
        if (req.url.startsWith('/auth/callback')) {
          const url = new URL(req.url, `http://localhost:${server.address().port}`);
          
          // Check if this is the token submission from the JavaScript
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('✅ Received tokens from hash extraction');
            
            try {
              // Set the session using the tokens
              const { data, error } = await this.supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (error) {
                console.error('❌ Session set error:', error);
                throw error;
              }
              
              console.log('✅ Session set successfully');
              
              // Send success page
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Authentication Successful</title>
                  <style>
                    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                    .container { background: white; padding: 48px; border-radius: 16px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                    h1 { color: #171717; margin: 0 0 16px 0; }
                    p { color: #737373; margin: 0; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>✅ Authentication Successful!</h1>
                    <p>You can close this window and return to HeyJarvis.</p>
                  </div>
                  <script>setTimeout(() => window.close(), 2000);</script>
                </body>
                </html>
              `);
              
              console.log('📤 Resolving with session...');
              
              // Resolve with session
              if (sessionResolver) {
                sessionResolver(data.session);
              }
            } catch (error) {
              console.error('❌ Session set failed:', error);
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end(`
                <!DOCTYPE html>
                <html>
                <head><title>Error</title></head>
                <body><h1>Authentication Error</h1><p>${error.message}</p></body>
                </html>
              `);
              
              if (sessionResolver) {
                sessionResolver(null);
              }
            }
          } else {
            // First request - serve page that extracts hash and sends tokens
            console.log('📄 Serving hash extraction page...');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Processing Authentication...</title>
                <style>
                  body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                  .container { background: white; padding: 48px; border-radius: 16px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                  h1 { color: #171717; margin: 0 0 16px 0; }
                  p { color: #737373; margin: 0; }
                  .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="spinner"></div>
                  <h1>Processing Authentication...</h1>
                  <p>Please wait while we complete the authentication.</p>
                </div>
                <script>
                  // Extract tokens from URL hash
                  const hash = window.location.hash.substring(1);
                  const params = new URLSearchParams(hash);
                  const accessToken = params.get('access_token');
                  const refreshToken = params.get('refresh_token');
                  
                  console.log('Hash params:', { accessToken: !!accessToken, refreshToken: !!refreshToken });
                  
                  if (accessToken && refreshToken) {
                    // Send tokens to server
                    window.location.href = '/auth/callback?access_token=' + encodeURIComponent(accessToken) + '&refresh_token=' + encodeURIComponent(refreshToken);
                  } else {
                    document.querySelector('.container').innerHTML = '<h1>❌ Error</h1><p>No authentication tokens found in URL</p>';
                  }
                </script>
              </body>
              </html>
            `);
          }
        }
      });
      
      // Listen on fixed port 8888 for OAuth callback
      server.listen(8888, 'localhost', () => {
        const port = 8888;
        this.logger.info(`Callback server listening on port ${port}`);
        
        resolve({
          port,
          close: () => server.close(),
          waitForSession: () => new Promise((res) => { sessionResolver = res; })
        });
      });
    });
  }
  
  /**
   * Create OAuth browser window
   */
  async createAuthWindow(url) {
    // Open in system browser instead of Electron window
    const { shell } = require('electron');
    await shell.openExternal(url);
    
    this.logger.info('OAuth opened in system browser');
    
    // Return a mock window object for compatibility
    return {
      closed: false,
      close: () => {},
      on: () => {},
      webContents: { on: () => {} }
    };
  }
  
  /**
   * Wait for OAuth callback
   */
  async waitForCallback(callbackServer) {
    return new Promise((resolve, reject) => {
      console.log('⏳ Waiting for callback...');
      
      // Wait for session from callback server
      const sessionPromise = callbackServer.waitForSession();
      
      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        console.log('❌ Callback timeout');
        reject(new Error('Authentication timeout - please try again'));
      }, 5 * 60 * 1000);
      
      sessionPromise.then((session) => {
        console.log('✅ Callback received with session');
        clearTimeout(timeout);
        resolve(session);
      }).catch((error) => {
        console.error('❌ Callback error:', error);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  /**
   * Handle successful authentication
   */
  async handleSuccessfulAuth(session) {
    try {
      this.currentSession = session;
      
      // Get user data from Supabase Auth
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error) throw error;
      
      // Extract Slack identity from user metadata
      const slackIdentity = user.identities?.find(id => id.provider === 'slack');
      const slackData = slackIdentity?.identity_data || {};
      
      // Create or update user in our database
      const userData = {
        id: user.id,
        email: user.email,
        name: slackData.name || user.user_metadata?.name || user.email?.split('@')[0],
        avatar_url: slackData.image_512 || slackData.image_192 || user.user_metadata?.avatar_url,
        slack_user_id: slackData.sub || slackData.user_id,
        slack_team_id: slackData.team_id,
        slack_team_name: slackData.team_name,
        last_login: new Date().toISOString()
      };
      
      // Upsert user in database
      const { data: dbUser, error: dbError } = await this.supabase
        .from('users')
        .upsert(userData, { onConflict: 'id' })
        .select()
        .single();
      
      if (dbError) {
        this.logger.warn('Failed to upsert user in database', { error: dbError.message });
        // Continue anyway, we can still use Auth user
        this.currentUser = userData;
      } else {
        this.currentUser = dbUser;
      }
      
      // Save session locally
      this.saveSession(session, this.currentUser);
      
      this.logger.info('Authentication successful', {
        user_id: this.currentUser.id,
        email: this.currentUser.email,
        slack_user_id: this.currentUser.slack_user_id
      });
      
    } catch (error) {
      this.logger.error('Failed to handle successful auth', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Save session to local storage
   */
  saveSession(session, user) {
    this.store.set('session', {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: user
    });
    
    this.logger.info('Session saved locally');
  }
  
  /**
   * Load session from local storage
   */
  async loadSession() {
    try {
      const storedSession = this.store.get('session');
      
      if (!storedSession) {
        this.logger.info('No stored session found');
        return null;
      }
      
      // Check if session is expired
      if (storedSession.expires_at && new Date(storedSession.expires_at * 1000) < new Date()) {
        this.logger.info('Stored session expired, attempting refresh...');
        
        // Try to refresh
        const { data, error } = await this.supabase.auth.refreshSession({
          refresh_token: storedSession.refresh_token
        });
        
        if (error) {
          this.logger.warn('Session refresh failed', { error: error.message });
          this.clearSession();
          return null;
        }
        
        // Save refreshed session
        this.currentSession = data.session;
        this.currentUser = storedSession.user;
        this.saveSession(data.session, this.currentUser);
        
        this.logger.info('Session refreshed successfully');
        return { session: this.currentSession, user: this.currentUser };
      }
      
      // Set session in Supabase
      const { data, error } = await this.supabase.auth.setSession({
        access_token: storedSession.access_token,
        refresh_token: storedSession.refresh_token
      });
      
      if (error) {
        this.logger.warn('Failed to restore session', { error: error.message });
        this.clearSession();
        return null;
      }
      
      this.currentSession = data.session;
      this.currentUser = storedSession.user;
      
      this.logger.info('Session loaded successfully', { user_id: this.currentUser.id });
      
      return { session: this.currentSession, user: this.currentUser };
      
    } catch (error) {
      this.logger.error('Failed to load session', { error: error.message });
      this.clearSession();
      return null;
    }
  }
  
  /**
   * Get current session token for API calls
   */
  getSessionToken() {
    if (this.currentSession && this.currentSession.access_token) {
      return this.currentSession.access_token;
    }
    
    // Try to get from stored session
    const storedSession = this.store.get('session');
    if (storedSession && storedSession.access_token) {
      return storedSession.access_token;
    }
    
    return null;
  }
  
  /**
   * Sign out
   */
  async signOut() {
    try {
      // Sign out from Supabase
      await this.supabase.auth.signOut();
      
      // Clear local storage
      this.clearSession();
      
      this.logger.info('User signed out successfully');
      
      return { success: true };
      
    } catch (error) {
      this.logger.error('Sign out failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Clear local session
   */
  clearSession() {
    this.store.delete('session');
    this.currentUser = null;
    this.currentSession = null;
    
    this.logger.info('Local session cleared');
  }
  
  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }
  
  /**
   * Get current session
   */
  getCurrentSession() {
    return this.currentSession;
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return Boolean(this.currentUser && this.currentSession);
  }
  
  /**
   * Get Supabase client with current session
   */
  getSupabaseClient() {
    return this.supabase;
  }
}

module.exports = AuthService;

