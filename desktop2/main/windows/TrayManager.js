/**
 * Tray Manager
 * Handles system tray icon and menu
 */

const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

class TrayManager {
  constructor({ logger, windows }) {
    this.logger = logger;
    this.windows = windows;
    this.tray = null;
  }

  /**
   * Create the system tray
   */
  create() {
    try {
      // Create a simple icon (you'll want to replace this with a proper icon)
      const icon = nativeImage.createEmpty();
      this.tray = new Tray(icon);

      this.tray.setToolTip('HeyJarvis v2');
      
      // Build context menu
      this.updateMenu();

      // Handle click
      this.tray.on('click', () => {
        this.windows.main?.toggle();
      });

      this.logger.info('System tray created');
    } catch (error) {
      this.logger.error('Failed to create tray:', error);
    }
  }

  /**
   * Update the tray menu
   */
  updateMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show HeyJarvis',
        click: () => this.windows.main?.show()
      },
      {
        label: 'Hide HeyJarvis',
        click: () => this.windows.main?.hide()
      },
      { type: 'separator' },
      {
        label: 'Toggle Copilot',
        click: () => this.windows.copilot?.toggle()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ]);

    if (this.tray) {
      this.tray.setContextMenu(contextMenu);
    }
  }

  /**
   * Destroy the tray
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = TrayManager;

