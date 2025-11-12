/**
 * Auth IPC Handlers
 * Handles authentication operations
 */

const { ipcMain } = require('electron');

/**
 * Helper: Auto-initialize user integrations after successful login
 */
async function initializeUserIntegrations(services, userId, logger) {
  try {
    logger.info('🔄 Initializing user integrations post-login...', { userId });
    
    // Get user's integration settings
    const { data: userData, error } = await services.dbAdapter.supabase
      .from('users')
      .select('integration_settings')
      .eq('id', userId)
      .single();
    
    if (error || !userData) {
      logger.info('No integration settings found for user', { userId });
      return;
    }
    
    const integrations = userData?.integration_settings || {};
    
    // Initialize JIRA if tokens exist
    if (integrations.jira?.access_token && services.jira) {
      logger.info('🔗 Initializing JIRA service for user...', { userId });
      try {
        const result = await services.jira.initialize(userId);
        if (result.success && result.connected) {
          logger.info('✅ JIRA initialized and connected');
          services.jira.startAutoSync(userId, 10);
        }
      } catch (error) {
        logger.error('JIRA init failed:', error.message);
      }
    }
    
    // Initialize Google if tokens exist
    if (integrations.google?.access_token && services.google) {
      logger.info('🔗 Initializing Google service for user...', { userId });
      try {
        const result = await services.google.initialize(userId);
        if (result.success && result.connected) {
          logger.info('✅ Google initialized and connected');
        }
      } catch (error) {
        logger.error('Google init failed:', error.message);
      }
    }
    
    // Initialize Microsoft if tokens exist (check access_token instead of just authenticated flag)
    if (integrations.microsoft?.access_token && services.microsoft) {
      logger.info('🔗 Initializing Microsoft service for user...', {
        userId,
        authenticated: integrations.microsoft.authenticated,
        hasAccessToken: !!integrations.microsoft.access_token,
        hasRefreshToken: !!integrations.microsoft.refresh_token,
        account: integrations.microsoft.account
      });
      try {
        const result = await services.microsoft.initialize(userId);
        logger.info('Microsoft initialization result:', {
          success: result.success,
          connected: result.connected,
          error: result.error
        });
        if (result.success && result.connected) {
          logger.info('✅ Microsoft initialized and connected');
        } else {
          logger.warn('⚠️ Microsoft initialization did not result in connection', result);
        }
      } catch (error) {
        logger.error('Microsoft init failed:', {
          error: error.message,
          stack: error.stack
        });
      }
    } else {
      logger.info('Skipping Microsoft initialization', {
        hasAccessToken: !!integrations.microsoft?.access_token,
        authenticated: !!integrations.microsoft?.authenticated,
        hasService: !!services.microsoft
      });
    }
    
  } catch (error) {
    logger.error('Failed to initialize user integrations:', error.message);
    // Don't fail login if integrations fail
  }
}

function registerAuthHandlers(services, logger) {
  /**
   * Sign in with Email
   */
  ipcMain.handle('auth:signInWithEmail', async (event, email, password) => {
    try {
      if (!services.auth) {
        return { success: false, error: 'Auth service not initialized' };
      }

      logger.info('Starting email sign in...', { email });
      const result = await services.auth.signInWithEmail(email, password);
      
      if (result.success && result.user?.id) {
        logger.info('Email sign in successful', { user_id: result.user.id });
        
        // 🔥 Auto-initialize user's integrations
        await initializeUserIntegrations(services, result.user.id, logger);
      }
      
      return result;
    } catch (error) {
      logger.error('Email sign in failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Sign up with Email
   */
  ipcMain.handle('auth:signUpWithEmail', async (event, email, password) => {
    try {
      if (!services.auth) {
        return { success: false, error: 'Auth service not initialized' };
      }

      logger.info('Starting email sign up...', { email });
      const result = await services.auth.signUpWithEmail(email, password);
      
      if (result.success && result.user?.id) {
        logger.info('Email sign up successful', { user_id: result.user.id });
        
        // 🔥 Auto-initialize user's integrations
        await initializeUserIntegrations(services, result.user.id, logger);
      }
      
      return result;
    } catch (error) {
      logger.error('Email sign up failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Sign in with Microsoft (Teams)
   */
  ipcMain.handle('auth:signInWithMicrosoft', async () => {
    try {
      if (!services.auth) {
        return { success: false, error: 'Auth service not initialized' };
      }

      logger.info('Starting Microsoft sign in...');
      const result = await services.auth.signInWithMicrosoft();
      
      if (result.success && result.user?.id) {
        logger.info('Microsoft sign in successful', { user_id: result.user.id });
        
        // 🔥 Auto-initialize user's integrations
        await initializeUserIntegrations(services, result.user.id, logger);
      }
      
      return result;
    } catch (error) {
      logger.error('Microsoft sign in failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Sign in with Google
   */
  ipcMain.handle('auth:signInWithGoogle', async () => {
    try {
      if (!services.auth) {
        return { success: false, error: 'Auth service not initialized' };
      }

      logger.info('Starting Google sign in...');
      const result = await services.auth.signInWithGoogle();
      
      if (result.success && result.user?.id) {
        logger.info('Google sign in successful', { user_id: result.user.id });
        
        // 🔥 Auto-initialize user's integrations
        await initializeUserIntegrations(services, result.user.id, logger);
      }
      
      return result;
    } catch (error) {
      logger.error('Google sign in failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Sign out
   */
  ipcMain.handle('auth:signOut', async () => {
    try {
      if (!services.auth) {
        return { success: false, error: 'Auth service not initialized' };
      }

      logger.info('Signing out...');
      await services.auth.signOut();
      
      return { success: true };
    } catch (error) {
      logger.error('Sign out failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get current session
   */
  ipcMain.handle('auth:getSession', async () => {
    try {
      if (!services.auth) {
        return { success: false, session: null };
      }

      // Load session from local storage if not in memory
      if (!services.auth.currentSession) {
        const result = await services.auth.loadSession();
        if (result) {
          return { success: true, session: result };
        }
        return { success: false, session: null };
      }

      // Return current session
      return { 
        success: true, 
        session: {
          user: services.auth.currentUser,
          session: services.auth.currentSession
        }
      };
    } catch (error) {
      logger.error('Get session failed:', error);
      return { success: false, session: null, error: error.message };
    }
  });

  /**
   * Get current user
   */
  ipcMain.handle('auth:getCurrentUser', async () => {
    try {
      if (!services.auth) {
        return { success: false, user: null };
      }

      const user = services.auth.currentUser;
      return { success: true, user };
    } catch (error) {
      logger.error('Get current user failed:', error);
      return { success: false, user: null, error: error.message };
    }
  });

  logger.info('Auth handlers registered');
}

module.exports = registerAuthHandlers;

