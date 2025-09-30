/**
 * HeyJarvis Desktop App Lifecycle Manager
 * 
 * Features:
 * 1. Always-on background monitoring
 * 2. System tray integration
 * 3. Window management
 * 4. Auto-updater
 * 5. Deep link handling
 * 6. Performance monitoring
 */

const { app, BrowserWindow, ipcMain, protocol, shell, globalShortcut } = require('electron');
const path = require('path');
const winston = require('winston');
const Store = require('electron-store');

const TrayManager = require('./tray-manager');
const NotificationEngine = require('./notification-engine');
const PerformanceMonitor = require('./performance-monitor');
const IPCHandlers = require('../bridge/ipc-handlers');
const CopilotOverlay = require('./copilot-overlay');
const UltimateContextHandlers = require('../bridge/ultimate-context-handlers');

class AppLifecycle {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isQuitting = false;
    
    // Initialize store for user preferences
    this.store = new Store({
      name: 'heyjarvis-config',
      defaults: {
        windowBounds: { width: 1200, height: 800 },
        alwaysOnTop: false,
        startMinimized: false,
        enableNotifications: true,
        theme: 'light'
      }
    });
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: this.isDevelopment ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: path.join(app.getPath('userData'), 'logs', 'main.log')
        })
      ],
      defaultMeta: { service: 'desktop-main' }
    });
    
    // Initialize components
    this.mainWindow = null;
    this.trayManager = new TrayManager(this);
    this.notificationEngine = new NotificationEngine(this);
    this.performanceMonitor = new PerformanceMonitor(this);
    this.ipcHandlers = new IPCHandlers(this);
    this.copilotOverlay = new CopilotOverlay(this);
    this.ultimateContextHandlers = new UltimateContextHandlers();
    
    // Setup event handlers
    this.setupAppEvents();
    this.setupProtocolHandler();
    this.setupAutoUpdater();
  }
  
  /**
   * Setup app event handlers
   */
  setupAppEvents() {
    // App ready - create main window and initialize
    app.whenReady().then(() => {
      this.initialize();
    });
    
    // All windows closed
    app.on('window-all-closed', () => {
      // On macOS, keep app running even when all windows are closed
      if (process.platform !== 'darwin') {
        this.quit();
      }
    });
    
    // App activated (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      } else if (this.mainWindow) {
        this.showMainWindow();
      }
    });
    
    // Before quit
    app.on('before-quit', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.prepareQuit();
      }
    });
    
    // Second instance (single instance enforcement)
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, focus our window instead
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore();
        }
        this.mainWindow.focus();
      }
    });
    
    // Open URL (deep links)
    app.on('open-url', (event, url) => {
      event.preventDefault();
      this.handleDeepLink(url);
    });
  }
  
  /**
   * Setup protocol handler for jarvis:// URLs
   */
  setupProtocolHandler() {
    // Register protocol
    if (!app.isDefaultProtocolClient('jarvis')) {
      app.setAsDefaultProtocolClient('jarvis');
    }
    
    // Handle protocol URLs
    protocol.registerHttpProtocol('jarvis', (request, callback) => {
      this.handleDeepLink(request.url);
      callback({ statusCode: 200 });
    });
  }
  
  /**
   * Setup auto-updater
   */
  setupAutoUpdater() {
    if (this.isDevelopment) return;
    
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdatesAndNotify();
    
      autoUpdater.on('checking-for-update', () => {
        this.logger.info('Checking for updates...');
      });
      
      autoUpdater.on('update-available', (info) => {
        this.logger.info('Update available', { version: info.version });
        this.notificationEngine.showUpdateAvailable(info);
      });
      
      autoUpdater.on('update-not-available', (info) => {
        this.logger.debug('Update not available', { version: info.version });
      });
      
      autoUpdater.on('error', (err) => {
        this.logger.error('Auto-updater error', { error: err.message });
      });
      
      autoUpdater.on('download-progress', (progressObj) => {
        this.logger.debug('Download progress', { 
          percent: progressObj.percent,
          transferred: progressObj.transferred,
          total: progressObj.total
        });
      });
    
      autoUpdater.on('update-downloaded', (info) => {
        this.logger.info('Update downloaded', { version: info.version });
        this.notificationEngine.showUpdateReady(info);
      });
      
    } catch (error) {
      this.logger.warn('Auto-updater not available', { error: error.message });
    }
  }
  
  /**
   * Initialize application
   */
  async initialize() {
    try {
      this.logger.info('Initializing HeyJarvis Desktop');
      
      // Ensure single instance
      if (!app.requestSingleInstanceLock()) {
        this.logger.info('Another instance is already running');
        app.quit();
        return;
      }
      
      // Create main window
      this.createMainWindow();
      
      // Initialize system tray
      await this.trayManager.initialize();
      
      // Initialize notification engine
      await this.notificationEngine.initialize();
      
      // Start performance monitoring
      this.performanceMonitor.start();
      
    // Setup IPC handlers
    this.ipcHandlers.setup();
    
    // Setup ultimate context IPC handlers
    this.setupUltimateContextHandlers();
      
      // Register global shortcuts
      this.registerGlobalShortcuts();
      
      // Check for updates (production only)
      if (!this.isDevelopment) {
        setTimeout(() => autoUpdater.checkForUpdates(), 5000);
      }
      
      this.logger.info('HeyJarvis Desktop initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize application', { error: error.message });
      app.quit();
    }
  }
  
  /**
   * Create main application window
   */
  createMainWindow() {
    const bounds = this.store.get('windowBounds');
    
    this.mainWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      minWidth: 800,
      minHeight: 600,
      show: false, // Don't show until ready
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../bridge/preload.js')
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      icon: path.join(__dirname, '../assets/icon.png')
    });
    
    // Load the renderer
    const rendererPath = this.isDevelopment 
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../renderer/dist/index.html')}`;
    
    this.mainWindow.loadURL(rendererPath);
    
    // Window event handlers
    this.mainWindow.once('ready-to-show', () => {
      if (!this.store.get('startMinimized')) {
        this.showMainWindow();
      }
      
      // Open DevTools in development
      if (this.isDevelopment) {
        this.mainWindow.webContents.openDevTools();
      }
    });
    
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.hideMainWindow();
      }
    });
    
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
    
    this.mainWindow.on('resize', () => {
      this.saveWindowBounds();
    });
    
    this.mainWindow.on('move', () => {
      this.saveWindowBounds();
    });
    
    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
    
    this.logger.info('Main window created', { bounds });
  }

  /**
   * Create the ultimate context chat window
   */
  createUltimateContextWindow() {
    if (this.ultimateContextWindow) {
      this.ultimateContextWindow.focus();
      return;
    }

    this.ultimateContextWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      show: false,
      title: 'HeyJarvis - Ultimate Context Chat',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '../bridge/preload.js')
      }
    });

    // Load the ultimate context chat interface
    this.ultimateContextWindow.loadFile(path.join(__dirname, '../renderer/ultimate-context-chat.html'));

    // Show window when ready
    this.ultimateContextWindow.once('ready-to-show', () => {
      this.ultimateContextWindow.show();
      
      if (this.isDevelopment) {
        this.ultimateContextWindow.webContents.openDevTools();
      }
    });

    // Handle window closed
    this.ultimateContextWindow.on('closed', () => {
      this.ultimateContextWindow = null;
    });

    // Handle external links
    this.ultimateContextWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    this.logger.info('Ultimate context window created');
  }

  /**
   * Setup ultimate context IPC handlers
   */
  setupUltimateContextHandlers() {
    // Open ultimate context window
    ipcMain.handle('open-ultimate-context', () => {
      this.createUltimateContextWindow();
    });
  }
  
  /**
   * Show main window
   */
  showMainWindow() {
    if (!this.mainWindow) {
      this.createMainWindow();
      return;
    }
    
    this.mainWindow.show();
    this.mainWindow.focus();
    
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  }
  
  /**
   * Hide main window (minimize to tray)
   */
  hideMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
    
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
  }
  
  /**
   * Toggle main window visibility
   */
  toggleMainWindow() {
    if (!this.mainWindow) {
      this.createMainWindow();
    } else if (this.mainWindow.isVisible()) {
      this.hideMainWindow();
    } else {
      this.showMainWindow();
    }
  }
  
  /**
   * Handle deep link URLs
   */
  handleDeepLink(url) {
    this.logger.info('Handling deep link', { url });
    
    try {
      const urlObj = new URL(url);
      const action = urlObj.pathname.substring(1); // Remove leading slash
      const params = Object.fromEntries(urlObj.searchParams);
      
      // Show main window for deep links
      this.showMainWindow();
      
      // Send deep link to renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('deep-link', { action, params });
      }
      
    } catch (error) {
      this.logger.error('Failed to handle deep link', { url, error: error.message });
    }
  }
  
  /**
   * Save window bounds to store
   */
  saveWindowBounds() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const bounds = this.mainWindow.getBounds();
      this.store.set('windowBounds', bounds);
    }
  }
  
  /**
   * Prepare for application quit
   */
  async prepareQuit() {
    this.logger.info('Preparing to quit application');
    
    try {
      this.isQuitting = true;
      
      // Stop performance monitoring
      this.performanceMonitor.stop();
      
      // Clean up tray
      this.trayManager.destroy();
      
      // Save final state
      this.saveWindowBounds();
      
      // Close all windows
      BrowserWindow.getAllWindows().forEach(window => {
        window.destroy();
      });
      
      this.logger.info('Application cleanup completed');
      
    } catch (error) {
      this.logger.error('Error during quit preparation', { error: error.message });
    }
    
    // Now actually quit
    setTimeout(() => {
      app.quit();
    }, 100);
  }
  
  /**
   * Quit application
   */
  quit() {
    if (!this.isQuitting) {
      this.prepareQuit();
    }
  }
  
  /**
   * Restart application
   */
  restart() {
    this.logger.info('Restarting application');
    app.relaunch();
    this.quit();
  }
  
  /**
   * Get application info
   */
  getAppInfo() {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromiumVersion: process.versions.chrome,
      isDevelopment: this.isDevelopment,
      userDataPath: app.getPath('userData'),
      appPath: app.getAppPath()
    };
  }
  
  /**
   * Get app store instance
   */
  getStore() {
    return this.store;
  }
  
  /**
   * Get logger instance
   */
  getLogger() {
    return this.logger;
  }
  
  /**
   * Get main window instance
   */
  getMainWindow() {
    return this.mainWindow;
  }
  
  /**
   * Register global shortcuts
   */
  registerGlobalShortcuts() {
    try {
      // Toggle copilot with Cmd+Shift+J (or Ctrl+Shift+J on Windows/Linux)
      const shortcut = process.platform === 'darwin' ? 'Cmd+Shift+J' : 'Ctrl+Shift+J';
      
      globalShortcut.register(shortcut, () => {
        this.logger.debug('Global shortcut triggered: Toggle copilot');
        this.copilotOverlay.toggle();
      });
      
      this.logger.info('Global shortcuts registered', { shortcut });
      
    } catch (error) {
      this.logger.error('Failed to register global shortcuts', { error: error.message });
    }
  }
  
  /**
   * Get store instance
   */
  getStore() {
    return this.store;
  }
}

module.exports = AppLifecycle;
