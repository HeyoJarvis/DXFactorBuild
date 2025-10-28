/**
 * Confluence IPC Handlers
 * Handles all Confluence documentation-related IPC communication
 * Uses JIRA OAuth tokens (same Atlassian account)
 */

const { ipcMain } = require('electron');
const ConfluenceService = require('../../../core/integrations/confluence-service');

let confluenceService = null;

function registerConfluenceHandlers(services, logger) {
  // Initialize Confluence service
  confluenceService = new ConfluenceService({
    logger,
    logLevel: process.env.LOG_LEVEL || 'info'
  });

  /**
   * Check if Confluence is available (uses JIRA tokens)
   */
  ipcMain.handle('confluence:checkConnection', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        return {
          success: false,
          connected: false,
          error: 'User not authenticated'
        };
      }

      // Check if we have JIRA tokens (same Atlassian account)
      const { data: userData, error: dbError } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      if (dbError) {
        logger.error('Failed to check Confluence connection:', dbError);
        return {
          success: false,
          connected: false,
          error: dbError.message
        };
      }

      const jiraSettings = userData?.integration_settings?.jira;
      
      // Log for debugging
      logger.info('Confluence connection check', {
        userId,
        hasJiraSettings: !!jiraSettings,
        hasAccessToken: !!jiraSettings?.access_token,
        hasCloudId: !!jiraSettings?.cloud_id,
        authenticated: jiraSettings?.authenticated
      });
      
      // Check if we have the required tokens (authenticated flag might be missing in older connections)
      const hasTokens = jiraSettings?.access_token && jiraSettings?.cloud_id;

      if (hasTokens) {
        // Set tokens in Confluence service
        confluenceService.setTokens({
          accessToken: jiraSettings.access_token,
          cloudId: jiraSettings.cloud_id,
          siteUrl: jiraSettings.site_url
        });

        logger.info('Confluence ready (using JIRA tokens)', { userId });
        
        return {
          success: true,
          connected: true,
          siteUrl: jiraSettings.site_url
        };
      }

      logger.info('Confluence not available - JIRA not connected', { userId });
      
      return {
        success: true,
        connected: false,
        message: 'Connect to JIRA first to enable Confluence'
      };

    } catch (error) {
      logger.error('Confluence connection check error:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  });

  /**
   * Get all available Confluence spaces
   */
  ipcMain.handle('confluence:getSpaces', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure tokens are set
      await ensureTokens(userId, services, logger);

      const spaces = await confluenceService.getSpaces();

      logger.info('Fetched Confluence spaces', {
        userId,
        count: spaces.length
      });

      return {
        success: true,
        spaces: spaces.map(space => ({
          key: space.key,
          name: space.name,
          type: space.type,
          id: space.id
        }))
      };

    } catch (error) {
      logger.error('Failed to fetch Confluence spaces:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Create a new Confluence page
   */
  ipcMain.handle('confluence:createPage', async (event, { spaceKey, title, content, parentId }) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure tokens are set
      await ensureTokens(userId, services, logger);

      const result = await confluenceService.createPage({
        spaceKey,
        title,
        content,
        parentId
      });

      logger.info('Created Confluence page', {
        userId,
        pageId: result.id,
        title: result.title
      });

      return {
        success: true,
        page: result
      };

    } catch (error) {
      logger.error('Failed to create Confluence page:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Update an existing Confluence page
   */
  ipcMain.handle('confluence:updatePage', async (event, { pageId, title, content, version }) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure tokens are set
      await ensureTokens(userId, services, logger);

      const result = await confluenceService.updatePage({
        pageId,
        title,
        content,
        version
      });

      logger.info('Updated Confluence page', {
        userId,
        pageId: result.id,
        version: result.version
      });

      return {
        success: true,
        page: result
      };

    } catch (error) {
      logger.error('Failed to update Confluence page:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Search Confluence pages
   */
  ipcMain.handle('confluence:searchPages', async (event, { query, spaceKey }) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure tokens are set
      await ensureTokens(userId, services, logger);

      const results = await confluenceService.searchPages(query, spaceKey);

      logger.info('Searched Confluence pages', {
        userId,
        query,
        count: results.length
      });

      return {
        success: true,
        results: results.map(page => ({
          id: page.id,
          title: page.title,
          type: page.type,
          spaceKey: page.space?.key
        }))
      };

    } catch (error) {
      logger.error('Failed to search Confluence pages:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get a specific page
   */
  ipcMain.handle('confluence:getPage', async (event, { pageId }) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Ensure tokens are set
      await ensureTokens(userId, services, logger);

      const page = await confluenceService.getPage(pageId);

      logger.info('Fetched Confluence page', {
        userId,
        pageId: page.id,
        title: page.title
      });

      return {
        success: true,
        page
      };

    } catch (error) {
      logger.error('Failed to fetch Confluence page:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('✅ Confluence IPC handlers registered');
}

/**
 * Helper function to ensure tokens are set in the service
 */
async function ensureTokens(userId, services, logger) {
  // Check if tokens are already set
  if (confluenceService.accessToken && confluenceService.cloudId) {
    return;
  }

  // Fetch from database
  const { data: userData, error: dbError } = await services.dbAdapter.supabase
    .from('users')
    .select('integration_settings')
    .eq('id', userId)
    .single();

  if (dbError) {
    throw new Error(`Database error: ${dbError.message}`);
  }

  const jiraSettings = userData?.integration_settings?.jira;
  
  if (!jiraSettings?.access_token || !jiraSettings?.authenticated) {
    throw new Error('JIRA not connected. Please connect JIRA first.');
  }

  // Set tokens
  confluenceService.setTokens({
    accessToken: jiraSettings.access_token,
    cloudId: jiraSettings.cloud_id,
    siteUrl: jiraSettings.site_url
  });

  logger.info('Confluence tokens configured from JIRA', { userId });
}

module.exports = { registerConfluenceHandlers };

