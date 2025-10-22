/**
 * GitHub IPC Handlers
 * Handles GitHub repository operations
 */

const { ipcMain } = require('electron');
const Store = require('electron-store');
const store = new Store();

function registerGitHubHandlers(services) {
  const { taskCodeIntelligenceService, logger } = services;

  /**
   * List all accessible repositories
   */
  ipcMain.handle('github:listRepositories', async (event) => {
    try {
      logger.info('📚 Listing GitHub repositories');

      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }

      // Use githubService directly since it has the listRepositories method
      const githubService = taskCodeIntelligenceService.githubService;
      if (!githubService) {
        logger.warn('GitHub service not available');
        return { success: false, error: 'GitHub service not available', repositories: [] };
      }

      const repositories = await githubService.listRepositories(session.user.id);
      
      logger.info('✅ Listed repositories', { count: repositories.length });
      
      return {
        success: true,
        repositories
      };
    } catch (error) {
      logger.error('IPC Error: github:listRepositories', { error: error.message });
      return { success: false, error: error.message, repositories: [] };
    }
  });

  /**
   * Get repository details
   */
  ipcMain.handle('github:getRepository', async (event, params) => {
    try {
      const { owner, repo } = params;
      logger.info('Fetching repository details', { owner, repo });

      const session = store.get('session');
      if (!session || !session.user) {
        return { success: false, error: 'No active session' };
      }

      const repository = await taskCodeIntelligenceService.getRepository(
        session.user.id,
        owner,
        repo
      );
      
      return {
        success: true,
        repository
      };
    } catch (error) {
      logger.error('IPC Error: github:getRepository', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  logger.info('GitHub IPC handlers registered');
}

module.exports = { registerGitHubHandlers };

