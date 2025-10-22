/**
 * Window IPC Handlers
 * Handles window management operations
 */

const { ipcMain } = require('electron');

let mouseEventsIgnored = false; // Track current state - matches initial window state from MainWindowManager

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
   * Open secondary window (Tasks/Copilot UI)
   */
  ipcMain.handle('window:openSecondary', async (event, route = '/tasks') => {
    try {
      if (!windows.secondary) {
        logger.error('Secondary window manager not initialized');
        return { success: false, error: 'Secondary window not available' };
      }

      // Create or show the secondary window
      windows.secondary.create(route);
      logger.info('Secondary window opened', { route });
      
      return { success: true };
    } catch (error) {
      logger.error('Window openSecondary error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Navigate secondary window
   */
  ipcMain.handle('window:navigateSecondary', async (event, route) => {
    try {
      if (!windows.secondary) {
        return { success: false, error: 'Secondary window not available' };
      }

      windows.secondary.navigate(route);
      return { success: true };
    } catch (error) {
      logger.error('Window navigateSecondary error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Expand copilot (legacy - now opens secondary window)
   */
  ipcMain.handle('window:expandCopilot', async () => {
    try {
      // Open secondary window instead of expanding main
      if (windows.secondary) {
        windows.secondary.create('/copilot');
      }
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

  /**
   * Set mouse event forwarding (for transparent window)
   */
  ipcMain.handle('window:setMouseForward', async (event, shouldForward) => {
    try {
      const mainWindow = windows.main?.getWindow();
      if (!mainWindow) {
        return { success: false, error: 'Main window not found' };
      }

      if (shouldForward !== mouseEventsIgnored) {
        mouseEventsIgnored = shouldForward;
        mainWindow.setIgnoreMouseEvents(shouldForward, { forward: true });
        logger.debug('Mouse event forwarding:', { shouldForward });
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to set mouse forwarding:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Move window to specific position
   */
  ipcMain.handle('window:moveWindow', async (event, x, y) => {
    try {
      const mainWindow = windows.main?.getWindow();
      if (!mainWindow) {
        return { success: false, error: 'Main window not found' };
      }

      const currentBounds = mainWindow.getBounds();
      mainWindow.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: currentBounds.width,
        height: currentBounds.height
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to move window:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Resize window for menu open/close
   */
  ipcMain.handle('window:resizeForMenu', async (event, isOpen) => {
    try {
      const mainWindow = windows.main?.getWindow();
      if (!mainWindow) {
        return { success: false, error: 'Main window not found' };
      }

      const currentBounds = mainWindow.getBounds();
      
      if (isOpen) {
        // Expand to show menu (wider)
        mainWindow.setBounds({
          x: currentBounds.x,
          y: currentBounds.y,
          width: 380, // Wide enough for orb + menu
          height: 280 // Tall enough for menu items
        });
      } else {
        // Collapse to just orb (slightly bigger to not cut off glow)
        mainWindow.setBounds({
          x: currentBounds.x,
          y: currentBounds.y,
          width: 220,
          height: 220
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to resize window:', error);
      return { success: false, error: error.message };
    }
  });

  logger.info('Window handlers registered');
}

module.exports = registerWindowHandlers;

