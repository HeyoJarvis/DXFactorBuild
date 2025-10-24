/**
 * Secondary Window Manager
 * Manages the main UI window (Tasks/Copilot) that opens separately from the Arc Reactor orb
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class SecondaryWindowManager {
  constructor(logger, mainWindow = null) {
    this.logger = logger;
    this.window = null;
    this.currentRoute = '/tasks'; // Default route
    this.mainWindow = mainWindow; // Reference to main window for notifications
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
      frame: true, // CHANGED: Use native frame with traffic lights
      resizable: true, // Allow window resizing
      movable: true, // Allow window dragging
      center: true, // Center the window on screen
      title: 'HeyJarvis - Mission Control', // Window title
      enableLargerThanScreen: true, // CRITICAL: Allow window to be larger than screen (for true full-screen)
      ...(process.platform === 'darwin' ? {
        titleBarStyle: 'hiddenInset', // macOS: Show traffic lights, hide title text, inset style
        roundedCorners: true,
        trafficLightPosition: { x: 20, y: 20 } // Position traffic lights in top-left
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
      
      // Use NATIVE maximize for proper OS integration
      // This ensures the OS knows the window is maximized and can show it correctly
      // on different desktops/spaces, and the orb visibility logic works properly
      this.window.maximize();
      this.logger.info('Secondary window maximized using native OS maximize');
      
      // NOTE: Removed setupMaximumVisibility() and setupEnhancedAlwaysOnTop()
      // Mission Control should behave like a normal desktop window:
      // - Can be closed
      // - Can be minimized
      // - Stays on the desktop/window it was opened on
      // - Doesn't float above everything
      // - Uses native maximize state for proper OS integration
      this.logger.info('Secondary window configured as normal desktop window (not always-on-top)');
      
    });

    // Handle window close
    this.window.on('closed', () => {
      this.logger.info('Secondary window closed');
      this.window = null;
    });

    // Prevent window from being destroyed, just hide it
    this.window.on('close', (e) => {
      if (this.window) {
        e.preventDefault();
        this.window.hide();
        
        // Notify main window that secondary window closed
        if (this.mainWindow) {
          this.mainWindow.webContents.send('secondary-window:changed', false, null);
          this.logger.debug('Notified main window: secondary closed');
        }
      }
    });

    // Handle window blur (user switched to different window)
    this.window.on('blur', () => {
      this.logger.debug('Secondary window lost focus (blur)');
      // Notify main window that user switched away - show orb
      if (this.mainWindow) {
        this.mainWindow.webContents.send('secondary-window:changed', false, null);
        this.logger.debug('Notified main window: secondary blurred (show orb)');
      }
    });

    // Handle window focus (user switched back to Mission Control)
    this.window.on('focus', () => {
      this.logger.debug('Secondary window gained focus');
      // Notify main window that user is back - hide orb
      if (this.mainWindow) {
        this.mainWindow.webContents.send('secondary-window:changed', true, this.currentRoute);
        this.logger.debug('Notified main window: secondary focused (hide orb)');
      }
    });

    // Handle window minimize
    this.window.on('minimize', () => {
      this.logger.debug('Secondary window minimized');
      // Show orb when minimized
      if (this.mainWindow) {
        this.mainWindow.webContents.send('secondary-window:changed', false, null);
        this.logger.debug('Notified main window: secondary minimized (show orb)');
      }
    });

    // Handle window restore (from minimize)
    this.window.on('restore', () => {
      this.logger.debug('Secondary window restored');
      // Hide orb when restored
      if (this.mainWindow) {
        this.mainWindow.webContents.send('secondary-window:changed', true, this.currentRoute);
        this.logger.debug('Notified main window: secondary restored (hide orb)');
      }
    });

    this.logger.info('Secondary window created', { route });
    return this.window;
  }

  // REMOVED: setupMaximumVisibility() and setupEnhancedAlwaysOnTop()
  // Mission Control should behave like a normal desktop window, not always-on-top

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
    
    // Notify main window that secondary is now visible and focused
    if (this.mainWindow) {
      this.mainWindow.webContents.send('secondary-window:changed', true, this.currentRoute);
      this.logger.debug('Notified main window: secondary shown (hide orb)');
    }
    
    this.logger.info('Secondary window shown and maximized with mouse events enabled');
  }

  /**
   * Hide the secondary window
   */
  hide() {
    if (this.window) {
      this.window.hide();
      
      // Notify main window that secondary is hidden - show orb
      if (this.mainWindow) {
        this.mainWindow.webContents.send('secondary-window:changed', false, null);
        this.logger.debug('Notified main window: secondary hidden (show orb)');
      }
      
      this.logger.info('Secondary window hidden');
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

