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

    // Always start in header mode - ignore stored height and width from storage
    // Create window with explicit visibility settings - always start in header mode
    this.window = new BrowserWindow({
      width: this.defaults.width,
      height: this.defaults.height,
      x: storedBounds.x || 100,
      y: storedBounds.y || 100,
      minWidth: this.defaults.minWidth,
      minHeight: this.defaults.minHeight,
      maxHeight: this.defaults.maxHeight,
      show: false, // Will show manually in ready-to-show
      frame: false, // Frameless window - no titlebar
      transparent: false, // Not transparent
      backgroundColor: '#1c1c1e',
      resizable: false, // Don't allow resizing - keep it slim
      alwaysOnTop: true, // Keep header on top
      skipTaskbar: false, // Show in taskbar
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../../bridge/preload.js')
      },
      // Will set these AFTER window is shown
      // alwaysOnTop: true,
      // skipTaskbar: false,
      // visibleOnAllWorkspaces: true,
      // fullscreenable: false
    });
    
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
      
      // FORCE the window to header size before showing
      const currentBounds = this.window.getBounds();
      console.log('📐 Current bounds before force resize:', currentBounds);
      console.log('📏 Trying to set to:', { width: this.defaults.width, height: this.defaults.height });
      
      this.window.setBounds({
        x: currentBounds.x,
        y: currentBounds.y,
        width: this.defaults.width,
        height: this.defaults.height
      });
      
      // Double check the size was actually set
      const afterBounds = this.window.getBounds();
      console.log('📐 Bounds after force resize:', afterBounds);
      
      if (afterBounds.height !== this.defaults.height) {
        console.error('⚠️ WARNING: Height did not set correctly!');
        console.error(`   Expected: ${this.defaults.height}, Got: ${afterBounds.height}`);
        
        // Try again with setSize
        this.window.setSize(this.defaults.width, this.defaults.height);
        const thirdTry = this.window.getBounds();
        console.log('📐 Bounds after setSize:', thirdTry);
      }
      
      this.window.show();
      console.log('👁️ Window.show() called');
      
      // Setup maximum visibility (copied from working desktop app)
      this.setupMaximumVisibility();
      
      // Force focus and bring to front
      this.window.focus();
      this.window.moveTop();
      this.window.setAlwaysOnTop(true, 'screen-saver');
      
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
      
      // Dev tools can be opened manually with Cmd+Option+I if needed
      // if (isDev) {
      //   this.window.webContents.openDevTools();
      // }
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
   * Expand window to full chat interface
   */
  expandToFullChat() {
    if (!this.window || this.window.isDestroyed()) return;
    
    console.log('🔄 Expanding window to full chat interface...');
    
    // Get current position to maintain it
    const currentBounds = this.window.getBounds();
    
    // Update window properties for full chat
    this.window.setResizable(true);
    this.window.setMaximumSize(0, 0); // Remove size restrictions
    
    // Expand to full chat size, keeping current X position
    this.window.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: this.fullChatDefaults.width,
      height: this.fullChatDefaults.height
    });
    
    // Update minimum size constraints
    this.window.setMinimumSize(
      this.fullChatDefaults.minWidth, 
      this.fullChatDefaults.minHeight
    );
    
    console.log('✅ Window expanded to full chat interface');
    this.logger.info('Window expanded to full chat interface');
  }

  /**
   * Collapse window back to slim header
   */
  collapseToHeader() {
    if (!this.window || this.window.isDestroyed()) return;
    
    console.log('🔄 Collapsing window to slim header...');
    console.log('📏 Target size:', { width: this.defaults.width, height: this.defaults.height });
    
    // Get current position to maintain it
    const currentBounds = this.window.getBounds();
    console.log('📐 Current bounds:', currentBounds);
    
    // Update size constraints FIRST
    this.window.setMinimumSize(this.defaults.minWidth, this.defaults.minHeight);
    this.window.setMaximumSize(0, this.defaults.maxHeight);
    this.window.setResizable(false);
    
    // Then collapse to header size, keeping current X position
    this.window.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: this.defaults.width,
      height: this.defaults.height
    });
    
    // Verify the size was set
    const afterBounds = this.window.getBounds();
    console.log('📐 After collapse bounds:', afterBounds);
    
    if (afterBounds.height !== this.defaults.height) {
      console.error('⚠️ COLLAPSE FAILED: Height is', afterBounds.height, 'but should be', this.defaults.height);
      // Try with setSize
      this.window.setSize(this.defaults.width, this.defaults.height);
      const finalBounds = this.window.getBounds();
      console.log('📐 After setSize:', finalBounds);
    }
    
    console.log('✅ Window collapsed to slim header');
    this.logger.info('Window collapsed to slim header');
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
      this.window.show();
      this.window.focus();
    }
  }

  /**
   * Hide the window
   */
  hide() {
    if (this.window) {
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

