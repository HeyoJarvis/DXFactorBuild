/**
 * JIRA IPC Handlers
 * Handles all JIRA-related IPC communication
 */

const { ipcMain, shell } = require('electron');
const JIRAService = require('../services/JIRAService');
const JIRAOAuthHandler = require('../../../oauth/jira-oauth-handler');

let jiraOAuthHandler = null;
let jiraService = null;

function registerJIRAHandlers(services, logger) {
  // Initialize JIRA OAuth handler
  jiraOAuthHandler = new JIRAOAuthHandler({
    clientId: process.env.JIRA_CLIENT_ID,
    clientSecret: process.env.JIRA_CLIENT_SECRET,
    redirectUri: process.env.JIRA_REDIRECT_URI || 'http://localhost:8892/auth/jira/callback',
    port: 8892, // JIRA uses port 8892
    logger
  });

  // Initialize JIRA service
  jiraService = new JIRAService({
    logger,
    supabaseAdapter: services.dbAdapter
  });

  /**
   * Check if JIRA is connected
   */
  ipcMain.handle('jira:checkConnection', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        return {
          success: false,
          connected: false,
          error: 'User not authenticated'
        };
      }

      // Check if service is already initialized and ready to use
      const serviceReady = jiraService?.isInitialized && jiraService?.jiraCore;

      // If service is ready, it's connected! (Fast path)
      if (serviceReady) {
        logger.info('JIRA connection check: Service ready in memory');
        return {
          success: true,
          connected: true,
          source: 'memory'
        };
      }

      // Service not ready - check database for stored tokens
      const { data: userData, error: dbError } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      if (dbError) {
        logger.error('Failed to check JIRA connection in DB:', dbError);
        return {
          success: false,
          connected: false,
          error: dbError.message
        };
      }

      const jiraSettings = userData?.integration_settings?.jira;
      const hasTokens = jiraSettings?.access_token && jiraSettings?.authenticated === true;

      // If we have tokens but service isn't initialized, auto-initialize it!
      if (hasTokens) {
        logger.info('JIRA tokens found, auto-initializing service...', { userId });
        try {
          const initResult = await jiraService.initialize(userId);
          if (initResult.success && initResult.connected) {
            logger.info('✅ JIRA service auto-initialized successfully');
            // Start auto-sync
            jiraService.startAutoSync(userId, 10);
            return {
              success: true,
              connected: true,
              source: 'auto-init',
              siteUrl: jiraSettings?.site_url,
              cloudId: jiraSettings?.cloud_id
            };
          } else {
            logger.warn('JIRA auto-initialization failed', initResult);
            return {
              success: true,
              connected: false,
              error: initResult.error || 'Initialization failed'
            };
          }
        } catch (initError) {
          logger.error('JIRA auto-initialization error:', initError);
          return {
            success: true,
            connected: false,
            error: initError.message
          };
        }
      }

      // No tokens = never connected
      logger.info('JIRA connection check: No tokens found');
      return {
        success: true,
        connected: false,
        source: 'no-tokens'
      };

    } catch (error) {
      logger.error('JIRA connection check error:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  });

  /**
   * Authenticate with JIRA (OAuth flow)
   */
  ipcMain.handle('jira:authenticate', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Starting JIRA OAuth flow', { userId });

      // Start OAuth flow and wait for callback
      const authResult = await jiraOAuthHandler.startAuthFlow();

      // authResult contains: access_token, refresh_token, expires_in, cloud_id, site_url
      if (!authResult || !authResult.access_token) {
        throw new Error('Failed to get access token');
      }

      // Save tokens to Supabase
      const { data: currentUser } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const integrationSettings = currentUser?.integration_settings || {};
      integrationSettings.jira = {
        authenticated: true,
        access_token: authResult.access_token,
        refresh_token: authResult.refresh_token,
        token_expiry: new Date(Date.now() + (authResult.expires_in * 1000)).toISOString(),
        cloud_id: authResult.cloud_id,
        site_url: authResult.site_url,
        connected_at: new Date().toISOString()
      };

      const { error: updateError } = await services.dbAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Initialize JIRA service
      await jiraService.initialize(userId);

      // Start auto-sync
      jiraService.startAutoSync(userId, 10);

      logger.info('JIRA authenticated successfully', {
        userId,
        siteUrl: authResult.site_url
      });

      return {
        success: true,
        connected: true,
        siteUrl: authResult.site_url,
        cloudId: authResult.cloud_id
      };

    } catch (error) {
      logger.error('JIRA authentication error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Disconnect JIRA
   */
  ipcMain.handle('jira:disconnect', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Remove JIRA tokens from Supabase
      const { data: currentUser } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const integrationSettings = currentUser?.integration_settings || {};
      delete integrationSettings.jira;

      await services.dbAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      // Stop auto-sync
      jiraService.stopAutoSync();

      logger.info('JIRA disconnected', { userId });

      return {
        success: true
      };

    } catch (error) {
      logger.error('JIRA disconnect error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get user's JIRA issues
   */
  ipcMain.handle('jira:getMyIssues', async (event, options = {}) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure JIRA is initialized
      if (!jiraService.isConnected()) {
        await jiraService.initialize(userId);
      }

      const result = await jiraService.getMyIssues(options);

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('JIRA issues fetched', { count: result.issues.length });

      return {
        success: true,
        issues: result.issues,
        total: result.total
      };

    } catch (error) {
      logger.error('JIRA getMyIssues error:', error);
      return {
        success: false,
        error: error.message,
        issues: []
      };
    }
  });

  /**
   * Sync JIRA tasks to Supabase
   */
  ipcMain.handle('jira:syncTasks', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure JIRA is initialized
      if (!jiraService.isConnected()) {
        await jiraService.initialize(userId);
      }

      const result = await jiraService.syncTasks(userId);

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('JIRA tasks synced', {
        created: result.tasksCreated,
        updated: result.tasksUpdated
      });

      return {
        success: true,
        tasksCreated: result.tasksCreated,
        tasksUpdated: result.tasksUpdated,
        totalIssues: result.totalIssues
      };

    } catch (error) {
      logger.error('JIRA sync error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Update JIRA issue
   */
  ipcMain.handle('jira:updateIssue', async (event, issueKey, updateData) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('JIRA update issue request', { 
        issueKey, 
        updateFields: Object.keys(updateData),
        userId 
      });

      // Ensure JIRA is initialized
      if (!jiraService.isConnected()) {
        logger.info('JIRA not connected, initializing...', { userId });
        await jiraService.initialize(userId);
      }

      const result = await jiraService.updateIssue(issueKey, updateData);

      if (!result.success) {
        logger.error('JIRA update failed', { issueKey, error: result.error });
        throw new Error(result.error);
      }

      logger.info('JIRA issue updated successfully', { issueKey });

      return {
        success: true
      };

    } catch (error) {
      logger.error('JIRA update issue error', { 
        issueKey, 
        error: error.message,
        stack: error.stack 
      });
      return {
        success: false,
        error: `JIRA API error: ${error.message}`
      };
    }
  });

  /**
   * Transition JIRA issue (change status)
   */
  ipcMain.handle('jira:transitionIssue', async (event, issueKey, transitionName) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure JIRA is initialized
      if (!jiraService.isConnected()) {
        await jiraService.initialize(userId);
      }

      const result = await jiraService.transitionIssue(issueKey, transitionName);

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('JIRA issue transitioned', { issueKey, transitionName });

      return {
        success: true
      };

    } catch (error) {
      logger.error('JIRA transition issue error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get JIRA health status
   */
  ipcMain.handle('jira:healthCheck', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        return {
          status: 'disconnected',
          jira: 'user not authenticated'
        };
      }

      // Ensure JIRA is initialized
      if (!jiraService.isConnected()) {
        await jiraService.initialize(userId);
      }

      const health = await jiraService.healthCheck();

      return health;

    } catch (error) {
      logger.error('JIRA health check error:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  });

  logger.info('JIRA handlers registered');
}

module.exports = registerJIRAHandlers;

