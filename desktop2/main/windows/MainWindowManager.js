/**
 * Main Window Manager
 * Handles the primary application window
 */

const { BrowserWindow } = require('electron');
const path = require('path');
const Store = require('electron-store');

class MainWindowManager {
  constructor({ logger }) {
    this.logger = logger;
    this.window = null;
    this.store = new Store({ name: 'heyjarvis-v2-config' });
    
    // Default window settings - slim header bar
    this.defaults = {
      width: 800,
      height: 70,
      minWidth: 600,
      minHeight: 70,
      maxHeight: 70
    };
    
    // Full chat window settings
    this.fullChatDefaults = {
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600
    };
  }

  /**
   * Create the main window
   */
  create() {
    // TEMPORARY: Clear stored bounds to start fresh - REMOVE THIS AFTER TESTING
    this.store.delete('windowBounds');
    
    const storedBounds = this.store.get('windowBounds', this.defaults);
    const isDev = process.env.NODE_ENV === 'development';

    console.log('📦 Stored bounds:', storedBounds);
    console.log('📏 Default header size:', this.defaults);

    // Start with a small window size for Arc Reactor orb only
    // Will expand when menu opens or to 656x900 for full UI
    const startWidth = 220;  // Small width for Arc Reactor (fits glow)
    const startHeight = 220; // Small height for Arc Reactor (fits glow)
    
    // Position in bottom-left corner
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    this.window = new BrowserWindow({
      width: startWidth,
      height: startHeight,
      x: 20, // Small margin from left edge
      y: screenHeight - startHeight - 20, // Bottom of screen with margin
      show: false, // Will show manually in ready-to-show
      transparent: true, // TRANSPARENT for Arc Reactor orb
      backgroundColor: '#00000000', // Fully transparent background
      resizable: true, // Allow resizing for expansion
      alwaysOnTop: false, // DON'T keep on top - allows clicking other windows
      skipTaskbar: false, // Show in taskbar
      hasShadow: false, // No shadow for transparent window
      enableLargerThanScreen: true, // Allow full screen coverage
      focusable: true, // Allow window to receive focus
      acceptFirstMouse: true, // Accept clicks even when not focused
      frame: false, // Frameless window - removes ALL window chrome including traffic lights
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../../bridge/preload.js')
      }
    });
    
    // CRITICAL: Set window to ignore mouse events on transparent areas
    // Start with mouse events ENABLED so we don't block everything
    this.window.setIgnoreMouseEvents(false);
    
    console.log('🪟 Window created with config:', {
      width: this.window.getBounds().width,
      height: this.window.getBounds().height,
      x: this.window.getBounds().x,
      y: this.window.getBounds().y
    });

    // Load the app
    const url = isDev 
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../../renderer2/dist/index.html')}`;
    
    this.window.loadURL(url);

    // Show when ready
    this.window.once('ready-to-show', () => {
      console.log('🎬 Window ready-to-show event fired');
      console.log('🌟 Starting in full-screen transparent mode for Arc Reactor');
      
      // Keep full screen for Arc Reactor orb
      const currentBounds = this.window.getBounds();
      console.log('📐 Current bounds:', currentBounds);
      
      // Don't resize - keep it full screen and transparent for Arc Reactor
      // OLD CODE REMOVED - no longer forcing header size
      
      console.log('👁️ Window.show() called');
      this.window.show();
      
      // Setup maximum visibility (copied from working desktop app)
      this.setupMaximumVisibility();
      
      // Focus window so it's clickable
      this.window.focus();
      
      // On macOS, also activate the app
      if (process.platform === 'darwin') {
        const { app } = require('electron');
        app.focus({ steal: true });
      }
      
      const bounds = this.window.getBounds();
      console.log(`📐 Final window bounds: ${bounds.x}, ${bounds.y}, ${bounds.width}x${bounds.height}`);
      console.log(`✅ Window visible: ${this.window.isVisible()}`);
      console.log(`🔝 Window is always on top: ${this.window.isAlwaysOnTop()}`);
      console.log(`📍 Window is focused: ${this.window.isFocused()}`);
      
      console.log('🚀 HeyJarvis overlay ready and visible');
      
      // Open DevTools in development mode for debugging
      if (isDev) {
        this.window.webContents.openDevTools({ mode: 'detach' });
        console.log('🔧 DevTools opened in detached mode');
      }
    });

