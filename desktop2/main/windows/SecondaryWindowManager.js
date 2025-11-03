/**
 * Secondary Window Manager
 * Manages the main UI window (Tasks/Copilot) that opens separately from the Arc Reactor orb
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class SecondaryWindowManager {
  constructor(logger, mainWindowManager = null, ipcMain = null) {
    this.logger = logger;
    this.window = null;
    this.mainWindowManager = mainWindowManager;
    this.ipcMain = ipcMain;
    this.currentRoute = '/tasks'; // Default route
  }

  /**
   * Create the secondary window
   *
   * NOTE: This configuration supports the enterprise login flow with native translucency:
   * - macOS: Uses 'sidebar' vibrancy for liquid glass effect
   * - Windows 11: Uses 'acrylic' background material
   * - Transparent background with backdrop-filter CSS fallback
   * - Dimensions: 1120×760 (optimal for login flow)
   */
  create(route = '/tasks') {
    if (this.window) {
      // Window already exists, just show it and navigate
      this.show();
      this.navigate(route);
      return this.window;
    }

    const isDev = process.env.NODE_ENV === 'development';
    this.currentRoute = route;

    this.window = new BrowserWindow({
      width: 1280,
      height: 820,
      show: false,
      backgroundColor: '#fafafa', // Light background
      frame: true, // Native window frame with title bar and controls
      resizable: true, // Allow window resizing
      movable: true, // Allow window dragging
      center: true, // Center the window on screen
      title: 'HeyJarvis', // Window title
      ...(process.platform === 'darwin' ? {
        titleBarStyle: 'hiddenInset', // macOS: Hide title bar but keep traffic lights
        roundedCorners: true
      } : {}),
      ...(process.platform === 'win32' ? {
        backgroundMaterial: 'acrylic' // Windows 11 native acrylic effect
      } : {}),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../../bridge/preload.js'),
        ...(process.platform === 'darwin' ? {
          scrollBounce: true // macOS-style scroll bounce
        } : {})
      }
    });

    // Load the app with the specified route
    const url = isDev 
      ? `http://localhost:5173/#${route}`
      : `file://${path.join(__dirname, '../../renderer2/dist/index.html')}#${route}`;
    
    this.window.loadURL(url);

    // Show when ready
    this.window.once('ready-to-show', () => {
      this.logger.info('Secondary window ready to show');
      
      // CRITICAL: Ensure mouse events are NOT ignored (this is a clickable window)
      this.window.setIgnoreMouseEvents(false);
      this.logger.info('Mouse events enabled for secondary window');
      
      this.window.show();
      
      // Maximize the window to fill the screen (like a normal desktop app)
      this.window.maximize();
      this.logger.info('Secondary window maximized');
      
      // NOTE: Secondary window should behave like a NORMAL desktop window
      // - NOT always-on-top (removed setupMaximumVisibility and setupEnhancedAlwaysOnTop)
      // - Can be closed with traffic lights
      // - Can be minimized
      // - Stays on the desktop/workspace it was opened on
      // - Doesn't float above everything
      this.logger.info('Secondary window configured as normal desktop window (not always-on-top)');
      
      // Hide the orb when secondary window opens
      if (this.mainWindowManager) {
        this.mainWindowManager.setOrbVisibility(false);
      }
      
      // Emit window state change event (secondary window is open)
      if (this.ipcMain) {
        this.ipcMain.emit('window:secondaryWindowChange', true, route);
        this.logger.info('Emitted secondary window open event', { route });
      }
      
      // Also send to main window renderer if available
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', true, route);
        this.logger.info('Sent secondary window open event to main window renderer', { route });
      }
      
      // Don't open dev tools for secondary window in production
      // if (isDev) {
      //   this.window.webContents.openDevTools({ mode: 'detached' });
      // }
    });

    // Handle window close - ACTUALLY close the window (don't prevent default)
    this.window.on('close', () => {
      this.logger.info('Secondary window closing (user clicked traffic lights or close button)');
      
      // Clean up always-on-top interval if it exists
      if (this.alwaysOnTopInterval) {
        clearInterval(this.alwaysOnTopInterval);
        this.alwaysOnTopInterval = null;
        this.logger.info('Cleared always-on-top interval');
      }
      
      // Make orb visible and clickable again
      if (this.mainWindowManager) {
        this.mainWindowManager.setOrbVisibility(true);
        this.mainWindowManager.show();
        this.logger.info('Main window shown when secondary window closed');
      }
      
      // Emit window state change event (secondary window is closed)
      if (this.ipcMain) {
        this.ipcMain.emit('window:secondaryWindowChange', false, null);
        this.logger.info('Emitted secondary window close event');
      }
      
      // Also send to main window renderer if available
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', false, null);
        this.logger.info('Sent secondary window close event to main window renderer');
      }
    });

    // Handle window closed (after close completes)
    this.window.on('closed', () => {
      this.logger.info('Secondary window closed (destroyed)');
      this.window = null;
    });

    // Handle window blur (user switched to different window/screen)
    this.window.on('blur', () => {
      this.logger.info('Secondary window lost focus (user switched away)');
      
      // Make orb visible and clickable
      if (this.mainWindowManager) {
        this.mainWindowManager.setOrbVisibility(true);
      }
      
      // Notify main window that user switched away - show orb
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', false, null);
        this.logger.info('Sent secondary window blur event to main window renderer (show orb)');
      }
    });

    // Handle window focus (user switched back to this window)
    this.window.on('focus', () => {
      this.logger.info('Secondary window gained focus (user switched back)');
      
      // Make orb invisible and non-clickable
      if (this.mainWindowManager) {
        this.mainWindowManager.setOrbVisibility(false);
      }
      
      // Notify main window that user is back - hide orb
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', true, this.currentRoute);
        this.logger.info('Sent secondary window focus event to main window renderer (hide orb)');
      }
    });

    // Handle window minimize
    this.window.on('minimize', () => {
      this.logger.info('Secondary window minimized');
      
      // Make orb visible and clickable
      if (this.mainWindowManager) {
        this.mainWindowManager.setOrbVisibility(true);
      }
      
      // Show orb when minimized
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', false, null);
        this.logger.info('Sent secondary window minimize event to main window renderer (show orb)');
      }
    });

    // Handle window restore (from minimize)
    this.window.on('restore', () => {
      this.logger.info('Secondary window restored from minimize');
      
      // Make orb invisible and non-clickable
      if (this.mainWindowManager) {
        this.mainWindowManager.setOrbVisibility(false);
      }
      
      // Hide orb when restored
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', true, this.currentRoute);
        this.logger.info('Sent secondary window restore event to main window renderer (hide orb)');
      }
    });

    // Handle entering fullscreen
    this.window.on('enter-full-screen', () => {
      this.logger.info('Secondary window entered fullscreen');
      
      // Make orb invisible and non-clickable
      if (this.mainWindowManager) {
        this.mainWindowManager.setOrbVisibility(false);
      }
      
      // Hide orb when in fullscreen
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', true, this.currentRoute);
        this.logger.info('Sent secondary window fullscreen event to main window renderer (hide orb)');
      }
    });

    // Handle leaving fullscreen
    this.window.on('leave-full-screen', () => {
      this.logger.info('Secondary window left fullscreen');
      
      // Check if window still has focus - if yes, keep orb hidden; if no, show orb
      const hasFocus = this.window && this.window.isFocused();
      
      // Update orb visibility based on focus
      if (this.mainWindowManager) {
        this.mainWindowManager.setOrbVisibility(!hasFocus);
      }
      
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', hasFocus, hasFocus ? this.currentRoute : null);
        this.logger.info(`Sent secondary window leave-fullscreen event to main window renderer (orb ${hasFocus ? 'hidden' : 'visible'})`);
      }
    });

    this.logger.info('Secondary window created', { route });
    return this.window;
  }

  /**
   * NOTE: setupMaximumVisibility() and setupEnhancedAlwaysOnTop() have been REMOVED
   * 
   * The secondary window should behave like a NORMAL desktop window:
   * - NOT always-on-top
   * - Can be closed with traffic lights (macOS) or X button (Windows)
   * - Can be minimized
   * - Stays on the desktop/workspace it was opened on
   * - Doesn't float above everything
   * 
   * Only the main window (Arc Reactor orb) should have always-on-top behavior.
   */

  /**
   * Navigate to a different route in the secondary window
   */
  navigate(route) {
    if (!this.window) {
      this.create(route);
      return;
    }

    this.currentRoute = route;
    
    // Send navigation command to the renderer
    this.window.webContents.send('navigate', route);
    this.logger.info('Secondary window navigating', { route });
  }

  /**
   * Show the secondary window
   */
  show() {
    if (!this.window) {
      this.create();
      return;
    }

    // Ensure mouse events are enabled before showing
    this.window.setIgnoreMouseEvents(false);
    this.window.show();
    
    // Maximize the window to fill the screen
    if (!this.window.isMaximized()) {
      this.window.maximize();
    }
    
    this.window.focus();
    this.logger.info('Secondary window shown and maximized with mouse events enabled');
    
    // Notify main window that secondary is now visible and focused - hide orb
    if (this.mainWindowManager?.getWindow()?.webContents) {
      this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', true, this.currentRoute);
      this.logger.info('Sent secondary window show event to main window renderer (hide orb)');
    }
  }

  /**
   * Hide the secondary window
   */
  hide() {
    if (this.window) {
      this.window.hide();
      this.logger.info('Secondary window hidden');
      
      // Notify main window that secondary is hidden - show orb
      if (this.mainWindowManager?.getWindow()?.webContents) {
        this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', false, null);
        this.logger.info('Sent secondary window hide event to main window renderer (show orb)');
      }
    }
  }

  /**
   * Toggle secondary window visibility
   */
  toggle() {
    if (!this.window) {
      this.create();
      return;
    }

    if (this.window.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Close and destroy the secondary window
   */
  destroy() {
    if (this.window) {
      this.window.removeAllListeners('close');
      this.window.close();
      this.window = null;
      this.logger.info('Secondary window destroyed');
    }
  }

  /**
   * Get the window instance
   */
  getWindow() {
    return this.window;
  }

  /**
   * Check if window exists and is visible
   */
  isVisible() {
    return this.window && this.window.isVisible();
  }
}

module.exports = SecondaryWindowManager;

