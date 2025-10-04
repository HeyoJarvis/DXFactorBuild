/**
 * System IPC Handlers
 * Handles system-level operations
 */

const { ipcMain, app } = require('electron');

function registerSystemHandlers(services, logger) {
  /**
   * Get system status
   */
  ipcMain.handle('system:getStatus', async () => {
    try {
      // Get Slack status
      let slackStatus = { connected: false, error: 'Not initialized' };
      if (services.slack) {
        slackStatus = services.slack.getStatus();
      }

      // Get CRM status (async)
      let crmStatus = { connected: false, error: 'Not initialized' };
      if (services.crm) {
        try {
          crmStatus = await services.crm.getStatus();
        } catch (error) {
          crmStatus = { connected: false, error: error.message };
        }
      }

      // Get AI status
      const aiStatus = {
        connected: services.ai?.isInitialized || false,
        hasApiKey: !!process.env.ANTHROPIC_API_KEY,
        conversationLength: services.ai?.conversationHistory?.length || 0
      };

      const status = {
        slack: slackStatus,
        crm: crmStatus,
        ai: aiStatus,
        overall: {
          healthy: slackStatus.connected && crmStatus.connected && aiStatus.connected,
          services: {
            total: 3,
            connected: [slackStatus.connected, crmStatus.connected, aiStatus.connected].filter(Boolean).length
          }
        }
      };

      logger.debug('System status retrieved', {
        slack: slackStatus.connected,
        crm: crmStatus.connected,
        ai: aiStatus.connected
      });

      return {
        success: true,
        data: status
      };
    } catch (error) {
      logger.error('System getStatus error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get app info
   */
  ipcMain.handle('system:getAppInfo', async () => {
    try {
      return {
        success: true,
        data: {
          version: app.getVersion(),
          name: app.getName(),
          platform: process.platform
        }
      };
    } catch (error) {
      logger.error('System getAppInfo error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('System handlers registered');
}

module.exports = registerSystemHandlers;

