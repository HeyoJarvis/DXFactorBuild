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
   * Start Slack OAuth flow with PKCE (restored from working desktop implementation)
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
        
        // Ensure user has proper onboarding fields
        await this.ensureUserOnboardingFields(session.user.id);
        
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
   * Ensure user has onboarding fields (for Supabase Auth users)
   */
  async ensureUserOnboardingFields(userId) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Check if user exists in our users table
      const { data: existingUser, error: checkError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (!existingUser) {
        // User doesn't exist in our table, get from Supabase Auth
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (authUser) {
          // Create user in our table - force onboarding for all new users
          await supabaseAdmin
            .from('users')
            .insert({
              id: userId,
              email: authUser.user.email,
              name: authUser.user.user_metadata?.name || authUser.user.email.split('@')[0],
              avatar_url: authUser.user.user_metadata?.avatar_url,
              auth_provider: 'slack',
              email_verified: true,
              onboarding_completed: false,
              onboarding_step: 'role_selection',
              user_role: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }
      } else {
        // FORCE all existing users to go through onboarding again
        await supabaseAdmin
          .from('users')
          .update({
            onboarding_completed: false,
            onboarding_step: 'role_selection',
            user_role: null, // Reset role to force selection
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      }
    } catch (error) {
      this.logger.error('Failed to ensure user onboarding fields', { error: error.message });
      // Don't throw - this is not critical
    }
  }
  
  /**
   * Start Microsoft Teams/Azure AD OAuth flow using existing OAuth server
   */
  async signInWithMicrosoft() {
    try {
      this.logger.info('Starting Microsoft OAuth flow with existing OAuth server...');
      
      // Microsoft uses port 8890 (OAuth server) but needs to match the redirect URI in Azure
      // which is configured for port 8889 in .env
      const oauthServerUrl = 'http://localhost:8890';
      const authUrl = `${oauthServerUrl}/auth/microsoft`;
      
      console.log('🔐 Using existing OAuth server at', oauthServerUrl);
      console.log('🌐 Opening OAuth in browser...');
      
      // Open OAuth in system browser
      await this.createAuthWindow(authUrl);
      
      console.log('⏳ Waiting for OAuth callback...');
      
      // Wait for the OAuth server to complete and return user data
      const userData = await this.waitForOAuthCallback(8890, 'microsoft');
      
      if (userData) {
        console.log('✅ User data received from OAuth server:', userData.email);
        
        // Create/update user directly in Supabase database
        await this.handleDirectAuth(userData, 'microsoft');
        
        return {
          success: true,
          user: this.currentUser,
          session: this.currentSession
        };
      } else {
        throw new Error('Authentication cancelled or failed');
      }
      
    } catch (error) {
      this.logger.error('Microsoft OAuth failed', { error: error.message });
      console.error('❌ Auth error:', error);
      throw error;
    }
  }
  
  /**
   * Start Google OAuth flow using existing OAuth server
   */
  async signInWithGoogle() {
    try {
      this.logger.info('Starting Google OAuth flow with existing OAuth server...');
      
      // Use your existing OAuth server on port 8890
      const oauthServerUrl = 'http://localhost:8890';
      const authUrl = `${oauthServerUrl}/auth/google`;
      
      console.log('🔐 Using existing OAuth server at', oauthServerUrl);
      console.log('🌐 Opening OAuth in browser...');
      
      // Open OAuth in system browser
      await this.createAuthWindow(authUrl);
      
      console.log('⏳ Waiting for OAuth callback...');
      
      // Wait for the OAuth server to complete and return user data
      const userData = await this.waitForOAuthCallback(8890, 'google');
      
      if (userData) {
        console.log('✅ User data received from OAuth server:', userData.email);
        
        // Create/update user directly in Supabase database
        await this.handleDirectAuth(userData, 'google');
        
        return {
          success: true,
          user: this.currentUser,
          session: this.currentSession
        };
      } else {
        throw new Error('Authentication cancelled or failed');
      }
      
    } catch (error) {
      this.logger.error('Google OAuth failed', { error: error.message });
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
                  <script>setTimeout(() => window.close(), 300);</script>
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
  async handleSuccessfulAuth(session, authProvider = 'slack') {
    try {
      this.currentSession = session;
      
      // Get user data from Supabase Auth
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error) throw error;
      
      // Extract identity based on provider
      const identity = user.identities?.find(id => 
        id.provider === authProvider || id.provider === `${authProvider}_oidc`
      );
      const identityData = identity?.identity_data || {};
      
      // Check if user exists (to determine if this is first login)
      const { data: existingUser, error: checkError } = await this.supabase
        .from('users')
        .select('id, user_role, onboarding_completed')
        .eq('id', user.id)
        .single();
      
      const isNewUser = !existingUser || checkError;
      
      // Create or update user in our database
      const userData = {
        id: user.id,
        email: user.email,
        name: identityData.name || user.user_metadata?.name || user.email?.split('@')[0],
        avatar_url: identityData.image_512 || identityData.image_192 || user.user_metadata?.avatar_url,
        
        // Slack identity
        slack_user_id: authProvider === 'slack' ? (identityData.sub || identityData.user_id) : existingUser?.slack_user_id,
        slack_team_id: authProvider === 'slack' ? identityData.team_id : existingUser?.slack_team_id,
        slack_team_name: authProvider === 'slack' ? identityData.team_name : existingUser?.slack_team_name,
        
        // Microsoft identity  
        microsoft_user_id: authProvider === 'microsoft' ? identityData.sub : existingUser?.microsoft_user_id,
        microsoft_email: authProvider === 'microsoft' ? identityData.email : existingUser?.microsoft_email,
        
        // Google identity
        google_user_id: authProvider === 'google' ? identityData.sub : existingUser?.google_user_id,
        google_email: authProvider === 'google' ? identityData.email : existingUser?.google_email,
        
        // Auth tracking
        primary_auth_provider: isNewUser ? authProvider : existingUser?.primary_auth_provider,
        last_login_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      };
      
      // For new users, set onboarding state
      if (isNewUser) {
        userData.onboarding_completed = false;
        userData.onboarding_step = 'role_selection'; // First step after auth
        userData.onboarding_started_at = new Date().toISOString();
      }
      
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
      
      // Apply role override for development testing if set
      const hasRoleOverride = process.env.ROLE_OVERRIDE;
      if (hasRoleOverride) {
        try {
          console.log(`🎭 Development mode: Applying ROLE_OVERRIDE=${hasRoleOverride}`);
          const { error: roleError } = await this.supabase
            .from('users')
            .update({ user_role: hasRoleOverride, onboarding_completed: true })
            .eq('id', user.id);

          if (!roleError && this.currentUser) {
            this.currentUser.user_role = hasRoleOverride;
            this.currentUser.onboarding_completed = true;
          }
        } catch (error) {
          this.logger.warn('Failed to apply role override', { error: error.message });
        }
      }
      
      // Save session locally
      this.saveSession(session, this.currentUser);
      
      this.logger.info('Authentication successful', {
        user_id: this.currentUser.id,
        email: this.currentUser.email,
        auth_provider: authProvider,
        is_new_user: isNewUser,
        needs_onboarding: !this.currentUser.onboarding_completed,
        fresh_login: true
      });
      
      // Note: Integration auto-initialization is handled by the main process
      // via autoInitializeUserIntegrations() after login completes
      
    } catch (error) {
      this.logger.error('Failed to handle successful auth', { error: error.message });
      throw error;
    }
  }
  
  
  /**
   * Update user's role and onboarding state
   */
  async updateUserRole(userId, role) {
    try {
      // Use service role client to bypass RLS
      const { createClient } = require('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ 
          user_role: role,
          onboarding_step: 'integration_setup', // Move to next step
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select();
      
      if (error) throw error;
      
      // Get the first (and should be only) user
      const updatedUser = data && data.length > 0 ? data[0] : null;
      
      if (!updatedUser) {
        throw new Error('User not found or update failed');
      }
      
      if (this.currentUser && this.currentUser.id === userId) {
        this.currentUser = updatedUser;
      }
      
      this.logger.info('User role updated', { userId, role });
      return { success: true, user: updatedUser };
    } catch (error) {
      this.logger.error('Failed to update user role', { userId, role, error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Complete onboarding
   */
  async completeOnboarding(userId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({ 
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: 'completed'
        })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      if (this.currentUser && this.currentUser.id === userId) {
        this.currentUser = data;
      }
      
      this.logger.info('Onboarding completed', { userId });
      return { success: true, user: data };
    } catch (error) {
      this.logger.error('Failed to complete onboarding', { userId, error: error.message });
      return { success: false, error: error.message };
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
  
  /**
   * Save user role
   */
  async saveUserRole(role) {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user');
      }
      
      // Update user in database
      const { data, error } = await this.supabase
        .from('users')
        .update({ user_role: role })
        .eq('id', this.currentUser.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update current user
      this.currentUser = data;
      
      // Update local session
      const storedSession = this.store.get('session');
      if (storedSession) {
        storedSession.user = data;
        this.store.set('session', storedSession);
      }
      
      this.logger.info('User role saved', { role, user_id: this.currentUser.id });
      
      return { success: true, user: this.currentUser };
      
    } catch (error) {
      this.logger.error('Failed to save user role', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get user role
   */
  getUserRole() {
    return this.currentUser?.user_role || null;
  }
  
  /**
   * Check if user needs to select role
   */
  needsRoleSelection() {
    return this.currentUser && !this.currentUser.user_role;
  }

  /**
   * Check onboarding status for current user
   * Returns what steps are needed
   */
  async checkOnboardingStatus() {
    try {
      if (!this.currentUser) {
        return {
          needsOnboarding: false,
          needsRole: false,
          needsTeam: false,
          currentStep: null
        };
      }

      const userId = this.currentUser.id;

      // Get user data with team info
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('onboarding_completed, user_role, team_id, onboarding_step')
        .eq('id', userId)
        .single();

      if (userError) {
        this.logger.warn('Failed to check onboarding status', { error: userError.message });
        return {
          needsOnboarding: false,
          needsRole: false,
          needsTeam: false,
          currentStep: null
        };
      }

      const needsOnboarding = !user.onboarding_completed;
      const needsRole = !user.user_role;
      const needsTeam = !user.team_id;
      const currentStep = user.onboarding_step || 'role_selection';

      this.logger.info('Onboarding status checked', {
        userId,
        needsOnboarding,
        needsRole,
        needsTeam,
        currentStep
      });

      return {
        needsOnboarding,
        needsRole,
        needsTeam,
        currentStep,
        completedSteps: [],
        selectedIntegrations: []
      };
    } catch (error) {
      this.logger.error('Error checking onboarding status', { error: error.message });
      return {
        needsOnboarding: false,
        needsRole: false,
        needsTeam: false,
        currentStep: null
      };
    }
  }

  /**
   * Update onboarding progress
   */
  async updateOnboardingProgress(step, data = {}) {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user');
      }

      const userId = this.currentUser.id;

      // Update user's onboarding_step (no more onboarding_progress table)
      const { error } = await this.supabase
        .from('users')
        .update({ 
          onboarding_step: step,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      this.logger.info('Onboarding progress updated', { userId, step });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to update onboarding progress', { error: error.message });
      throw error;
    }
  }

  /**
   * Mark onboarding as complete
   * @param {string} userId - Optional user ID (defaults to currentUser)
   */
  async completeOnboarding(userId = null) {
    try {
      const targetUserId = userId || this.currentUser?.id;
      
      if (!targetUserId) {
        throw new Error('No user ID provided');
      }

      // Use service role client to bypass RLS
      const { createClient } = require('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Update user
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({
          onboarding_completed: true,
          onboarding_step: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId)
        .select();

      if (error) throw error;

      const updatedUser = data && data.length > 0 ? data[0] : null;

      if (!updatedUser) {
        throw new Error('User not found or update failed');
      }

      // Update current user in memory if it's the same user
      if (this.currentUser && this.currentUser.id === targetUserId) {
        this.currentUser.onboarding_completed = true;
        this.currentUser.onboarding_step = 'completed';
      }

      this.logger.info('Onboarding completed', { userId: targetUserId });

      return { success: true, user: updatedUser };
    } catch (error) {
      this.logger.error('Failed to complete onboarding', { error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Wait for OAuth callback from existing OAuth server
   * This polls the OAuth server's /auth/status endpoint to get user data
   */
  async waitForOAuthCallback(port, provider) {
    return new Promise((resolve, reject) => {
      const axios = require('axios');
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes (5 seconds interval)
      
      console.log(`🔄 Polling OAuth server for ${provider} auth...`);
      
      const pollInterval = setInterval(async () => {
        attempts++;
        console.log(`🔍 Polling attempt ${attempts}/${maxAttempts}...`);
        
        try {
          // Check if OAuth completed by polling the status endpoint
          const response = await axios.get(`http://localhost:${port}/auth/status`, {
            timeout: 3000
          });
          
          if (response.data && response.data.authenticated && response.data.provider === provider) {
            clearInterval(pollInterval);
            console.log('✅ OAuth completed, user data received!');
            resolve(response.data.user);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            console.log('❌ Authentication timeout after', attempts, 'attempts');
            reject(new Error('Authentication timeout - please try again'));
          } else {
            console.log('⏳ No auth data yet, will retry in 5 seconds...');
          }
        } catch (error) {
          // Server not ready or no auth yet
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            console.log('❌ Authentication timeout');
            reject(new Error('Authentication timeout - please try again'));
          }
          // Continue polling
        }
      }, 5000); // Poll every 5 seconds
    });
  }
  
  /**
   * Handle direct authentication (no Supabase Auth)
   * Creates/updates user directly in Supabase database
   */
  async handleDirectAuth(userData, provider) {
    try {
      console.log('💾 Creating/updating user in database...');
      
      // Use service role client to directly manipulate database
      const { createClient } = require('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Check if user exists
      const { data: existingUsers, error: checkError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', userData.email)
        .limit(1);
      
      if (checkError) {
        console.error('❌ Error checking for existing user:', checkError);
        throw checkError;
      }
      
      let user;
      
      if (existingUsers && existingUsers.length > 0) {
        // Update existing user
        console.log('📝 Updating existing user...');
        user = existingUsers[0];
        
        const updateData = {
          name: userData.name || user.name,
          avatar_url: userData.avatar_url || userData.picture || user.avatar_url,
          auth_provider: provider,
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Ensure onboarding fields exist (for legacy users)
        if (user.onboarding_completed === null || user.onboarding_completed === undefined) {
          updateData.onboarding_completed = false;
        }
        if (!user.onboarding_step) {
          updateData.onboarding_step = user.user_role ? 'integration_setup' : 'role_selection';
        }
        
        // Store provider-specific identity and tokens
        if (provider === 'slack' && userData.slack_user_id) {
          updateData.slack_user_id = userData.slack_user_id;
          updateData.slack_team_id = userData.slack_team_id;
          updateData.slack_team_name = userData.slack_team_name;
        } else if (provider === 'microsoft') {
          // Store Microsoft tokens for integration
          const microsoftTokens = {
            access_token: userData.tokens?.access_token,
            refresh_token: userData.tokens?.refresh_token,
            token_expiry: userData.tokens?.expires_in 
              ? new Date(Date.now() + (userData.tokens.expires_in * 1000)).toISOString()
              : null,
            id: userData.id,
            email: userData.email,
            connected_at: new Date().toISOString()
          };
          
          updateData.integration_settings = {
            ...user.integration_settings,
            microsoft: microsoftTokens
          };
          
          console.log('💾 Saving Microsoft tokens to integration_settings');
        } else if (provider === 'google') {
          // Store Google tokens for integration
          const googleTokens = {
            access_token: userData.tokens?.access_token,
            refresh_token: userData.tokens?.refresh_token,
            token_expiry: userData.tokens?.expires_in 
              ? new Date(Date.now() + (userData.tokens.expires_in * 1000)).toISOString()
              : null,
            id: userData.id,
            email: userData.email,
            connected_at: new Date().toISOString()
          };
          
          updateData.integration_settings = {
            ...user.integration_settings,
            google: googleTokens
          };
          
          console.log('💾 Saving Google tokens to integration_settings');
        }
        
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', user.id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        user = updatedUser;
        
      } else {
        // Create new user
        console.log('✨ Creating new user...');
        
        const newUser = {
          email: userData.email,
          name: userData.name || userData.email.split('@')[0],
          avatar_url: userData.avatar_url || userData.picture,
          auth_provider: provider,
          email_verified: true,
          onboarding_completed: false,
          onboarding_step: 'role_selection',
          user_role: null, // Don't auto-assign role - let user choose
          last_login: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Store provider-specific identity and tokens
        if (provider === 'slack' && userData.slack_user_id) {
          newUser.slack_user_id = userData.slack_user_id;
          newUser.slack_team_id = userData.slack_team_id;
          newUser.slack_team_name = userData.slack_team_name;
        } else if (provider === 'microsoft') {
          // Store Microsoft tokens for integration
          newUser.integration_settings = {
            microsoft: {
              access_token: userData.tokens?.access_token,
              refresh_token: userData.tokens?.refresh_token,
              token_expiry: userData.tokens?.expires_in 
                ? new Date(Date.now() + (userData.tokens.expires_in * 1000)).toISOString()
                : null,
              id: userData.id,
              email: userData.email,
              connected_at: new Date().toISOString()
            }
          };
          
          console.log('💾 Saving Microsoft tokens for new user');
        } else if (provider === 'google') {
          // Store Google tokens for integration
          newUser.integration_settings = {
            google: {
              access_token: userData.tokens?.access_token,
              refresh_token: userData.tokens?.refresh_token,
              token_expiry: userData.tokens?.expires_in 
                ? new Date(Date.now() + (userData.tokens.expires_in * 1000)).toISOString()
                : null,
              id: userData.id,
              email: userData.email,
              connected_at: new Date().toISOString()
            }
          };
          
          console.log('💾 Saving Google tokens for new user');
        }
        
        const { data: createdUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert(newUser)
          .select()
          .single();
        
        if (createError) throw createError;
        user = createdUser;
      }
      
      console.log('✅ User saved to database:', user.email);
      
      // Create local session
      const session = {
        user: user,
        access_token: this.generateSessionToken(),
        provider: provider,
        created_at: new Date().toISOString()
      };
      
      this.currentUser = user;
      this.currentSession = session;
      
      // Store session locally
      this.store.set('session', session);
      this.store.set('user', user);
      
      console.log('💾 Session saved locally');
      
      return { user, session };
      
    } catch (error) {
      this.logger.error('Direct auth failed', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Generate a simple session token for local storage
   */
  generateSessionToken() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Determine user role based on email or default to 'sales'
   */
  determineUserRole(email) {
    if (!email) {
      return 'sales';
    }
    
    // Check for developer indicators in email
    const devKeywords = ['dev', 'engineer', 'tech', 'developer', 'code', 'software'];
    const emailLower = email.toLowerCase();
    
    for (const keyword of devKeywords) {
      if (emailLower.includes(keyword)) {
        return 'developer';
      }
    }
    
    // Default to sales
    return 'sales';
  }
}

module.exports = AuthService;