    // Handle window events
    this.window.on('close', event => {
      if (!global.appState?.isQuitting) {
        event.preventDefault();
        this.hide();
      }
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    // Save bounds on resize/move
    this.window.on('resize', () => this.saveBounds());
    this.window.on('move', () => this.saveBounds());

    // Setup screen monitoring to follow user across displays
    this.setupScreenMonitoring();
    
    // Setup enhanced always-on-top behavior (copied from working desktop app)
    this.setupEnhancedAlwaysOnTop();

    this.logger.info('Main window created');
    return this.window;
  }

  /**
   * Setup maximum visibility (copied from working desktop/main.js)
   */
  setupMaximumVisibility() {
    console.log('🔝 Setting up maximum visibility...');
    
    // Set to screen-saver level (highest visibility level)
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.moveTop();
    
    // For macOS, set additional flags
    if (process.platform === 'darwin') {
      try {
        this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        console.log('✅ macOS: Set visible on all workspaces with fullscreen visibility');
      } catch (error) {
        console.log('⚠️ Some macOS-specific features unavailable:', error.message);
      }
    }
    
    // For Windows, set topmost flag
    if (process.platform === 'win32') {
      this.window.setAlwaysOnTop(true, 'pop-up-menu');
    }
    
    console.log('✅ Maximum visibility configured');
  }

  /**
   * Enhanced always-on-top behavior (copied from working desktop/main.js)
   */
  setupEnhancedAlwaysOnTop() {
    console.log('🔒 Setting up enhanced always-on-top...');
    
    // Aggressively maintain always-on-top status
    const maintainAlwaysOnTop = () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.setAlwaysOnTop(true, 'screen-saver');
        
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
          this.window.moveTop();
        }
      }, 100);
    });

    this.window.on('focus', () => {
      this.window.setAlwaysOnTop(true, 'screen-saver');
    });
    
    // Clean up interval on window destroy
    this.window.on('closed', () => {
      if (this.alwaysOnTopInterval) {
        clearInterval(this.alwaysOnTopInterval);
      }
    });
    
    console.log('✅ Enhanced always-on-top configured');
  }

  /**
   * Monitor screen changes and follow user across displays
   */
  setupScreenMonitoring() {
    const { screen } = require('electron');
    let lastScreenId = null;
    
    console.log('🔍 Setting up screen monitoring...');
    this.logger.info('Screen monitoring initialized');
    
    // For macOS: Re-apply visibleOnAllWorkspaces periodically to ensure it sticks
    if (process.platform === 'darwin') {
      this.workspaceInterval = setInterval(() => {
        if (!this.window || this.window.isDestroyed()) {
          clearInterval(this.workspaceInterval);
          return;
        }
        
        try {
          // Re-apply these settings to ensure they persist (use screen-saver level like original)
          this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
          this.window.setAlwaysOnTop(true, 'screen-saver');
          console.log('🔄 Re-applied workspace visibility settings');
        } catch (error) {
          console.error('Error re-applying workspace settings:', error);
        }
      }, 10000); // Re-apply every 10 seconds
    }
    
    // Check screen changes every 5 seconds
    this.screenMonitorInterval = setInterval(() => {
      if (!this.window || this.window.isDestroyed()) {
        clearInterval(this.screenMonitorInterval);
        return;
      }
      
      try {
        const cursor = screen.getCursorScreenPoint();
        const currentDisplay = screen.getDisplayNearestPoint(cursor);
        
        console.log(`👀 Checking screen... Current: ${currentDisplay.id}, Last: ${lastScreenId}`);
        
        // If user moved to a different physical screen, follow them
        if (lastScreenId !== null && lastScreenId !== currentDisplay.id) {
          console.log(`🏃‍♂️ Following user to screen: ${currentDisplay.id}`);
          this.logger.info(`Following user to screen: ${currentDisplay.id}`);
          this.positionOnCurrentScreen();
        }
        
        lastScreenId = currentDisplay.id;
        
        // Check if window is still in the right position
        this.checkWindowPosition();
        
      } catch (error) {
        console.error('Screen monitoring error:', error);
        this.logger.warn('Screen monitoring error:', error.message);
      }
    }, 5000); // Check every 5 seconds
    
    // Listen for display changes
    screen.on('display-added', () => {
      console.log('🖥️ New display detected');
      this.logger.info('New display detected');
      setTimeout(() => this.positionOnCurrentScreen(), 1000);
    });
    
    screen.on('display-removed', () => {
      console.log('🖥️ Display removed');
      this.logger.info('Display removed');
      setTimeout(() => this.positionOnCurrentScreen(), 1000);
    });
    
    screen.on('display-metrics-changed', () => {
      console.log('🖥️ Display metrics changed');
      this.logger.info('Display metrics changed');
      setTimeout(() => this.positionOnCurrentScreen(), 500);
    });
    
    // Clean up on window close
    this.window.on('closed', () => {
      if (this.screenMonitorInterval) {
        clearInterval(this.screenMonitorInterval);
      }
      if (this.workspaceInterval) {
        clearInterval(this.workspaceInterval);
      }
    });
  }

  /**
   * Position window on the current screen (where cursor is) - DISABLED to preserve user positioning
   */
  positionOnCurrentScreen() {
    if (!this.window || this.window.isDestroyed()) return;
    
    // DISABLED: Let user position window wherever they want
    // Window position will persist based on stored bounds
    console.log('📍 Window positioning disabled - preserving user choice');
    this.logger.info('Window positioning disabled - preserving user choice');
    
    // Only ensure window is visible on some screen if completely off-screen
    const { screen } = require('electron');
    const windowBounds = this.window.getBounds();
    const displays = screen.getAllDisplays();
    
    // Check if window is completely off all screens
    const isVisible = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      return windowBounds.x < x + width && 
             windowBounds.x + windowBounds.width > x &&
             windowBounds.y < y + height && 
             windowBounds.y + windowBounds.height > y;
    });
    
    if (!isVisible) {
      // Only reposition if completely off-screen
      const primaryDisplay = screen.getPrimaryDisplay();
      const { x: screenX, y: screenY } = primaryDisplay.workArea;
      this.window.setBounds({
        x: screenX + 100, // Small offset from edge
        y: screenY + 100,
        width: windowBounds.width,
        height: windowBounds.height
      });
      console.log('📍 Repositioned off-screen window to primary display');
    }
  }

  /**
   * Check if window position needs adjustment - DISABLED to preserve user positioning
   */
  checkWindowPosition() {
    if (!this.window || this.window.isDestroyed()) return;
    
    // DISABLED: Don't reposition based on "drift" - let user keep their chosen position
    console.log('📍 Window position check disabled - preserving user choice');
    
    // Only maintain always-on-top behavior
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.moveTop();
  }

  /**
   * Expand window to LoginFlow size (579x729)
   */
  expandToLoginFlow() {
    if (!this.window || this.window.isDestroyed()) return;

    console.log('🔄 Expanding window for LoginFlow...');

    // LoginFlow size - 579×729 (optimal for login)
    const loginWidth = 579;
    const loginHeight = 729;

    // Get screen dimensions to center the window
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Center the login window
    const x = Math.floor((screenWidth - loginWidth) / 2);
    const y = Math.floor((screenHeight - loginHeight) / 2);

    // Update window properties for login mode
    this.window.setResizable(true);
    this.window.setMinimumSize(1, 1); // Remove minimum size restrictions
    this.window.setMaximumSize(0, 0); // Remove maximum size restrictions

    // Expand to LoginFlow size, centered
    this.window.setBounds({
      x: x,
      y: y,
      width: loginWidth,
      height: loginHeight
    });

    // Make background semi-transparent for glass effect
    this.window.setBackgroundColor('#F7F7F8');

    console.log(`✅ Window expanded to ${loginWidth}x${loginHeight} at (${x}, ${y}) for LoginFlow`);
    this.logger.info('Window expanded for LoginFlow');
  }

  /**
   * Expand window to full chat interface
   */
  expandToFullChat() {
    if (!this.window || this.window.isDestroyed()) return;

    console.log('🔄 Expanding window to full UI...');

    // Arc Reactor expanded size
    const expandedWidth = 656;
    const expandedHeight = 900;

    // Get screen dimensions to center the window
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Center the expanded window
    const x = Math.floor((screenWidth - expandedWidth) / 2);
    const y = Math.floor((screenHeight - expandedHeight) / 2);

    // Update window properties for expanded mode
    this.window.setResizable(true);
    this.window.setMaximumSize(0, 0); // Remove size restrictions

    // Expand to Arc Reactor full size, centered
    this.window.setBounds({
      x: x,
      y: y,
      width: expandedWidth,
      height: expandedHeight
    });

    // Update minimum size constraints
    this.window.setMinimumSize(656, 900);

    // Make background opaque for expanded mode
    this.window.setBackgroundColor('#1c1c1e');

    console.log(`✅ Window expanded to ${expandedWidth}x${expandedHeight} at (${x}, ${y})`);
    this.logger.info('Window expanded to full UI');
  }

  /**
   * Collapse window back to Arc Reactor orb only
   */
  collapseToHeader() {
    if (!this.window || this.window.isDestroyed()) return;
    
    console.log('🔄 Collapsing window to Arc Reactor orb...');
    
    // Arc Reactor orb size (slightly bigger to not cut off glow)
    const orbWidth = 220;
    const orbHeight = 220;
    
    // Position in bottom-left corner
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    const x = 20;
    const y = screenHeight - orbHeight - 20;
    
    console.log('📏 Target size:', { width: orbWidth, height: orbHeight });
    console.log('📐 Target position:', { x, y });
    
    // Update size constraints
    this.window.setMinimumSize(orbWidth, orbHeight);
    this.window.setMaximumSize(orbWidth, orbHeight);
    this.window.setResizable(false);
    
    // Collapse to orb size in bottom-left
    this.window.setBounds({
      x: x,
      y: y,
      width: orbWidth,
      height: orbHeight
    });
    
    // Make background transparent for collapsed mode
    this.window.setBackgroundColor('#00000000');
    
    // Verify the size was set
    const afterBounds = this.window.getBounds();
    console.log('📐 After collapse bounds:', afterBounds);
    
    console.log('✅ Window collapsed to Arc Reactor orb');
    this.logger.info('Window collapsed to Arc Reactor orb');
  }

  /**
   * Expand window (alias for expandToFullChat)
   */
  expand() {
    this.expandToFullChat();
  }

  /**
   * Collapse window (alias for collapseToHeader)
   */
  collapse() {
    this.collapseToHeader();
  }

  /**
   * Save window bounds
   */
  saveBounds() {
    if (!this.window) return;
    
    const bounds = this.window.getBounds();
    this.store.set('windowBounds', bounds);
  }

  /**
   * Show the window
   */
  show() {
    if (this.window) {
      // Re-setup always-on-top when showing (clear old interval first)
      if (this.alwaysOnTopInterval) {
        clearInterval(this.alwaysOnTopInterval);
        this.alwaysOnTopInterval = null;
      }
      this.window.show();
      this.window.focus();
      this.window.setAlwaysOnTop(true, 'screen-saver');
      // Re-enable the interval
      this.setupEnhancedAlwaysOnTop();
    }
  }

  /**
   * Hide the window
   */
  hide() {
    if (this.window) {
      // Clear the always-on-top interval when hiding
      if (this.alwaysOnTopInterval) {
        clearInterval(this.alwaysOnTopInterval);
        this.alwaysOnTopInterval = null;
      }
      this.window.setAlwaysOnTop(false);
      this.window.hide();
    }
  }

  /**
   * Toggle window visibility
   */
  toggle() {
    if (this.window) {
      if (this.window.isVisible()) {
        this.hide();
      } else {
        this.show();
      }
    }
  }

  /**
   * Get the window instance
   */
  getWindow() {
    return this.window;
  }

  /**
   * Destroy the window
   */
  destroy() {
    if (this.window) {
      this.window.destroy();
      this.window = null;
    }
  }
}

module.exports = MainWindowManager;

