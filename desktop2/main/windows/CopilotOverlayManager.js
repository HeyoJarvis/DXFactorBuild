/**
 * Copilot Overlay Manager
 * Handles the floating copilot overlay window
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');

class CopilotOverlayManager {
  constructor({ logger }) {
    this.logger = logger;
    this.window = null;
    this.isExpanded = false;
  }

  /**
   * Create the copilot overlay
   */
  create() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.bounds;
    
    const barWidth = Math.min(480, screenWidth * 0.35);
    const barHeight = 680;
    const xPosition = Math.floor((screenWidth - barWidth) / 2);

    this.window = new BrowserWindow({
      width: barWidth,
      height: 60, // Start collapsed
      x: xPosition,
      y: 10,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../../bridge/copilot-preload.js')
      },
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: true,
      show: false,
      titleBarStyle: 'hidden',
      vibrancy: 'ultra-dark',
      backgroundMaterial: 'acrylic',
      opacity: 0.95,
      hasShadow: true,
      type: 'panel'
    });

    const isDev = process.env.NODE_ENV === 'development';
    const url = isDev
      ? 'http://localhost:5173#/copilot'
      : `file://${path.join(__dirname, '../../renderer2/dist/index.html#/copilot')}`;

    this.window.loadURL(url);

    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    this.logger.info('Copilot overlay created');
    return this.window;
  }

  /**
   * Expand the overlay
   */
  expand() {
    if (!this.window) return;
    
    this.window.setSize(this.window.getSize()[0], 680);
    this.isExpanded = true;
  }

  /**
   * Collapse the overlay
   */
  collapse() {
    if (!this.window) return;
    
    this.window.setSize(this.window.getSize()[0], 60);
    this.isExpanded = false;
  }

  /**
   * Toggle expansion state
   */
  toggle() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  /**
   * Show the overlay
   */
  show() {
    if (this.window) {
      this.window.show();
    }
  }

  /**
   * Hide the overlay
   */
  hide() {
    if (this.window) {
      this.window.hide();
    }
  }

  /**
   * Get the window instance
   */
  getWindow() {
    return this.window;
  }

  /**
   * Destroy the overlay
   */
  destroy() {
    if (this.window) {
      this.window.destroy();
      this.window = null;
    }
  }
}

module.exports = CopilotOverlayManager;

