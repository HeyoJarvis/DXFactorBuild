/**
 * Auth IPC Handlers
 * Real authentication using Supabase
 */

const { ipcMain } = require('electron');
const Store = require('electron-store');
const store = new Store();

function registerAuthHandlers(services) {
  const { logger, supabaseAdapter, microsoftOAuthService, jiraOAuthService, githubOAuthService, backgroundSyncService } = services;
  
  logger.info('Auth IPC handlers registered');

  /**
   * Login with email and password
   */
  ipcMain.handle('auth:login', async (event, email, password) => {
    try {
      logger.info('IPC: auth:login', { email });

      const { data, error } = await supabaseAdapter.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        logger.error('Login failed', { error: error.message });
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session) {
        logger.error('Login failed - no user or session data returned');
        return { success: false, error: 'Login failed - please try again' };
      }

      const user = {
        id: data.user.id,
        email: data.user.email,
        name: email.split('@')[0]
      };

      // Store session
      store.set('session', {
        user,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      });

      // Start background sync for this user
      if (backgroundSyncService) {
        backgroundSyncService.start(user.id);
      }

      logger.info('Login successful', { userId: user.id });

      return {
        success: true,
        user
      };
    } catch (error) {
      logger.error('IPC Error: auth:login', { error: error.message, stack: error.stack });
      return { success: false, error: error.message || 'An unexpected error occurred during login' };
    }
  });

  /**
   * Signup with email and password
   */
  ipcMain.handle('auth:signup', async (event, email, password) => {
    try {
      logger.info('IPC: auth:signup', { email });

      const { data, error } = await supabaseAdapter.supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        logger.error('Signup failed', { error: error.message });
        return { success: false, error: error.message };
      }

      if (!data.user) {
        logger.error('Signup failed - no user data returned');
        return { success: false, error: 'Failed to create user account' };
      }

      // Check if email confirmation is required
      if (!data.session) {
        logger.info('Email confirmation required', { email });
        return {
          success: false,
          error: 'Please check your email to confirm your account before logging in.',
          requiresConfirmation: true
        };
      }

      const user = {
        id: data.user.id,
        email: data.user.email,
        name: email.split('@')[0]
      };

      // Store session
      store.set('session', {
        user,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      });

      logger.info('Signup successful', { userId: user.id });

      return {
        success: true,
        user
      };
    } catch (error) {
      logger.error('IPC Error: auth:signup', { error: error.message, stack: error.stack });
      return { success: false, error: error.message || 'An unexpected error occurred during signup' };
    }
  });

  /**
   * Get current session
   */
  ipcMain.handle('auth:getSession', async (event) => {
    try {
      const session = store.get('session');
      
      if (!session || !session.user) {
        return { success: false, error: 'No session found' };
      }

      // Start background sync if not already running
      if (backgroundSyncService) {
        backgroundSyncService.start(session.user.id);
      }

      logger.info('Session retrieved', { userId: session.user.id });

      return {
        success: true,
        user: session.user
      };
    } catch (error) {
      logger.error('IPC Error: auth:getSession', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Logout
   */
  ipcMain.handle('auth:logout', async (event) => {
    try {
      logger.info('IPC: auth:logout');

      // Stop background sync
      if (backgroundSyncService) {
        backgroundSyncService.stop();
      }

      await supabaseAdapter.supabase.auth.signOut();
      store.delete('session');

      return { success: true };
    } catch (error) {
      logger.error('IPC Error: auth:logout', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Initialize services with user tokens
   * NOTE: This checks for OAuth tokens in team_sync_integrations table
   * This is SEPARATE from desktop2 - no conflicts!
   */
  ipcMain.handle('auth:initializeServices', async (event, userId) => {
    try {
      logger.info('IPC: auth:initializeServices', { userId });

      // Check if user has connected integrations in team_sync_integrations table
      const { data: integrations, error } = await supabaseAdapter.supabase
        .from('team_sync_integrations')
        .select('service_name, connected_at')
        .eq('user_id', userId);

      if (error) {
        logger.warn('Failed to check integrations', { error: error.message });
      }

      const connectedServices = integrations || [];
      const microsoftConnected = connectedServices.some(i => i.service_name === 'microsoft');
      const jiraConnected = connectedServices.some(i => i.service_name === 'jira');
      const githubConnected = connectedServices.some(i => i.service_name === 'github');

      logger.info('Integration status checked', {
        userId,
        microsoft: microsoftConnected,
        jira: jiraConnected,
        github: githubConnected
      });

      return {
        success: true,
        microsoft: microsoftConnected,
        jira: jiraConnected,
        github: githubConnected
      };
    } catch (error) {
      logger.error('IPC Error: auth:initializeServices', { error: error.message });
      return {
        success: true, // Don't fail on error
        microsoft: false,
        jira: false,
        github: false
      };
    }
  });

  /**
   * Check integration status
   * Checks team_sync_integrations table (SEPARATE from desktop2)
   */
  ipcMain.handle('auth:checkStatus', async (event) => {
    try {
      logger.info('IPC: auth:checkStatus');

      const session = store.get('session');
      if (!session || !session.user) {
        return {
          success: true,
          connections: {
            microsoft: false,
            jira: false,
            github: false
          }
        };
      }

      // Check integrations in team_sync_integrations table
      const { data: integrations, error } = await supabaseAdapter.supabase
        .from('team_sync_integrations')
        .select('service_name')
        .eq('user_id', session.user.id);

      if (error) {
        logger.warn('Failed to check integrations status', { error: error.message });
        return {
          success: true,
          connections: {
            microsoft: false,
            jira: false,
            github: false
          }
        };
      }

      const services = integrations || [];
      const microsoft = services.some(i => i.service_name === 'microsoft');
      const jira = services.some(i => i.service_name === 'jira');
      const github = services.some(i => i.service_name === 'github');

      return {
        success: true,
        connections: {
          microsoft,
          jira,
          github
        }
      };
    } catch (error) {
      logger.error('IPC Error: auth:checkStatus', { error: error.message });
      return {
        success: true, // Don't fail the UI
        connections: {
          microsoft: false,
          jira: false,
          github: false
        }
      };
    }
  });

  /**
   * Connect Microsoft integration
   * Real OAuth flow implementation
   */
  ipcMain.handle('auth:connectMicrosoft', async (event) => {
    try {
      logger.info('IPC: auth:connectMicrosoft');
      
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session. Please log in first.' };
      }
      
      // Start OAuth flow
      const result = await microsoftOAuthService.startAuthFlow(session.user.id);
      
      logger.info('Microsoft OAuth completed', { userId: session.user.id });
      
      return result;
    } catch (error) {
      logger.error('IPC Error: auth:connectMicrosoft', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Connect JIRA integration
   * Real OAuth flow implementation
   */
  ipcMain.handle('auth:connectJIRA', async (event) => {
    try {
      logger.info('IPC: auth:connectJIRA');
      
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session. Please log in first.' };
      }
      
      // Start OAuth flow
      const result = await jiraOAuthService.startAuthFlow(session.user.id);
      
      logger.info('JIRA OAuth completed', { userId: session.user.id });
      
      return result;
    } catch (error) {
      logger.error('IPC Error: auth:connectJIRA', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Connect GitHub integration
   * Real OAuth flow implementation
   */
  ipcMain.handle('auth:connectGitHub', async (event) => {
    try {
      logger.info('IPC: auth:connectGitHub');
      
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session. Please log in first.' };
      }
      
      // Check if GitHub is configured
      if (!githubOAuthService.isConfigured()) {
        return {
          success: false,
          error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env, or use GITHUB_TOKEN for personal access token.'
        };
      }
      
      // Start OAuth flow
      const result = await githubOAuthService.startAuthFlow(session.user.id);
      
      logger.info('GitHub OAuth completed', { userId: session.user.id });
      
      return result;
    } catch (error) {
      logger.error('IPC Error: auth:connectGitHub', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Disconnect integration
   * Real implementation
   */
  ipcMain.handle('auth:disconnect', async (event, service) => {
    try {
      logger.info('IPC: auth:disconnect', { service });
      
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session.' };
      }
      
      let result;
      switch (service.toLowerCase()) {
        case 'microsoft':
          result = await microsoftOAuthService.disconnect(session.user.id);
          break;
        case 'jira':
          result = await jiraOAuthService.disconnect(session.user.id);
          break;
        case 'github':
          result = await githubOAuthService.disconnect(session.user.id);
          break;
        default:
          return { success: false, error: `Unknown service: ${service}` };
      }
      
      logger.info('Service disconnected', { service, userId: session.user.id });
      
      return result;
    } catch (error) {
      logger.error('IPC Error: auth:disconnect', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  logger.info('Auth IPC handlers registered');
}

module.exports = { registerAuthHandlers };

