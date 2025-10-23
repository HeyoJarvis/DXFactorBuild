/**
 * Secondary Window Manager
 * Manages the main UI window (Tasks/Copilot) that opens separately from the Arc Reactor orb
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class SecondaryWindowManager {
  constructor(logger) {
    this.logger = logger;
    this.window = null;
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
      
      // Setup maximum visibility (same as Arc Reactor)
      this.setupMaximumVisibility();
      
      // Setup enhanced always-on-top behavior (same as Arc Reactor)
      this.setupEnhancedAlwaysOnTop();
      
      if (isDev) {
        this.window.webContents.openDevTools({ mode: 'detached' });
      }
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
      }
    });

    this.logger.info('Secondary window created', { route });
    return this.window;
  }

  /**
   * Setup maximum visibility (copied from MainWindowManager)
   */
  setupMaximumVisibility() {
    if (!this.window || this.window.isDestroyed()) return;
    
    this.logger.info('Setting up maximum visibility for secondary window');
    
    // Set to screen-saver level (highest visibility level)
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.moveTop();
    
    // For macOS, set additional flags
    if (process.platform === 'darwin') {
      try {
        this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        this.logger.info('macOS: Set visible on all workspaces with fullscreen visibility');
      } catch (error) {
        this.logger.warn('Some macOS-specific features unavailable:', error.message);
      }
    }
    
    // For Windows, set topmost flag
    if (process.platform === 'win32') {
      this.window.setAlwaysOnTop(true, 'pop-up-menu');
    }
    
    this.logger.info('Maximum visibility configured');
  }

  /**
   * Enhanced always-on-top behavior (copied from MainWindowManager)
   */
  setupEnhancedAlwaysOnTop() {
    if (!this.window || this.window.isDestroyed()) return;
    
    this.logger.info('Setting up enhanced always-on-top for secondary window');
    
    // Aggressively maintain always-on-top status
    const maintainAlwaysOnTop = () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.setAlwaysOnTop(true, 'screen-saver');
        
        // CRITICAL: Ensure mouse events stay enabled (this is NOT the Arc Reactor orb)
        this.window.setIgnoreMouseEvents(false);
        
        // Additional visibility enforcement
        if (this.window.isVisible() && !this.window.isFocused()) {
          setTimeout(() => {
            if (this.window && !this.window.isDestroyed()) {
              this.window.moveTop();
            }
          }, 50);
        }
      }
    };
    
    // Run every 5 seconds to maintain visibility
    this.alwaysOnTopInterval = setInterval(maintainAlwaysOnTop, 5000);
    
    // Handle window events
    this.window.on('blur', () => {
      setTimeout(() => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.setAlwaysOnTop(true, 'screen-saver');
          this.window.setIgnoreMouseEvents(false); // Keep clickable
          this.window.moveTop();
        }
      }, 100);
    });

    this.window.on('focus', () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.setAlwaysOnTop(true, 'screen-saver');
        this.window.setIgnoreMouseEvents(false); // Keep clickable
      }
    });
    
    // Clean up interval on window destroy
    this.window.on('closed', () => {
      if (this.alwaysOnTopInterval) {
        clearInterval(this.alwaysOnTopInterval);
      }
    });
    
    this.logger.info('Enhanced always-on-top configured');
  }

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
  }

  /**
   * Hide the secondary window
   */
  hide() {
    if (this.window) {
      this.window.hide();
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

