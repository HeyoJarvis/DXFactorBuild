/**
 * Sync IPC Handlers
 * Handles data synchronization for JIRA and GitHub
 */

const { ipcMain } = require('electron');
const Store = require('electron-store');
const store = new Store();

function registerSyncHandlers(services) {
  const { taskCodeIntelligenceService, supabaseAdapter, logger } = services;

  /**
   * Get updates from database (fast!)
   */
  ipcMain.handle('sync:getUpdates', async (event, options) => {
    try {
      // Get userId from session
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }
      
      const { days = 7 } = options || {};
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      logger.info('IPC: sync:getUpdates (from database)', { userId: session.user.id, days });
      
      const result = await supabaseAdapter.getTeamUpdates(session.user.id, {
        start_date: startDate
      });
      
      if (result.success) {
        const updates = result.updates || [];
        const githubCount = updates.filter(u => u.update_type.startsWith('github_')).length;
        const jiraCount = updates.filter(u => u.update_type.startsWith('jira_')).length;
        
        return {
          success: true,
          updates,
          stats: {
            github: githubCount,
            jira: jiraCount
          }
        };
      }
      
      return result;
    } catch (error) {
      logger.error('IPC Error: sync:getUpdates', { error: error.message });
      return { success: false, error: error.message, updates: [] };
    }
  });

  /**
   * Fetch all updates from APIs (slower, use for Sync Now)
   */
  ipcMain.handle('sync:fetchAll', async (event, options) => {
    try {
      // Get userId from session
      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }
      
      logger.info('IPC: sync:fetchAll (from APIs)', { userId: session.user.id, options });
      return await taskCodeIntelligenceService.fetchAllUpdates(session.user.id, options);
    } catch (error) {
      logger.error('IPC Error: sync:fetchAll', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Fetch JIRA updates
   */
  ipcMain.handle('sync:fetchJIRA', async (event, userId, options) => {
    try {
      logger.info('IPC: sync:fetchJIRA', { userId, options });
      return await taskCodeIntelligenceService.fetchJIRAUpdates(userId, options);
    } catch (error) {
      logger.error('IPC Error: sync:fetchJIRA', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Fetch GitHub updates
   */
  ipcMain.handle('sync:fetchGitHub', async (event, userId, options) => {
    try {
      logger.info('IPC: sync:fetchGitHub', { userId, options });
      return await taskCodeIntelligenceService.fetchGitHubUpdates(userId, options);
    } catch (error) {
      logger.error('IPC Error: sync:fetchGitHub', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Link updates to meeting
   */
  ipcMain.handle('sync:linkToMeeting', async (event, meetingId, updateIds) => {
    try {
      logger.info('IPC: sync:linkToMeeting', { meetingId, updateIds });
      return await taskCodeIntelligenceService.linkUpdatesToMeeting(meetingId, updateIds);
    } catch (error) {
      logger.error('IPC Error: sync:linkToMeeting', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  logger.info('Sync IPC handlers registered');
}

module.exports = { registerSyncHandlers };


