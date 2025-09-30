/**
 * Ultimate Context IPC Handlers for Electron Desktop App
 * 
 * This module handles IPC communication between the renderer process and the ultimate context system.
 */

const { ipcMain } = require('electron');
const UltimateContextManager = require('../main/ultimate-context-manager');

class UltimateContextHandlers {
  constructor() {
    this.contextManager = new UltimateContextManager();
    this.setupHandlers();
  }

  /**
   * Setup IPC handlers for ultimate context operations
   */
  setupHandlers() {
    // Initialize ultimate context system
    ipcMain.handle('ultimate-context:initialize', async (event, { organizationId, crmConfig }) => {
      try {
        const result = await this.contextManager.initialize(organizationId, crmConfig);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Process chat session with fresh Slack data
    ipcMain.handle('ultimate-context:process-session', async (event, { organizationId, sessionId, freshSlackWorkflows }) => {
      try {
        const result = await this.contextManager.processSession(organizationId, sessionId, freshSlackWorkflows);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Generate recommendations for a specific session
    ipcMain.handle('ultimate-context:generate-recommendations', async (event, { organizationId, userQuery, sessionId }) => {
      try {
        const result = await this.contextManager.generateRecommendations(organizationId, userQuery, sessionId || 'default');
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Get ultimate context
    ipcMain.handle('ultimate-context:get-context', async (event, { organizationId }) => {
      try {
        const context = this.contextManager.getUltimateContext(organizationId);
        return { success: true, data: context };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Get context summary
    ipcMain.handle('ultimate-context:get-summary', async (event, { organizationId }) => {
      try {
        const summary = this.contextManager.getContextSummary(organizationId);
        return { success: true, data: summary };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Refresh context
    ipcMain.handle('ultimate-context:refresh', async (event, { organizationId, crmConfig }) => {
      try {
        const result = await this.contextManager.refreshContext(organizationId, crmConfig);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Clear context
    ipcMain.handle('ultimate-context:clear', async (event, { organizationId }) => {
      try {
        this.contextManager.clearContext(organizationId);
        return { success: true, data: { organizationId, cleared: true } };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Get cached organizations
    ipcMain.handle('ultimate-context:get-cached-organizations', async (event) => {
      try {
        const organizations = this.contextManager.getCachedOrganizations();
        return { success: true, data: organizations };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Check if context exists
    ipcMain.handle('ultimate-context:exists', async (event, { organizationId }) => {
      try {
        const summary = this.contextManager.getContextSummary(organizationId);
        return { success: true, data: { exists: summary.hasContext, summary } };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Get the context manager instance
   * @returns {UltimateContextManager} Context manager instance
   */
  getContextManager() {
    return this.contextManager;
  }
}

module.exports = UltimateContextHandlers;
