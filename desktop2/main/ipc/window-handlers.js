/**
 * Window IPC Handlers
 * Handles window management operations
 */

const { ipcMain } = require('electron');

function registerWindowHandlers(windows, logger) {
  /**
   * Show main window
   */
  ipcMain.handle('window:showMain', async () => {
    try {
      windows.main?.show();
      return { success: true };
    } catch (error) {
      logger.error('Window showMain error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Hide main window
   */
  ipcMain.handle('window:hideMain', async () => {
    try {
      windows.main?.hide();
      return { success: true };
    } catch (error) {
      logger.error('Window hideMain error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Toggle copilot overlay
   */
  ipcMain.handle('window:toggleCopilot', async () => {
    try {
      if (!windows.copilot?.getWindow()) {
        windows.copilot?.create();
      } else {
        windows.copilot?.toggle();
      }
      return { success: true };
    } catch (error) {
      logger.error('Window toggleCopilot error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Expand copilot
   */
  ipcMain.handle('window:expandCopilot', async () => {
    try {
      // Expand main window to full chat interface
      windows.main?.expandToFullChat();
      return { success: true };
    } catch (error) {
      logger.error('Window expandCopilot error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Collapse copilot
   */
  ipcMain.handle('window:collapseCopilot', async () => {
    try {
      // Collapse main window back to header
      windows.main?.collapseToHeader();
      return { success: true };
    } catch (error) {
      logger.error('Window collapseCopilot error:', error);
      return { success: false, error: error.message };
    }
  });

  logger.info('Window handlers registered');
}

module.exports = registerWindowHandlers;

