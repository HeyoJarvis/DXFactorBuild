/**
 * Auth IPC Handlers
 * Handles authentication operations
 */

const { ipcMain } = require('electron');

function registerAuthHandlers(services, logger) {
  /**
   * Sign in with Slack
   */
  ipcMain.handle('auth:signInWithSlack', async () => {
    try {
      if (!services.auth) {
        return { success: false, error: 'Auth service not initialized' };
      }

      logger.info('Starting Slack sign in...');
      const result = await services.auth.signInWithSlack();
      
      if (result.success) {
        logger.info('Slack sign in successful', { user_id: result.user?.id });
      }
      
      return result;
    } catch (error) {
      logger.error('Slack sign in failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Sign in with Microsoft Teams
   */
  ipcMain.handle('auth:signInWithTeams', async () => {
    try {
      if (!services.auth) {
        return { success: false, error: 'Auth service not initialized' };
      }

      logger.info('Starting Teams sign in...');
      const result = await services.auth.signInWithMicrosoft();
      
      if (result.success) {
        logger.info('Teams sign in successful', { user_id: result.user?.id });
      }
      
      return result;
    } catch (error) {
      logger.error('Teams sign in failed:', error);
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

