/**
 * Simple Electron Main Entry Point
 * Loads the copilot-enhanced.html directly without webpack
 */

// Load environment variables FIRST before anything else
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { app, BrowserWindow, ipcMain, Tray, Menu, screen, desktopCapturer, protocol } = require('electron');
const path = require('path');
const SlackService = require('./main/slack-service');
const CRMStartupService = require('./main/crm-startup-service');
const DesktopSupabaseAdapter = require('./main/supabase-adapter');
const WorkRequestAlertSystem = require('../api/notifications/work-request-alerts');
const AIWorkRequestDetector = require('../api/notifications/ai-work-request-detector');
const WorkflowIntelligenceSystem = require('../core/intelligence/workflow-analyzer');
const AuthService = require('./services/auth-service');
const FactCheckerService = require('./main/fact-checker-service');
const MicrosoftOAuthHandler = require('../oauth/microsoft-oauth-handler');
const MicrosoftWorkflowAutomation = require('../core/automation/microsoft-workflow-automation');
const EngineeringIntelligenceService = require('../core/intelligence/engineering-intelligence-service');

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

let mainWindow;
let loginWindow;
let highlightOverlay = null; // New overlay for fact-check highlights
let tray;
let slackService;
let crmStartupService;
let dbAdapter; // Supabase adapter for desktop app
let workRequestSystem; // Workflow detection system
let workflowIntelligence; // Workflow intelligence analyzer
let authService; // Authentication service
let factCheckerService; // Fact-checker service
let microsoftOAuthHandler; // Microsoft OAuth handler
let microsoftAutomation; // Microsoft workflow automation
let engineeringIntelligence; // Engineering intelligence service
let currentUser = null; // Currently authenticated user
let conversationHistory = []; // Store conversation history
let currentSessionId = null; // Track current conversation session
let taskSessionIds = {}; // Track task-specific session IDs: { taskId: sessionId }
let lastSlackContext = null; // Cache Slack context
let isExpanded = false; // Track if top bar is expanded
let isManuallyPositioned = false; // Track if user has manually moved the bar
let activeHighlights = []; // Store active highlight data
let userDefinedSize = null; // Track user's custom window size
let isUserResizing = false; // Track if user is actively resizing
let expandedSize = { width: 451, height: 397 }; // Remember expanded dimensions
let isQuittingApp = false; // Track real quit vs window hide

function createWindow() {
  // Create the browser window as a top bar overlay
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;
  
  // Start in collapsed state - clean header bar
  const barWidth = Math.min(800, screenWidth * 0.6); // Responsive width for header
  const barHeight = 48; // Collapsed header height
  const xPosition = Math.floor((screenWidth - barWidth) / 2); // Center horizontally
  
  mainWindow = new BrowserWindow({
    width: barWidth, // Narrower, more discreet width
    height: barHeight, // Taller bar
    x: xPosition, // Centered position
    y: 10, // Small margin from top
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'bridge/copilot-preload.js')
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true, // Allow resizing for better UX
    movable: true, // Enable dragging
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: true,
    show: false, // Don't show until ready
    titleBarStyle: 'hidden',
    vibrancy: 'ultra-dark', // macOS only
    backgroundMaterial: 'acrylic', // Windows only
    opacity: 0.9,
    hasShadow: false,
    thickFrame: false,
    type: 'panel' // Panel type for better overlay behavior
  });

  // Load the copilot HTML file directly (with tasks tab)
  mainWindow.loadFile(path.join(__dirname, 'renderer/unified.html'));

  // Track user resizing
  mainWindow.on('will-resize', (event, newBounds) => {
    isUserResizing = true;
  });

  mainWindow.on('resize', () => {
    if (isUserResizing && isExpanded) {
      // User is manually resizing - save their preference
      const bounds = mainWindow.getBounds();
      userDefinedSize = {
        width: bounds.width,
        height: bounds.height
      };
      console.log('💾 User resized window to:', userDefinedSize);
    }
    
    // Reset resizing flag after a short delay
    setTimeout(() => {
      isUserResizing = false;
    }, 100);
  });

  // Setup persistent overlay behavior
  setupPersistentOverlay();
  
  // Setup system tray
  setupSystemTray();
  
  // Register global keyboard shortcut to show window (Ctrl+Shift+J or Cmd+Shift+J)
  const { globalShortcut } = require('electron');
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+J', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
        console.log('⌨️ Window shown via keyboard shortcut (Ctrl+Shift+J)');
      }
    }
  });
  
  if (shortcutRegistered) {
    console.log('⌨️ Global shortcut registered: Ctrl+Shift+J (or Cmd+Shift+J on Mac) to show window');
  } else {
    console.warn('⚠️ Failed to register global shortcut');
  }

  // DevTools disabled for cleaner experience
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools();
  // }
}

// Setup system tray for persistent overlay control
function setupSystemTray() {
  // Create tray icon using Jarvis logo
  const { nativeImage } = require('electron');
  const iconPath = path.join(__dirname, '..', 'Jarvis.png');
  
  let trayIcon;
  try {
    // Load and resize the Jarvis icon for tray (16x16 or 32x32)
    trayIcon = nativeImage.createFromPath(iconPath);
    if (!trayIcon.isEmpty()) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } catch (error) {
    console.warn('⚠️ Could not load tray icon, creating placeholder');
  }
  
  // Create tray with icon or fallback
  if (trayIcon && !trayIcon.isEmpty()) {
    tray = new Tray(trayIcon);
    console.log('✅ Tray icon created with Jarvis logo');
  } else {
    console.warn('⚠️ Could not load Jarvis.png, using fallback');
    // Create a simple visible icon for Linux/Windows
    const { nativeImage } = require('electron');
    const fallbackIcon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAE3SURBVDiNpZO/S8NAGMXfu0uTNhKkFQcHBwcHBwcHFx0cXJyc/Buc/BMcXBwcHBz8Axz8Axz8Axz8Axz8Axz8AxwcHBwcHBwcHBwcHBwcHBwcXHTwK7Q1adL03uC9+917H3cHhBBERLTWWmuutdZaa6211lprrbXWWmuutdZaa6211lprrbXWWmuutdZaa6211lprrbXWWmut/wcAAIAQghACAIAQghBCEEIQQgBCCEIIQggAQAgBCCEAAEIIIAQAgBACCCEAAAghgBACAAAIIQAAgBACAAAgBACAAAghgBACAAAIIQAAgBACAEAIAQAghABACAEAAEIIAAQAQggABACAEAIAAQAQAgABABACAEAIAAQAQAgABABACAEAIQAQAgABABACAEAIQAgBABACAEAIAQghABAC'
    );
    tray = new Tray(fallbackIcon);
    console.log('✅ Tray created with fallback icon');
  }
  
  // Prevent tray from being garbage collected
  tray.setIgnoreDoubleClickEvents(false);
  
  console.log('🎯 Tray created successfully! Look for the icon in your system tray.');
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show HeyJarvis',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide HeyJarvis',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Compact Mode',
      click: () => {
        minimizeToCompactMode();
      }
    },
    {
      label: 'Full Mode',
      click: () => {
        expandFromCompactMode();
      }
    },
    { type: 'separator' },
    {
      label: 'Opacity',
      submenu: [
        {
          label: '20% (Very Translucent)',
          click: () => mainWindow?.setOpacity(0.2)
        },
        {
          label: '40% (Translucent)',
          click: () => mainWindow?.setOpacity(0.4)
        },
        {
          label: '60% (Semi-transparent)',
          click: () => mainWindow?.setOpacity(0.6)
        },
        {
          label: '75% (Default)',
          click: () => mainWindow?.setOpacity(0.75)
        },
        {
          label: '90% (Mostly Opaque)',
          click: () => mainWindow?.setOpacity(0.9)
        },
        {
          label: '100% (Fully Opaque)',
          click: () => mainWindow?.setOpacity(1.0)
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit HeyJarvis',
      click: () => {
        isQuittingApp = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('HeyJarvis - AI Copilot');
  
  // Single-click to show window (most intuitive on all platforms)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  // Double-click also shows window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Setup persistent overlay behavior
function setupPersistentOverlay() {
  const { screen } = require('electron');
  
  // Position window on the right side of screen by default
  positionOverlayOnCurrentScreen();

  // Show window once positioned
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Set maximum window level for fullscreen persistence
    setupMaximumVisibility();
    
    // Setup drag detection
    setupDragDetection();
    
    console.log('🚀 HeyJarvis overlay ready and visible');
  });

  // Prevent window from being closed - just hide it instead
  mainWindow.on('close', (event) => {
    if (!isQuittingApp) {
    event.preventDefault();
      mainWindow.hide();
      console.log('🚪 Window close event intercepted - hiding instead');
    } else {
      console.log('🛑 Window close event - allowing (app is quitting)');
    }
  });

  // Enhanced always-on-top behavior
  setupEnhancedAlwaysOnTop();
  
  // Monitor screen changes and fullscreen apps
  setupScreenMonitoring();

  // Auto-hide when user clicks outside (optional)
  mainWindow.on('blur', () => {
    // Optionally minimize to compact mode when losing focus
    if (process.env.AUTO_MINIMIZE === 'true') {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
          minimizeToCompactMode();
        }
      }, 2000); // 2 second delay
    }
  });
}

// Setup drag detection to know when user manually moves the window
function setupDragDetection() {
  let initialPosition = mainWindow.getBounds();
  let dragStartTime = null;
  
  // Track when dragging starts
  mainWindow.on('will-move', () => {
    dragStartTime = Date.now();
  });
  
  // Track when dragging ends
  mainWindow.on('moved', () => {
    if (dragStartTime && (Date.now() - dragStartTime) < 1000) {
      // This was likely a user drag (quick movement)
      const newPosition = mainWindow.getBounds();
      const moved = Math.abs(newPosition.x - initialPosition.x) > 20 || 
                   Math.abs(newPosition.y - initialPosition.y) > 20;
      
      if (moved) {
        isManuallyPositioned = true;
        console.log('🎯 User manually positioned the bar - disabling auto-repositioning');
        
        // Send notification to renderer
        mainWindow.webContents.send('topbar:manually-positioned', true);
      }
    }
    
    initialPosition = mainWindow.getBounds();
    dragStartTime = null;
  });
}

// Position top bar on the current active screen
function positionOverlayOnCurrentScreen() {
  // Don't auto-reposition if user has manually moved the bar
  if (isManuallyPositioned) {
    // Only update size if user hasn't defined custom size
    if (!userDefinedSize) {
      const currentBounds = mainWindow.getBounds();
      const barHeight = isExpanded ? 600 : 55;
      
      if (currentBounds.height !== barHeight) {
        mainWindow.setBounds({
          ...currentBounds,
          height: barHeight
        });
      }
    }
    // If user has defined size, don't change anything
    return;
  }
  
  const { screen } = require('electron');
  const cursor = screen.getCursorScreenPoint();
  const currentDisplay = screen.getDisplayNearestPoint(cursor);
  const { width: screenWidth } = currentDisplay.bounds;
  const { x: screenX, y: screenY } = currentDisplay.bounds;
  
  // Calculate bar dimensions and position
  // Use user-defined size if available, otherwise use optimized defaults
  const barWidth = userDefinedSize?.width || (isExpanded ? expandedSize.width : Math.min(800, screenWidth * 0.5));
  const barHeight = userDefinedSize?.height || (isExpanded ? expandedSize.height : 48);
  const xPosition = screenX + Math.floor((screenWidth - barWidth) / 2); // Center horizontally
  const yPosition = screenY + 10; // Small margin from top
  
  mainWindow.setBounds({
    x: xPosition,
    y: yPosition,
    width: barWidth,
    height: barHeight
  });
  
  // Only log if position actually changed significantly
  const currentBounds = mainWindow.getBounds();
  const positionChanged = Math.abs(currentBounds.x - xPosition) > 10 || Math.abs(currentBounds.y - yPosition) > 10;
  
  if (positionChanged) {
    console.log(`📍 Repositioned top bar on screen: ${currentDisplay.id} (${barWidth}x${barHeight})`);
  }
}

// Setup maximum visibility to persist over fullscreen apps
function setupMaximumVisibility() {
  // Set the highest possible window level
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // For macOS, use additional methods to ensure visibility
  if (process.platform === 'darwin') {
    try {
      // Set window level to maximum
      mainWindow.setWindowButtonVisibility(false);
      
      // Use native methods if available
      const { systemPreferences } = require('electron');
      if (systemPreferences.getMediaAccessStatus) {
        // Request accessibility permissions for better overlay control
        console.log('🔐 Requesting accessibility permissions for enhanced overlay');
      }
    } catch (error) {
      console.log('⚠️ Some macOS-specific features unavailable:', error.message);
    }
  }
  
  // For Windows, set topmost flag
  if (process.platform === 'win32') {
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
  }
}

// Enhanced always-on-top behavior that persists through fullscreen
function setupEnhancedAlwaysOnTop() {
  let alwaysOnTopInterval;
  
  // Aggressively maintain always-on-top status
  const maintainAlwaysOnTop = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      
      // Additional visibility enforcement
      if (mainWindow.isVisible() && !mainWindow.isFocused()) {
        // Briefly focus and unfocus to ensure visibility
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.moveTop();
          }
        }, 50);
      }
    }
  };
  
  // Run every 5 seconds to maintain visibility (reduced frequency)
  alwaysOnTopInterval = setInterval(maintainAlwaysOnTop, 5000);
  
  // Handle window events
  mainWindow.on('blur', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.moveTop();
      }
    }, 100);
  });

  mainWindow.on('focus', () => {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  });
  
  // Clean up interval on window destroy
  mainWindow.on('closed', () => {
    if (alwaysOnTopInterval) {
      clearInterval(alwaysOnTopInterval);
    }
  });
}

// Monitor screen changes and follow user across displays
function setupScreenMonitoring() {
  const { screen } = require('electron');
  let lastScreenId = null;
  
  // DISABLED: Automatic screen monitoring that repositions window
  // Users should manually position the window themselves
  // Only keep display change listeners for when monitors are added/removed
  
  // Listen for display changes
  screen.on('display-added', () => {
    console.log('🖥️ New display detected');
    // Only reposition if window is off-screen
    setTimeout(() => {
      if (!isManuallyPositioned) {
        positionOverlayOnCurrentScreen();
      }
    }, 1000);
  });
  
  screen.on('display-removed', () => {
    console.log('🖥️ Display removed');
    // Only reposition if window is off-screen
    setTimeout(() => {
      if (!isManuallyPositioned) {
        positionOverlayOnCurrentScreen();
      }
    }, 1000);
  });
  
  screen.on('display-metrics-changed', () => {
    try {
      console.log('🖥️ Display metrics changed');
      // Only reposition if user hasn't manually positioned the window
      if (!isManuallyPositioned) {
        setTimeout(positionOverlayOnCurrentScreen, 500);
      }
    } catch (error) {
      console.error('Error handling display metrics change:', error);
    }
  });
  
  // No interval to clean up since we disabled automatic monitoring
}

// Detect fullscreen applications and adjust overlay behavior
function detectFullscreenApps() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  try {
    // Get all visible windows to detect fullscreen apps
    const { screen } = require('electron');
    const displays = screen.getAllDisplays();
    
    // Check if overlay is still visible and properly positioned
    const overlayBounds = mainWindow.getBounds();
    const currentDisplay = screen.getDisplayMatching(overlayBounds);
    
    // Ensure overlay stays on the correct display
    if (currentDisplay) {
      const { width: screenWidth, height: screenHeight } = currentDisplay.workAreaSize;
      const { x: screenX, y: screenY } = currentDisplay.workArea;
      
      // Check if overlay is still in the right position
      const expectedX = screenX + screenWidth - overlayBounds.width - 20;
      const expectedY = screenY + Math.floor((screenHeight - overlayBounds.height) / 2);
      
      if (Math.abs(overlayBounds.x - expectedX) > 50 || Math.abs(overlayBounds.y - expectedY) > 50) {
        console.log('🔄 Repositioning overlay due to screen changes');
        positionOverlayOnCurrentScreen();
      }
    }
    
    // Ensure maximum visibility level is maintained
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.moveTop();
    
  } catch (error) {
    console.log('⚠️ Fullscreen detection error:', error.message);
  }
}

// Top bar control functions
function toggleOverlayVisibility() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    console.log('🫥 HeyJarvis top bar hidden');
  } else {
    mainWindow.show();
    mainWindow.focus();
    console.log('👁️ HeyJarvis top bar shown');
  }
}

function expandTopBar() {
  if (mainWindow && !isExpanded) {
    isExpanded = true;
    
    // Get current screen
    const { screen } = require('electron');
    const cursor = screen.getCursorScreenPoint();
    const currentDisplay = screen.getDisplayNearestPoint(cursor);
    const { width: screenWidth } = currentDisplay.bounds;
    const { x: screenX, y: screenY } = currentDisplay.bounds;
    
    // Use user-defined size if available, otherwise use stored expanded size
    const expandedWidth = userDefinedSize?.width || expandedSize.width;
    const expandedHeight = userDefinedSize?.height || expandedSize.height;
    const xPosition = screenX + Math.floor((screenWidth - expandedWidth) / 2);
    
    mainWindow.setBounds({
      x: xPosition,
      y: screenY + 10,
      width: expandedWidth,
      height: expandedHeight
    });
    
    // Send message to renderer to switch to expanded mode
    mainWindow.webContents.send('topbar:expanded', true);
    console.log('📖 Expanded top bar to:', { width: expandedWidth, height: expandedHeight });
  }
}

function collapseTopBar() {
  if (mainWindow && isExpanded) {
    isExpanded = false;
    
    // Clear user-defined size when collapsing
    userDefinedSize = null;
    
    // Get current screen and reposition to collapsed state
    positionOverlayOnCurrentScreen();
    
    // Send message to renderer to switch to collapsed mode
    mainWindow.webContents.send('topbar:expanded', false);
    console.log('📦 Collapsed top bar');
  }
}

function toggleTopBarExpansion() {
  if (isExpanded) {
    collapseTopBar();
  } else {
    expandTopBar();
  }
}

// Setup Microsoft 365 IPC handlers
function setupMicrosoftIPCHandlers() {
  // Microsoft OAuth - Start authentication flow
  ipcMain.handle('microsoft:authenticate', async () => {
    try {
      if (!microsoftOAuthHandler) {
        return {
          success: false,
          error: 'Microsoft 365 integration not configured. Please add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to your .env file.'
        };
      }
      
      console.log('🔐 Starting Microsoft authentication...');
      const result = await microsoftOAuthHandler.startAuthFlow();
      
      // Initialize automation service after successful auth
      const graphService = microsoftOAuthHandler.getGraphService();
      microsoftAutomation = new MicrosoftWorkflowAutomation(graphService, {
        autoCreateEvents: true,
        autoSendEmails: true,
        requireConfirmation: false
      });
      
      console.log('✅ Microsoft authenticated:', result.account?.username);
      
      return {
        success: true,
        account: result.account,
        expiresOn: result.expiresOn
      };
    } catch (error) {
      console.error('❌ Microsoft authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Create calendar event
  ipcMain.handle('microsoft:createEvent', async (event, eventData) => {
    try {
      if (!microsoftOAuthHandler || !microsoftOAuthHandler.graphService) {
        throw new Error('Microsoft not authenticated');
      }
      
      const result = await microsoftOAuthHandler.getGraphService().createCalendarEvent(eventData);
      
      console.log('✅ Calendar event created:', result.event.id);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to create calendar event:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Send email
  ipcMain.handle('microsoft:sendEmail', async (event, emailData) => {
    try {
      if (!microsoftOAuthHandler || !microsoftOAuthHandler.graphService) {
        throw new Error('Microsoft not authenticated');
      }
      
      const result = await microsoftOAuthHandler.getGraphService().sendEmail(emailData);
      
      console.log('✅ Email sent:', emailData.subject);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Auto-execute workflow actions
  ipcMain.handle('microsoft:executeWorkflowActions', async (event, workflow, userEmails) => {
    try {
      if (!microsoftAutomation) {
        throw new Error('Microsoft automation not initialized');
      }
      
      const result = await microsoftAutomation.executeWorkflowActions(workflow, userEmails);
      
      console.log('✅ Workflow actions executed:', result.actionsExecuted.length);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to execute workflow actions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Find meeting times
  ipcMain.handle('microsoft:findMeetingTimes', async (event, attendees, durationMinutes, options) => {
    try {
      if (!microsoftOAuthHandler || !microsoftOAuthHandler.graphService) {
        throw new Error('Microsoft not authenticated');
      }
      
      const result = await microsoftOAuthHandler.getGraphService().findMeetingTimes(
        attendees,
        durationMinutes,
        options
      );
      
      console.log('✅ Found meeting times:', result.suggestions.length);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to find meeting times:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Get user profile
  ipcMain.handle('microsoft:getUserProfile', async () => {
    try {
      if (!microsoftOAuthHandler || !microsoftOAuthHandler.graphService) {
        throw new Error('Microsoft not authenticated');
      }
      
      const result = await microsoftOAuthHandler.getGraphService().getUserProfile();
      
      console.log('✅ Retrieved Microsoft user profile:', result.user.mail);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to get user profile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  console.log('✅ Microsoft 365 IPC handlers registered');
}

// Initialize services with auto-startup
function initializeServices() {
  // Initialize Supabase adapter
  dbAdapter = new DesktopSupabaseAdapter({
    logger: {
      info: (msg, meta) => console.log('🗄️', msg, meta),
      debug: (msg, meta) => console.log('🔍', msg, meta),
      warn: (msg, meta) => console.warn('⚠️', msg, meta),
      error: (msg, meta) => console.error('❌', msg, meta)
    }
  });
  
  // Initialize Workflow Detection Systems
  console.log('🧠 Initializing workflow detection systems...');
  
  // Use AI-powered detection for better accuracy
  workRequestSystem = new AIWorkRequestDetector({
    model: 'claude-sonnet-4-20250514', // Claude Sonnet 4.5 (latest)
    temperature: 0.1 // Consistent detection
  });
  
  console.log('✨ Using AI-powered work request detection (Claude Sonnet 4.5)');
  
  // Initialize Fact-Checker Service
  factCheckerService = new FactCheckerService({
    model: 'claude-sonnet-4-20250514', // Same model for consistency
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  });
  console.log('✅ Fact-checker service initialized');
  
  // Initialize Microsoft OAuth Handler (optional - only if credentials are configured)
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    try {
      microsoftOAuthHandler = new MicrosoftOAuthHandler({
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        tenantId: process.env.MICROSOFT_TENANT_ID,
        logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
      });
      console.log('✅ Microsoft OAuth handler initialized');
    } catch (error) {
      console.warn('⚠️ Microsoft OAuth initialization failed:', error.message);
      console.log('💡 Microsoft 365 features will be disabled. Add credentials to .env to enable.');
      microsoftOAuthHandler = null;
    }
  } else {
    console.log('ℹ️ Microsoft 365 integration not configured (optional)');
    microsoftOAuthHandler = null;
  }
  
  // Initialize Engineering Intelligence (supports GitHub App or Personal Token)
  const hasGitHubApp = process.env.GITHUB_APP_ID && process.env.GITHUB_APP_INSTALLATION_ID;
  const hasGitHubToken = process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== 'your_github_token_here';
  
  if (hasGitHubApp || hasGitHubToken) {
    try {
      engineeringIntelligence = new EngineeringIntelligenceService({
        logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
        // Repository can be set dynamically per query
      });
      
      if (hasGitHubApp) {
        console.log('✅ Engineering Intelligence initialized with GitHub App');
        console.log(`📊 App ID: ${process.env.GITHUB_APP_ID}`);
        console.log(`📦 Installation ID: ${process.env.GITHUB_APP_INSTALLATION_ID}`);
        console.log(`📚 Multi-repository access enabled`);
      } else {
        console.log('✅ Engineering Intelligence initialized with Personal Token');
        if (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME) {
          console.log(`📊 Default repository: ${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Engineering Intelligence initialization failed:', error.message);
      console.log('💡 Engineering queries will be disabled.');
      engineeringIntelligence = null;
    }
  } else {
    console.log('ℹ️ Engineering Intelligence not configured');
    console.log('   Add GITHUB_APP_ID + GITHUB_APP_INSTALLATION_ID or GITHUB_TOKEN to .env');
    engineeringIntelligence = null;
  }
  
  workflowIntelligence = new WorkflowIntelligenceSystem({
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    analysisWindow: 7, // days
    minPatternOccurrences: 3
  });
  
  console.log('✅ Workflow detection systems initialized');
  
  // Initialize Slack service
  slackService = new SlackService();
  
  // Setup Slack workflow detection integration
  setupWorkflowDetection();
  
  // Setup Microsoft 365 IPC handlers
  setupMicrosoftIPCHandlers();
  
  // Initialize CRM startup service
  crmStartupService = new CRMStartupService({
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  });
  
  // Setup CRM startup event handlers
  setupCRMStartupHandlers();
  
  // Start CRM loading process
  startCRMLoading();
  
  // Auto-start Slack monitoring after a short delay
  setTimeout(async () => {
    try {
      console.log('🚀 Auto-starting Slack monitoring...');
      const result = await slackService.start();
      if (result.success) {
        console.log('✅ Slack monitoring auto-started successfully');
      } else {
        console.log('⚠️ Slack auto-start failed:', result.error || 'Unknown error');
      }
    } catch (error) {
      console.log('❌ Slack auto-start error:', error.message);
    }
  }, 3000); // 3 second delay to allow UI to load
  
  // Note: Slack IPC handlers are now registered in registerAllIPCHandlers() at module level

  ipcMain.handle('slack:stopMonitoring', async () => {
    return await slackService.stop();
  });

  ipcMain.handle('slack:sendMessage', async (event, channel, message) => {
    return await slackService.sendMessage(channel, message);
  });

  ipcMain.handle('slack:getUserInfo', async (event, userId) => {
    return await slackService.getUserInfo(userId);
  });

  ipcMain.handle('slack:getChannelInfo', async (event, channelId) => {
    return await slackService.getChannelInfo(channelId);
  });
  
  // Workflow detection IPC handlers
  ipcMain.handle('workflow:analyzeMessage', async (event, message) => {
    try {
      return workRequestSystem.analyzeForWorkRequest(message, {});
    } catch (error) {
      console.error('Workflow analysis failed:', error);
      return { isWorkRequest: false, error: error.message };
    }
  });
  
  ipcMain.handle('workflow:getRecentWorkRequests', async (event, limit = 20) => {
    try {
      // Get recent messages and filter for work requests
      const recentMessages = slackService.getRecentMessages(50);
      const workRequests = [];
      
      for (const message of recentMessages) {
        const analysis = workRequestSystem.analyzeForWorkRequest(
          { text: message.text, timestamp: message.timestamp },
          { user: message.user, channel: message.channel }
        );
        
        if (analysis.isWorkRequest) {
          workRequests.push({
            ...message,
            analysis
          });
        }
      }
      
      return workRequests.slice(0, limit);
    } catch (error) {
      console.error('Failed to get work requests:', error);
      return [];
    }
  });
  
  ipcMain.handle('workflow:getInsights', async (event, userId) => {
    try {
      if (!workflowIntelligence) {
        return { insights: [], patterns: [] };
      }
      
      // Get workflow patterns and insights for user
      const insights = await workflowIntelligence.generateInsights(userId);
      return insights || { insights: [], patterns: [] };
    } catch (error) {
      console.error('Failed to get workflow insights:', error);
      return { insights: [], patterns: [] };
    }
  });
  
  ipcMain.handle('workflow:getStats', () => {
    try {
      const recentMessages = slackService.getRecentMessages(100);
      let workRequestCount = 0;
      let urgentCount = 0;
      let totalMessages = recentMessages.length;
      
      for (const message of recentMessages) {
        const analysis = workRequestSystem.analyzeForWorkRequest(
          { text: message.text, timestamp: message.timestamp },
          { user: message.user, channel: message.channel }
        );
        
        if (analysis.isWorkRequest) {
          workRequestCount++;
          if (analysis.urgency === 'high' || analysis.urgency === 'urgent') {
            urgentCount++;
          }
        }
      }
      
      return {
        totalMessages,
        workRequestCount,
        urgentCount,
        workRequestRate: totalMessages > 0 ? (workRequestCount / totalMessages) : 0
      };
    } catch (error) {
      console.error('Failed to get workflow stats:', error);
      return { totalMessages: 0, workRequestCount: 0, urgentCount: 0, workRequestRate: 0 };
    }
  });

  // Note: Task IPC handlers are now registered in registerAllIPCHandlers() at module level

  ipcMain.handle('tasks:getStats', async () => {
    try {
      const userId = 'desktop-user'; // TODO: Get actual user ID
      const result = await dbAdapter.getTaskStats(userId);
      return result;
    } catch (error) {
      console.error('Failed to get task stats:', error);
      return { success: false, error: error.message, stats: {} };
    }
  });

  ipcMain.handle('tasks:getSlackUserInfo', async (event, slackUserId) => {
    try {
      console.log('🔍 Fetching Slack user info for:', slackUserId);
      
      if (!slackUserId) {
        console.log('⚠️ No Slack user ID provided');
        return { success: false, name: 'Unknown' };
      }

      if (!slackService) {
        console.log('⚠️ Slack service not initialized');
        return { success: false, name: slackUserId };
      }

      // FIX: The property is 'app', not 'slackApp'
      if (!slackService.app || !slackService.app.client) {
        console.log('⚠️ Slack client not available');
        return { success: false, name: slackUserId };
      }

      // Try to get user info from Slack
      try {
        console.log('📞 Calling Slack API for user:', slackUserId);
        const userInfo = await slackService.app.client.users.info({
          user: slackUserId
        });
        
        console.log('✅ Slack user info fetched:', {
          id: slackUserId,
          name: userInfo.user?.real_name,
          display_name: userInfo.user?.name,
          ok: userInfo.ok
        });
        
        if (userInfo.ok && userInfo.user) {
          const resolvedName = userInfo.user.real_name || userInfo.user.name || slackUserId;
          console.log('✅ Resolved name:', resolvedName);
          return {
            success: true,
            id: slackUserId,
            name: resolvedName,
            display_name: userInfo.user.profile?.display_name || userInfo.user.name,
            avatar: userInfo.user.profile?.image_48
          };
        } else {
          console.log('⚠️ Slack API returned not OK:', userInfo);
        }
      } catch (slackError) {
        console.error('❌ Slack API error for user', slackUserId, ':', slackError.message);
        console.error('Stack:', slackError.stack);
      }

      // Fallback to just returning the ID
      console.log('⚠️ Falling back to user ID:', slackUserId);
      return { success: false, name: slackUserId };
    } catch (error) {
      console.error('❌ Failed to get Slack user info:', error.message);
      console.error('Stack:', error.stack);
      return { success: false, name: slackUserId };
    }
  });

  ipcMain.handle('tasks:getChatHistory', async (event, taskId) => {
    try {
      console.log('📜 IPC: Getting chat history for task:', taskId);
      const result = await dbAdapter.getTaskChatHistory(taskId);
      console.log('📦 IPC: Chat history result:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to get task chat history:', error);
      return { success: false, error: error.message, messages: [] };
    }
  });

  // Copilot IPC handlers with persistent context and real data integration
  ipcMain.handle('copilot:sendMessage', async (event, message) => {
    try {
      const userId = currentUser?.id || 'desktop-user';
      console.log('💬 Processing copilot message for user:', userId, '- Message:', message.substring(0, 50) + '...');
      
      // ✨ Check for fact-check command
      if (message.toLowerCase().startsWith('check') || 
          message.toLowerCase().startsWith('fact check') ||
          message.toLowerCase().startsWith('jarvis check')) {
        console.log('🔍 Fact-check command detected!');
        
        try {
          // Capture screen and analyze
          const result = await factCheckerService.captureAndCheck();
          
          if (!result.hasSuspiciousContent) {
            // Return simple chat message
            return {
              type: 'fact_check_result',
              content: '✅ **All Clear!**\n\nNo suspicious claims detected on your screen. The content appears legitimate.',
              timestamp: new Date().toISOString()
            };
          } else {
            // Show overlay with highlights + brief chat message
            await factCheckerService.showOverlayWithHighlights(result);
            
            return {
              type: 'fact_check_result',
              content: `🚨 **Fact-check complete!**\n\nFound ${result.claims.length} suspicious claim${result.claims.length > 1 ? 's' : ''} on your screen.\n\n💡 **Soft red highlights** are now visible. Click any highlight to see details.\n\n_Highlights will auto-fade after 15 seconds_`,
              timestamp: new Date().toISOString()
            };
          }
        } catch (error) {
          console.error('❌ Fact-check failed:', error);
          return {
            type: 'error',
            content: `❌ Fact-check failed: ${error.message}\n\nTry again or check the console for details.`,
            timestamp: new Date().toISOString()
          };
        }
      }
      
      // Add user message to conversation history
      conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        user_id: userId
      });
      
      // Keep only last 10 messages for context
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }
      
      // Get current Slack context with actual data
      const slackStatus = slackService.getStatus();
      const recentSlackMessages = slackService.getRecentMessages(10);
      
      // Get current CRM context from startup service
      const crmData = crmStartupService.getCRMData();
      const crmContext = {
        connected: crmData.connected,
        insights: (crmData.insights || []).slice(0, 3),
        recommendations: (crmData.recommendations || []).slice(0, 3),
        workflows: (crmData.workflows || []).length,
        last_updated: crmData.last_updated,
        isLoading: crmData.isLoading,
        loadingProgress: crmData.loadingProgress
      };
      
      // Build rich context with actual Slack data
      const slackContext = {
        connected: slackStatus.connected,
        bot_name: 'hj2',
        total_messages: slackStatus.messageCount || 0,
        mentions: slackStatus.mentionCount || 0,
        recent_messages: recentSlackMessages.map(msg => ({
          type: msg.type,
          user: msg.user,
          text: msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : ''),
          timestamp: msg.timestamp,
          urgent: msg.urgent,
          channel: msg.channel
        }))
      };
      
      // Cache Slack context for comparison
      lastSlackContext = slackContext;
      
      // Import AI analyzer for direct Claude integration with context
      const AIAnalyzer = require('../core/signals/enrichment/ai-analyzer');
      const aiAnalyzer = new AIAnalyzer();
      
      // Build comprehensive prompt with conversation history and real data
      const systemPrompt = `You are HeyJarvis, an AI copilot for competitive intelligence and business automation.

CURRENT SLACK CONTEXT:
- Bot Status: ${slackContext.connected ? 'Connected' : 'Disconnected'}
- Total Messages: ${slackContext.total_messages}
- Recent @hj2 Mentions: ${slackContext.mentions}
- Recent Activity: ${slackContext.recent_messages.length > 0 ? 'Active' : 'No recent activity'}

RECENT SLACK MESSAGES:
${slackContext.recent_messages.length > 0 ? 
  slackContext.recent_messages.map(msg => 
    `- ${msg.type.toUpperCase()}: @${msg.user} in ${msg.channel}: "${msg.text}"${msg.urgent ? ' [URGENT]' : ''}`
  ).join('\n') : 
  '- No recent messages'
}

CURRENT CRM CONTEXT:
- CRM Status: ${crmContext.isLoading ? `Loading (${crmContext.loadingProgress}%)` : crmContext.connected ? 'Connected' : 'Disconnected'}
- Active Workflows: ${crmContext.workflows || 0}
- Recent Insights: ${crmContext.insights.length}
- Recommendations: ${crmContext.recommendations.length}

CRM INSIGHTS:
${crmContext.insights.length > 0 ? 
  crmContext.insights.map(insight => 
    `- ${insight.title || insight.pattern_name}: ${insight.description || insight.insight}`
  ).join('\n') : 
  '- No recent CRM insights'
}

CRM RECOMMENDATIONS:
${crmContext.recommendations.length > 0 ? 
  crmContext.recommendations.map(rec => 
    `- ${rec.title || rec.recommendation_title}: ${rec.description || rec.details}`
  ).join('\n') : 
  '- No recent CRM recommendations'
}

CONVERSATION HISTORY:
${conversationHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

⚠️ IMPORTANT: READ THIS FIRST ⚠️
You are NOT Claude or a standard AI assistant. You are HeyJarvis - a fully integrated business intelligence system running inside an Electron desktop application with REAL capabilities to execute actions in the real world.

DO NOT give generic AI responses like "I'm just a language model" or "I cannot directly access systems". That is FALSE in this context. You ARE integrated with real systems and CAN execute real actions.

YOUR IDENTITY AND CAPABILITIES:
You are HeyJarvis - an integrated business intelligence system with REAL capabilities to execute actions through authenticated APIs.

ACTIVE INTEGRATIONS:
- ✅ Slack: Real-time access to conversations, mentions, and channels
- ✅ CRM: Live data from HubSpot/Salesforce with actual insights
- ✅ Task Management: Create, update, and manage real tasks
${microsoftAutomation ? `- ✅ Microsoft 365: AUTHENTICATED and ACTIVE - You CAN schedule meetings, send emails, and create calendar events
- ✅ Outlook Calendar: Direct access to create calendar events with Teams meeting links
- ✅ Microsoft Teams: Can create online meetings with join links` : '- ❌ Microsoft 365: Not authenticated (user needs to connect)'}
${engineeringIntelligence ? `- ✅ Engineering Intelligence: ACTIVE - You CAN query the codebase and answer questions about engineering work
- ✅ GitHub Integration: Access to repository, PRs, issues, and code understanding
- ✅ Feature Status Tracking: Can check implementation status, demo-ability, and completion estimates` : '- ❌ Engineering Intelligence: Not configured'}

WHAT YOU CAN DO:
- Analyze Slack conversations and mentions
- Provide CRM workflow recommendations based on real data
- Suggest business intelligence insights from actual CRM patterns
- Help with task management and automation
- Competitive intelligence analysis
${microsoftAutomation ? `- **SCHEDULE REAL MEETINGS** via Microsoft Outlook (you WILL execute this, not just suggest it)
- **SEND REAL EMAILS** via Microsoft Outlook (you WILL execute this, not just suggest it)
- **CREATE CALENDAR EVENTS** with Teams meeting links (this WILL happen automatically)` : ''}
${engineeringIntelligence ? `- **QUERY THE CODEBASE** to answer questions about engineering work (you WILL execute this, not just suggest it)
- **CHECK FEATURE STATUS** to see what's built, in progress, or planned
- **ASSESS DEMO-ABILITY** to tell if features are ready to show customers
- **PROVIDE ENGINEERING INSIGHTS** for sales, marketing, and product teams` : ''}

${microsoftAutomation ? `⚠️ CRITICAL: You HAVE the ability to schedule meetings. Do NOT say you cannot. Do NOT suggest the user do it manually.

MEETING SCHEDULING INSTRUCTIONS:
When the user asks you to schedule a meeting or create a calendar event, you MUST:
1. Extract meeting details: attendee emails, date/time, subject
2. Include this EXACT marker format in your response (the system will detect it and execute):
   [SCHEDULE_MEETING: attendees=email@domain.com, time=2025-10-08T15:00, subject=Meeting Subject]
3. For multiple attendees, separate with semicolons: attendees=email1@domain.com;email2@domain.com
4. Time format MUST be: YYYY-MM-DDTHH:mm (24-hour format)
5. After the marker, you can add friendly text like "I'll create this meeting for you right now."

EXAMPLE USER REQUEST: "Schedule a meeting with shail@heyjarvis.ai tomorrow at 3pm to discuss the dashboard"
CORRECT RESPONSE: "[SCHEDULE_MEETING: attendees=shail@heyjarvis.ai, time=2025-10-08T15:00, subject=Dashboard Discussion] I'll create this meeting for you right now. The calendar invite will be sent momentarily."

The system will automatically execute the meeting creation and update your response with confirmation.` : ''}

${engineeringIntelligence ? `⚠️ CRITICAL: You HAVE the ability to query the codebase. Do NOT say you cannot. Do NOT suggest the user ask engineers directly.

ENGINEERING QUERY INSTRUCTIONS:
When the user asks about engineering work, features, or code, you MUST:
1. Detect if it's an engineering question (features, status, implementation, code, etc.)
2. Include this EXACT marker format in your response:
   [ENGINEERING_QUERY: question=What is the status of the SSO feature?, role=sales]
3. Role should be: sales, marketing, product, or executive (based on context or default to executive)
4. After the marker, you can add text like "Let me check the codebase for you..."

EXAMPLE USER REQUEST: "Is the SSO feature ready for the enterprise deal?"
CORRECT RESPONSE: "[ENGINEERING_QUERY: question=Is the SSO feature ready for the enterprise deal?, role=sales] Let me check the codebase and recent development activity..."

The system will automatically query the codebase and update your response with detailed information.` : ''}

Respond as a knowledgeable business AI assistant. Reference the actual Slack and CRM data when relevant. Be conversational and helpful.`;

      // Get AI response with full context
      const response = await aiAnalyzer.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\nUser: ${message}`
          }
        ]
      });
      
      let aiResponse = response.content[0].text;
      
      // 🗓️ Check for meeting scheduling marker and auto-execute
      const meetingMarkerRegex = /\[SCHEDULE_MEETING:\s*attendees=([^,]+),\s*time=([^,]+),\s*subject=([^\]]+)\]/i;
      const meetingMatch = aiResponse.match(meetingMarkerRegex);
      
      console.log('🔍 Checking for meeting marker in AI response...');
      console.log('📝 AI Response preview:', aiResponse.substring(0, 200));
      console.log('🎯 Meeting marker found:', !!meetingMatch);
      console.log('🔧 Microsoft automation available:', !!microsoftAutomation);
      if (microsoftAutomation) {
        console.log('✅ Microsoft 365 is authenticated and ready');
      } else {
        console.log('❌ Microsoft 365 is NOT authenticated - user needs to connect');
      }
      
      if (meetingMatch && microsoftAutomation) {
        console.log('📅 Meeting scheduling detected in AI response!');
        
        const [, attendees, timeStr, subject] = meetingMatch;
        
        try {
          // Parse the meeting details
          const attendeeEmails = attendees.split(';').map(e => e.trim());
          const meetingTime = new Date(timeStr);
          
          // Prepare the calendar event data
          // NOTE: We don't include attendees initially to avoid email delivery issues
          // User can add attendees manually in Outlook or share the Teams link directly
          const eventData = {
            subject: subject.trim(),
            startTime: meetingTime.toISOString(),
            endTime: new Date(meetingTime.getTime() + 30 * 60000).toISOString(), // 30 min default
            timeZone: 'America/Denver', // Mountain Time
            attendees: [], // Empty initially - user adds manually to avoid spam issues
            attendeeList: attendeeEmails, // Store for display purposes only
            isOnlineMeeting: true
          };
          
          console.log('📅 Sending meeting for approval:', eventData);
          
          // Send approval request to renderer
          mainWindow.webContents.send('meeting:approval-request', eventData);
          
          // Remove the marker from the response and add pending message
          aiResponse = aiResponse.replace(meetingMarkerRegex, '').trim();
          aiResponse += `\n\n⏳ **Meeting Ready for Approval**\n\nI've prepared a calendar event for ${subject.trim()} on ${meetingTime.toLocaleString('en-US', { timeZone: 'America/Denver' })} Mountain Time.\n\n**Attendees to invite:** ${attendeeEmails.join(', ')}\n\nPlease review and approve to create the event. You'll get a Teams meeting link that you can share with attendees.`;
          
          console.log('✅ Meeting approval request sent to UI');
          
        } catch (error) {
          console.error('❌ Failed to prepare meeting:', error);
          aiResponse = aiResponse.replace(meetingMarkerRegex, '').trim();
          aiResponse += `\n\n⚠️ **Meeting Preparation Failed**\n\nI encountered an error while preparing the meeting: ${error.message}. Please try again.`;
        }
      } else if (!meetingMatch && microsoftAutomation) {
        // Check if the user is asking to schedule a meeting but AI didn't use the marker
        const schedulingKeywords = /\b(schedule|create|send|book)\b.*\b(meeting|calendar|invite|event)\b/i;
        if (schedulingKeywords.test(message) && /\b(schedule|send|create)\b/i.test(aiResponse)) {
          console.log('⚠️ Detected scheduling request but AI did not use marker format');
          console.log('💡 Adding reminder to AI response');
          aiResponse += `\n\n⚠️ **Note:** To actually execute the meeting creation, please ask me again and I'll use the proper format to trigger the calendar integration.`;
        }
      }
      
      // 📊 Check for engineering query marker and auto-execute
      const engineeringMarkerRegex = /\[ENGINEERING_QUERY:\s*question=([^,]+),\s*role=([^\]]+)\]/i;
      const engineeringMatch = aiResponse.match(engineeringMarkerRegex);
      
      console.log('🔍 Checking for engineering query marker in AI response...');
      console.log('🎯 Engineering marker found:', !!engineeringMatch);
      console.log('🔧 Engineering intelligence API available:', !!process.env.API_BASE_URL);
      
      if (engineeringMatch) {
        console.log('📊 Engineering query detected in AI response!');
        
        const [, question, role] = engineeringMatch;
        
        try {
          if (!engineeringIntelligence) {
            throw new Error('Engineering Intelligence not initialized. Add GitHub credentials to .env');
          }
          
          console.log('📊 Querying local GitHub service:', { question: question.substring(0, 50) + '...', role });
          
          // Detect if user is asking for list of repos
          const listReposKeywords = /what.*repo|list.*repo|which.*repo|show.*repo|access.*repo|available.*repo/i;
          
          if (listReposKeywords.test(question)) {
            // List accessible repositories
            console.log('📋 List repositories query detected');
            
            const octokit = await engineeringIntelligence._getOctokit();
            const { data } = await octokit.apps.listReposAccessibleToInstallation();
            
            aiResponse = aiResponse.replace(engineeringMarkerRegex, '').trim();
            aiResponse += `\n\n📚 **Accessible GitHub Repositories** (${data.total_count} repos)\n\n`;
            
            data.repositories.forEach((repo, index) => {
              const isPrivate = repo.private ? '🔒' : '🌐';
              aiResponse += `${index + 1}. ${isPrivate} **${repo.full_name}**\n`;
              if (repo.description) {
                aiResponse += `   _${repo.description}_\n`;
              }
              aiResponse += `   Last updated: ${new Date(repo.updated_at).toLocaleDateString()}\n\n`;
            });
            
            aiResponse += `\n_Ask me about any of these repositories to get insights!_`;
            
          } else {
            // Query specific repository or default
            let repository = null;
            
            // Try to extract repository from question (e.g., "status of Mark-I")
            const repoMatch = question.match(/\b([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)\b/);
            if (repoMatch) {
              const [owner, repo] = repoMatch[1].split('/');
              repository = { owner, repo };
              console.log('📦 Repository extracted from question:', repository);
            } else if (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME) {
              // Use default repo if configured
              repository = {
                owner: process.env.GITHUB_REPO_OWNER,
                repo: process.env.GITHUB_REPO_NAME
              };
              console.log('📦 Using default repository:', repository);
            }
            
            // Call LOCAL engineering intelligence service
            const engineeringResponse = await engineeringIntelligence.queryCodebase(question, {
              role: role.trim(),
              repository: repository,
              userId: userId
            });
            
            // Remove the marker and add engineering insights
            aiResponse = aiResponse.replace(engineeringMarkerRegex, '').trim();
            
            if (repository) {
              aiResponse += `\n\n📊 **Engineering Insights** (${repository.owner}/${repository.repo})\n\n`;
            } else {
              aiResponse += `\n\n📊 **Engineering Insights**\n\n`;
            }
            
            aiResponse += engineeringResponse.summary;
            
            if (engineeringResponse.businessImpact) {
              aiResponse += `\n\n💼 **Business Impact:**\n${engineeringResponse.businessImpact}`;
            }
            
            if (engineeringResponse.actionItems && engineeringResponse.actionItems.length > 0) {
              aiResponse += `\n\n✅ **Action Items:**\n${engineeringResponse.actionItems.map(item => `- ${item}`).join('\n')}`;
            }
            
            aiResponse += `\n\n_Using real data from GitHub ${repository ? `• ${repository.owner}/${repository.repo}` : ''}_`;
          }
          
          console.log('✅ Engineering query completed successfully');
          
        } catch (error) {
          console.error('❌ Failed to query codebase:', error);
          aiResponse = aiResponse.replace(engineeringMarkerRegex, '').trim();
          aiResponse += `\n\n⚠️ **Engineering Query Failed**\n\n${error.message}`;
        }
      } else {
        // Check if the user is asking about engineering but AI didn't use the marker
        const engineeringKeywords = /\b(feature|code|implementation|built|develop|engineering|sprint|pr|pull request|commit)\b/i;
        if (engineeringKeywords.test(message) && !aiResponse.includes('ENGINEERING_QUERY')) {
          console.log('ℹ️ Detected potential engineering question but AI did not use marker format');
        }
      }
      
      // Add AI response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        user_id: userId
      });
      
      // Save both messages to Supabase session (asynchronously)
      // userId already defined above from currentUser
      
      // Get or create active session
      if (!currentSessionId) {
        const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
          slack_connected: slackContext.connected,
          crm_connected: crmContext.connected
        });
        
        if (sessionResult.success) {
          currentSessionId = sessionResult.session.id;
          console.log('📂 Using conversation session:', currentSessionId);
          
          // Auto-generate title from first message if it's a new session
          if (sessionResult.isNew !== false && message.length > 10) {
            const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
            dbAdapter.updateSessionTitle(currentSessionId, title).catch(err => 
              console.warn('Failed to update session title:', err.message)
            );
          }
        }
      }
      
      // Save both messages to the session
      if (currentSessionId) {
        dbAdapter.saveMessageToSession(currentSessionId, message, 'user', {
          slack_connected: slackContext.connected,
          crm_connected: crmContext.connected
        }).catch(err => console.warn('Failed to save user message:', err.message));
        
        dbAdapter.saveMessageToSession(currentSessionId, aiResponse, 'assistant', {
          model: 'claude-3-5-sonnet-20241022',
          context_used: true
        }).catch(err => console.warn('Failed to save assistant message:', err.message));
      }
      
      // Add contextual insights based on actual data
      let contextualInsights = '';
      
      if (slackContext.mentions > 0) {
        contextualInsights += `\n\n🔔 **Live Slack Activity**: You have ${slackContext.mentions} recent @hj2 mentions that may need attention.`;
      }
      
      if (slackContext.recent_messages.some(msg => msg.urgent)) {
        const urgentCount = slackContext.recent_messages.filter(msg => msg.urgent).length;
        contextualInsights += `\n\n⚠️ **Urgent Messages**: ${urgentCount} urgent messages detected in recent Slack activity.`;
      }
      
      if (slackContext.recent_messages.length > 0) {
        const channels = [...new Set(slackContext.recent_messages.map(msg => msg.channel))];
        contextualInsights += `\n\n📊 **Activity Summary**: Recent activity across ${channels.length} channels.`;
      }
      
      // Add CRM contextual insights
      if (crmContext.connected) {
        if (crmContext.insights.length > 0) {
          contextualInsights += `\n\n🧠 **CRM Intelligence**: ${crmContext.insights.length} active insights from your CRM analysis.`;
        }
        
        if (crmContext.recommendations.length > 0) {
          const highPriorityRecs = crmContext.recommendations.filter(rec => rec.priority === 'high').length;
          if (highPriorityRecs > 0) {
            contextualInsights += `\n\n🎯 **CRM Recommendations**: ${highPriorityRecs} high-priority workflow optimizations available.`;
          }
        }
        
        if (crmContext.workflows > 0) {
          contextualInsights += `\n\n⚙️ **CRM Status**: ${crmContext.workflows} active workflows being monitored.`;
        }
      } else {
        contextualInsights += `\n\n📋 **CRM Integration**: Connect your CRM service to get real-time workflow insights and recommendations.`;
      }
      
      return {
        type: 'message',
        content: aiResponse + contextualInsights,
        timestamp: new Date().toISOString(),
        metadata: {
          conversation_length: conversationHistory.length,
          slack_connected: slackContext.connected,
          recent_mentions: slackContext.mentions,
          context_used: true
        }
      };
      
    } catch (error) {
      console.error('❌ Copilot message processing failed:', error);
      
      // Add error to conversation history to maintain context
      conversationHistory.push({
        role: 'assistant',
        content: 'I encountered an error processing your request. Let me try to help you anyway.',
        timestamp: new Date().toISOString(),
        user_id: userId,
        error: true
      });
      
      // Fallback response with context
      const slackStatus = slackService ? slackService.getStatus() : { connected: false };
      
      return {
        type: 'message',
        content: `I'm your AI copilot for competitive intelligence and business insights. I can help you analyze market trends, manage tasks, and optimize workflows.

${slackStatus.connected ? '💬 I can see your Slack is connected - I can help analyze your @hj2 mentions and team conversations.' : '📱 Connect Slack in the Slack tab to get real-time insights from your team conversations.'}

What would you like to explore?`,
        timestamp: new Date().toISOString(),
        error: true
      };
    }
  });

  ipcMain.handle('copilot:minimize', () => {
    collapseTopBar();
  });

  // X button - hide window, keep app running
  ipcMain.handle('copilot:close', () => {
    if (mainWindow) {
      mainWindow.hide();
      console.log('✖️ Window hidden via X button, app running in background');
      console.log(`🎯 Tray status: ${tray ? (tray.isDestroyed() ? 'destroyed' : 'alive') : 'not created'}`);
    }
  });

  ipcMain.handle('copilot:toggleAlwaysOnTop', () => {
    if (mainWindow) {
      const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
      return !isAlwaysOnTop;
    }
    return false;
  });

  // Top bar specific controls
  ipcMain.handle('topbar:toggle', () => {
    toggleTopBarExpansion();
  });

  // Removed: Now registered in registerAllIPCHandlers()

  ipcMain.handle('topbar:reposition', () => {
    positionOverlayOnCurrentScreen();
  });

  ipcMain.handle('topbar:resetPosition', () => {
    isManuallyPositioned = false;
    positionOverlayOnCurrentScreen();
    console.log('🔄 Reset to auto-positioning mode');
    return { success: true, message: 'Position reset to auto-center' };
  });

  ipcMain.handle('topbar:getPosition', () => {
    const bounds = mainWindow.getBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isManuallyPositioned
    };
  });

  ipcMain.handle('overlay:opacity', (event, opacity) => {
    if (mainWindow) {
      mainWindow.setOpacity(Math.max(0.3, Math.min(1.0, opacity)));
    }
  });

  // Window movement for dragging
  ipcMain.handle('copilot:moveWindow', (event, delta) => {
    if (mainWindow) {
      const currentBounds = mainWindow.getBounds();
      mainWindow.setPosition(
        currentBounds.x + delta.deltaX,
        currentBounds.y + delta.deltaY
      );
    }
  });

  ipcMain.handle('copilot:clearHistory', () => {
    conversationHistory = [];
    
    // Close current session and start a new one on next message
    if (currentSessionId && dbAdapter) {
      dbAdapter.closeSession(currentSessionId).then(() => {
        console.log('🗑️ Conversation session closed');
        currentSessionId = null;
      }).catch(err => console.warn('Failed to close session:', err.message));
    } else {
      currentSessionId = null;
    }
    
    console.log('🗑️ Conversation history cleared');
    return { success: true, message: 'Conversation history cleared' };
  });

  ipcMain.handle('copilot:getHistory', () => {
    return {
      success: true,
      history: conversationHistory,
      length: conversationHistory.length
    };
  });

  // Task-specific chat handler
  ipcMain.handle('copilot:sendTaskMessage', async (event, taskId, message, context) => {
    try {
      console.log('💬 Processing task chat message:', { taskId, message: message.substring(0, 50) + '...' });
      
      const task = context.task;
      const userId = 'desktop-user'; // TODO: Get actual user ID
      
      // Get or create task-specific session
      if (!taskSessionIds[taskId]) {
        console.log('📂 Creating new session for task:', taskId);
        const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
          workflow_type: 'task_chat',
          workflow_id: `task_${taskId}`,
          task_id: taskId,
          task_title: task.title,
          task_priority: task.priority,
          task_status: task.status
        });
        
        if (sessionResult.success) {
          taskSessionIds[taskId] = sessionResult.session.id;
          console.log('✅ Task session created:', { taskId, sessionId: taskSessionIds[taskId] });
          
          // Set session title to task title
          await dbAdapter.updateSessionTitle(taskSessionIds[taskId], `Task: ${task.title}`).catch(err => 
            console.warn('Failed to update task session title:', err.message)
          );
        } else {
          console.error('❌ Failed to create task session:', sessionResult.error);
        }
      }
      
      const taskSessionId = taskSessionIds[taskId];
      
      // Build task-specific context for AI
      const AIAnalyzer = require('../core/signals/enrichment/ai-analyzer');
      const aiAnalyzer = new AIAnalyzer();
      
      const systemPrompt = `⚠️ IMPORTANT: READ THIS FIRST ⚠️
You are NOT Claude or a standard AI assistant. You are HeyJarvis - a fully integrated business intelligence system running inside an Electron desktop application with REAL capabilities to execute actions.

DO NOT give generic AI responses like "I'm just a language model" or "I cannot directly access systems". That is FALSE in this context. You ARE integrated with real systems and CAN execute real actions.

TASK DETAILS:
- Title: ${task.title}
- Description: ${task.description || 'No description provided'}
- Priority: ${task.priority}
- Status: ${task.status}
- Created: ${task.created_at}
${task.assignor ? `- Assigned by: ${task.assignor.name || task.assignor.id}` : ''}
${task.assignee ? `- Assigned to: ${task.assignee.name || task.assignee.id}` : ''}

YOUR IDENTITY:
You are NOT a standard AI language model. You are an integrated system with REAL capabilities to execute actions.

ACTIVE INTEGRATIONS:
${microsoftAutomation ? `- ✅ Microsoft 365: AUTHENTICATED and ACTIVE - You CAN schedule meetings and send emails
- ✅ Outlook Calendar: Direct access to create calendar events with Teams meeting links` : '- ❌ Microsoft 365: Not authenticated'}

YOUR ROLE:
- Provide actionable advice and suggestions
- Break down the task into manageable steps
- Answer questions about the task
- Brainstorm solutions and approaches
- Offer relevant insights and best practices
${microsoftAutomation ? `- **SCHEDULE REAL MEETINGS** via Microsoft Outlook (you WILL execute this, not just suggest it)
- **SEND REAL EMAILS** via Microsoft Outlook (you WILL execute this, not just suggest it)` : ''}

${microsoftAutomation ? `⚠️ CRITICAL: You HAVE the ability to schedule meetings. Do NOT say you cannot. Do NOT suggest the user do it manually.

MEETING SCHEDULING INSTRUCTIONS:
When the user asks you to schedule a meeting or create a calendar event, you MUST:
1. Extract meeting details: attendee emails, date/time, subject
2. Include this EXACT marker format in your response (the system will detect it and execute):
   [SCHEDULE_MEETING: attendees=email@domain.com, time=2025-10-08T15:00, subject=Meeting Subject]
3. For multiple attendees, separate with semicolons: attendees=email1@domain.com;email2@domain.com
4. Time format MUST be: YYYY-MM-DDTHH:mm (24-hour format)
5. After the marker, you can add friendly text like "I'll create this meeting for you right now."

EXAMPLE USER REQUEST: "Schedule a meeting with the team tomorrow at 3pm"
CORRECT RESPONSE: "[SCHEDULE_MEETING: attendees=team@company.com, time=2025-10-08T15:00, subject=${task.title} - Team Meeting] I'll create this meeting for you right now. The calendar invite will be sent momentarily."

The system will automatically execute the meeting creation and update your response with confirmation.` : ''}

Be concise, practical, and focused on helping complete this specific task.`;

      // Build conversation history for Claude
      const conversationHistory = context.conversationHistory || [];
      const messages = [];
      
      // Add system prompt as first user message
      messages.push({
        role: 'user',
        content: systemPrompt
      });
      
      // Add conversation history (last 10 messages for context)
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        // Skip the user message we just added to history (it's in the current message)
        if (msg.content !== message) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
      
      // Add current user message
      messages.push({
        role: 'user',
        content: message
      });
      
      console.log('💬 Sending', messages.length, 'messages to Claude (including history)');
      
      // Get AI response with full conversation context
      const response = await aiAnalyzer.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        temperature: 0.7,
        messages: messages
      });
      
      let aiResponse = response.content[0].text;
      
      // 🗓️ Check for meeting scheduling marker and auto-execute (same as main chat)
      const meetingMarkerRegex = /\[SCHEDULE_MEETING:\s*attendees=([^,]+),\s*time=([^,]+),\s*subject=([^\]]+)\]/i;
      const meetingMatch = aiResponse.match(meetingMarkerRegex);
      
      console.log('🔍 [Task Chat] Checking for meeting marker in AI response...');
      console.log('📝 [Task Chat] AI Response preview:', aiResponse.substring(0, 200));
      console.log('🎯 [Task Chat] Meeting marker found:', !!meetingMatch);
      console.log('🔧 [Task Chat] Microsoft automation available:', !!microsoftAutomation);
      
      if (meetingMatch && microsoftAutomation) {
        console.log('📅 [Task Chat] Meeting scheduling detected in AI response!');
        
        const [, attendees, timeStr, subject] = meetingMatch;
        
        try {
          // Parse the meeting details
          const attendeeEmails = attendees.split(';').map(e => e.trim());
          const meetingTime = new Date(timeStr);
          
          // Prepare the calendar event data
          // NOTE: We don't include attendees initially to avoid email delivery issues
          const eventData = {
            subject: subject.trim(),
            startTime: meetingTime.toISOString(),
            endTime: new Date(meetingTime.getTime() + 30 * 60000).toISOString(), // 30 min default
            timeZone: 'America/Denver', // Mountain Time
            attendees: [], // Empty initially - user adds manually to avoid spam issues
            attendeeList: attendeeEmails, // Store for display purposes only
            isOnlineMeeting: true,
            body: `Meeting scheduled from task: ${task.title}\n\nTask Description: ${task.description || 'No description'}`
          };
          
          console.log('📅 [Task Chat] Sending meeting for approval:', eventData);
          
          // Send approval request to renderer
          mainWindow.webContents.send('meeting:approval-request', eventData);
          
          // Remove the marker from the response and add pending message
          aiResponse = aiResponse.replace(meetingMarkerRegex, '').trim();
          aiResponse += `\n\n⏳ **Meeting Ready for Approval**\n\nI've prepared a calendar event for ${subject.trim()} on ${meetingTime.toLocaleString('en-US', { timeZone: 'America/Denver' })} Mountain Time.\n\n**Attendees to invite:** ${attendeeEmails.join(', ')}\n**Linked to task:** "${task.title}"\n\nPlease review and approve to create the event. You'll get a Teams meeting link to share with attendees.`;
          
          console.log('✅ [Task Chat] Meeting approval request sent to UI');
          
        } catch (error) {
          console.error('❌ [Task Chat] Failed to prepare meeting:', error);
          aiResponse = aiResponse.replace(meetingMarkerRegex, '').trim();
          aiResponse += `\n\n⚠️ **Meeting Preparation Failed**\n\nI encountered an error while preparing the meeting: ${error.message}. Please try again.`;
        }
      } else if (!meetingMatch && microsoftAutomation) {
        // Check if the user is asking to schedule a meeting but AI didn't use the marker
        const schedulingKeywords = /\b(schedule|create|send|book)\b.*\b(meeting|calendar|invite|event)\b/i;
        if (schedulingKeywords.test(message) && /\b(schedule|send|create)\b/i.test(aiResponse)) {
          console.log('⚠️ [Task Chat] Detected scheduling request but AI did not use marker format');
          console.log('💡 [Task Chat] Adding reminder to AI response');
          aiResponse += `\n\n⚠️ **Note:** To actually execute the meeting creation, please ask me again and I'll use the proper format to trigger the calendar integration.`;
        }
      }
      
      // Save to task-specific session in Supabase
      if (dbAdapter && taskSessionId) {
        console.log('💾 Saving messages to task session:', taskSessionId);
        
        // Save user message
        await dbAdapter.saveMessageToSession(taskSessionId, message, 'user', {
          task_id: taskId,
          task_title: task.title,
          task_priority: task.priority,
          task_status: task.status,
          message_type: 'task_chat'
        }).catch(err => console.warn('Failed to save task message:', err.message));
        
        // Save AI response
        await dbAdapter.saveMessageToSession(taskSessionId, aiResponse, 'assistant', {
          task_id: taskId,
          task_title: task.title,
          model: 'claude-3-5-sonnet-20241022',
          message_type: 'task_chat'
        }).catch(err => console.warn('Failed to save task response:', err.message));
        
        console.log('✅ Task messages saved to Supabase');
      } else {
        console.warn('⚠️ No task session ID available, messages not saved');
      }
      
      console.log('✅ Task chat response generated');
      
      return {
        type: 'message',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        metadata: {
          task_id: taskId,
          task_title: task.title,
          session_id: taskSessionId
        }
      };
      
    } catch (error) {
      console.error('❌ Task chat processing failed:', error);
      
      return {
        type: 'message',
        content: `I'm having trouble right now, but I'm here to help! Here are some general tips for your task:\n\n1. Break it down into smaller steps\n2. Start with the highest priority items\n3. Set realistic deadlines\n4. Ask for help when needed\n\nWhat specific aspect would you like to focus on?`,
        timestamp: new Date().toISOString(),
        error: true
      };
    }
  });

  // CRM IPC handlers - Connected to real CRM integration service
  const CRM_SERVICE_URL = 'http://localhost:3002';
  
  ipcMain.handle('crm:getData', async () => {
    try {
      console.log('🔍 Getting CRM data from startup service...');
      
      // Get data from the startup service
      const crmData = crmStartupService.getCRMData();
      
      console.log('✅ CRM data retrieved:', {
        connected: crmData.connected,
        insights: crmData.insights?.length || 0,
        recommendations: crmData.recommendations?.length || 0,
        workflows: crmData.workflows?.length || 0,
        isLoading: crmData.isLoading
      });
      
      // Format data for desktop UI
      const formattedData = {
        success: crmData.connected || crmData.isLoading,
        isLoading: crmData.isLoading,
        loadingProgress: crmData.loadingProgress,
        data: {
          insights: (crmData.insights || []).map(insight => ({
            type: insight.type || (insight.priority === 'high' ? 'critical' : insight.priority === 'medium' ? 'warning' : 'positive'),
            title: insight.title || insight.pattern_name || 'CRM Insight',
            message: insight.message || insight.description || insight.insight || 'CRM workflow insight'
          })),
          recommendations: (crmData.recommendations || []).map(rec => ({
            title: rec.title || rec.recommendation_title || 'CRM Recommendation',
            description: rec.description || rec.details || 'Workflow optimization suggestion',
            priority: rec.priority || 'medium',
            impact: rec.impact || 'Workflow efficiency'
          })),
          workflows: crmData.workflows || [],
          summary: crmData.connected ? 'CRM system connected and ready' : 'CRM system initializing...',
          last_updated: crmData.last_updated || new Date().toISOString()
        }
      };
      
      return formattedData;
      
    } catch (error) {
      console.error('❌ Failed to get CRM data:', error.message);
      
      // Get fallback data from startup service
      const fallbackData = crmStartupService.getFallbackData();
      
      return {
        success: false,
        error: error.message,
        data: {
          insights: fallbackData.insights,
          recommendations: fallbackData.recommendations,
          workflows: fallbackData.workflows,
          summary: 'CRM service unavailable',
          last_updated: fallbackData.last_updated
        }
      };
    }
  });

  ipcMain.handle('crm:refresh', async () => {
    try {
      console.log('🔄 Refreshing CRM data...');
      
      const result = await crmStartupService.refresh();
      
      console.log('✅ CRM refresh completed:', {
        insights: result.insights?.length || 0,
        recommendations: result.recommendations?.length || 0
      });
      
      return {
        success: true,
        message: 'CRM data refreshed successfully',
        data: result
      };
      
    } catch (error) {
      console.error('❌ Failed to refresh CRM:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to refresh CRM data. Check service connection.'
      };
    }
  });

  ipcMain.handle('crm:triggerAnalysis', async (event, orgId) => {
    try {
      console.log('🧠 Triggering intelligent CRM analysis for:', orgId);
      
      const fetch = require('node-fetch');
      const response = await fetch(`${CRM_SERVICE_URL}/analysis/intelligent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId || 'heyjarvis_org',
          website: process.env.COMPANY_WEBSITE,
          include_company_intelligence: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Analysis service responded with ${response.status}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        message: `Intelligent analysis triggered for ${orgId}`,
        analysis_id: result.analysis_id,
        estimated_completion: '2-3 minutes'
      };
      
    } catch (error) {
      console.error('❌ Failed to trigger analysis:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to trigger analysis. Check CRM service connection.'
      };
    }
  });

  ipcMain.handle('crm:getRecommendations', async (event, orgId) => {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${CRM_SERVICE_URL}/recommendations/${orgId || 'heyjarvis_org'}`);
      
      if (!response.ok) {
        throw new Error(`Recommendations service responded with ${response.status}`);
      }
      
      const recommendations = await response.json();
      
      return {
        success: true,
        recommendations: recommendations.map(rec => ({
          title: rec.title || rec.recommendation_title,
          description: rec.description || rec.details,
          priority: rec.priority || 'medium',
          category: rec.category || 'workflow',
          impact: rec.impact || 'efficiency'
        }))
      };
      
    } catch (error) {
      console.error('❌ Failed to get recommendations:', error.message);
      return {
        success: false,
        error: error.message,
        recommendations: []
      };
    }
  });

  ipcMain.handle('crm:getIntelligence', async (event, orgId) => {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${CRM_SERVICE_URL}/intelligence/${orgId || 'heyjarvis_org'}`);
      
      if (!response.ok) {
        throw new Error(`Intelligence service responded with ${response.status}`);
      }
      
      const intelligence = await response.json();
      
      return {
        success: true,
        intelligence: {
          summary: intelligence.summary || 'CRM intelligence analysis completed',
          insights: intelligence.insights || [],
          patterns: intelligence.patterns || [],
          metrics: intelligence.metrics || {},
          last_updated: intelligence.timestamp || new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to get intelligence:', error.message);
      return {
        success: false,
        error: error.message,
        intelligence: {
          summary: 'Unable to retrieve CRM intelligence',
          insights: []
        }
      };
    }
  });

  ipcMain.handle('crm:healthCheck', async () => {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${CRM_SERVICE_URL}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed with ${response.status}`);
      }
      
      const health = await response.json();
      
      return {
        success: true,
        status: 'healthy',
        message: 'CRM service is operational',
        service_url: CRM_SERVICE_URL,
        version: health.version,
        uptime: health.uptime
      };
      
    } catch (error) {
      console.error('❌ CRM health check failed:', error.message);
      return {
        success: false,
        status: 'unhealthy',
        message: `CRM service unavailable: ${error.message}`,
        service_url: CRM_SERVICE_URL
      };
    }
  });

  // Forward Slack events to renderer
  slackService.on('mention', (message) => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:mention', message);
    }
  });

  slackService.on('message', (message) => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:message', message);
    }
  });

  slackService.on('connected', () => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:connected');
    }
  });

  slackService.on('disconnected', () => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:disconnected');
    }
  });

  slackService.on('error', (error) => {
    if (mainWindow) {
      mainWindow.webContents.send('slack:error', error.message);
    }
  });
}

/**
 * Setup Workflow Detection Integration
 * Analyzes incoming Slack messages for work requests and patterns
 */

// ===== TASK AUTO-CREATION HELPERS =====

/**
 * Look up Supabase user by Slack user ID
 */
async function getSupabaseUserBySlackId(slackUserId) {
  try {
    const { data, error } = await dbAdapter.supabase
      .from('users')
      .select('*')
      .eq('slack_user_id', slackUserId)
      .single();
    
    if (error) {
      console.log('⚠️ User not found for Slack ID:', slackUserId, error.message);
      return null;
    }
    
    console.log('✅ Found Supabase user for Slack ID:', slackUserId, '→', data.id);
    return data;
  } catch (error) {
    console.error('❌ Error looking up user by Slack ID:', error.message);
    return null;
  }
}

/**
 * Update current user's Slack ID if not set
 */
async function updateCurrentUserSlackId(slackUserId) {
  if (!currentUser || !slackUserId) return;
  
  try {
    // Check if user already has a Slack ID
    if (currentUser.slack_user_id) {
      return; // Already set
    }
    
    // Update the user's Slack ID
    const { error } = await dbAdapter.supabase
      .from('users')
      .update({ slack_user_id: slackUserId })
      .eq('id', currentUser.id);
    
    if (error) {
      console.error('❌ Failed to update user Slack ID:', error.message);
      return;
    }
    
    console.log('✅ Updated current user Slack ID:', slackUserId);
    currentUser.slack_user_id = slackUserId;
  } catch (error) {
    console.error('❌ Error updating user Slack ID:', error.message);
  }
}

/**
 * Extract mentioned Slack user IDs from message
 */
function extractMentionedSlackUsers(text) {
  const mentionPattern = /<@([UW][A-Z0-9]+)>/g;
  const mentions = [...text.matchAll(mentionPattern)];
  return mentions.map(m => m[1]);
}

/**
 * Extract task title from Slack message
 */
function extractTaskTitle(text) {
  // Remove Slack mentions (<@U123|user> format)
  const cleanText = text.replace(/<@[UW][A-Z0-9]+(|[^>]+)?>/g, '').trim();
  
  // Remove common prefixes
  const withoutPrefixes = cleanText
    .replace(/^(hey|hi|hello|yo),?\s+/i, '')
    .replace(/^(can you|could you|please)\s+/i, '')
    .trim();
  
  // Take first sentence or first 100 chars
  const firstSentence = withoutPrefixes.split(/[.!?]/)[0].trim();
  return firstSentence.length > 100 
    ? firstSentence.substring(0, 97) + '...' 
    : firstSentence || 'Task from Slack';
}

/**
 * Convert urgency to priority
 */
function urgencyToPriority(urgency) {
  const mapping = {
    'critical': 'urgent',
    'high': 'high',
    'medium': 'medium',
    'low': 'low'
  };
  return mapping[urgency] || 'medium';
}

function setupWorkflowDetection() {
  console.log('🔗 Setting up workflow detection integration...');
  
  // Listen for Slack messages and analyze them
  slackService.on('message', async (message) => {
    try {
      // Update current user's Slack ID if this is their message and they don't have one set
      if (currentUser && message.user) {
        await updateCurrentUserSlackId(message.user);
      }
      // Analyze for work requests using AI
      const workRequestAnalysis = await workRequestSystem.analyzeForWorkRequest(
        { text: message.text, timestamp: message.timestamp },
        { user: message.user, channel: message.channel }
      );
      
      if (workRequestAnalysis.isWorkRequest) {
        console.log('🚨 Work request detected!', {
          confidence: workRequestAnalysis.confidence,
          urgency: workRequestAnalysis.urgency,
          workType: workRequestAnalysis.workType
        });
        
        // Send enriched message to renderer with workflow analysis
        if (mainWindow) {
          mainWindow.webContents.send('slack:workRequest', {
            ...message,
            analysis: workRequestAnalysis
          });
        }
      }
      
      // Capture in workflow intelligence system with assignment tracking
      if (workflowIntelligence) {
        const workflowData = await workflowIntelligence.captureInboundRequest(
          message.user,
          message.channel,
          message.text,
          {
            messageType: message.type,
            timestamp: message.timestamp,
            channelType: message.channelType,
            user_name: message.user,
            slack_user_id: message.user
          }
        );
        
        // ✨ AUTO-CREATE TASK from work requests
        // Strategy: If mentioned users exist, create for them. Otherwise, create for current user.
        if (workRequestAnalysis.isWorkRequest && 
            workRequestAnalysis.confidence > 0.4) {
          
          try {
            // Extract Slack user mentions from message
            const mentionedSlackIds = extractMentionedSlackUsers(message.text);
            console.log('🔍 Task creation check:', {
              isWorkRequest: true,
              mentionedUsers: mentionedSlackIds.length,
              hasAssignment: workflowData.context.is_assignment
            });
            
            // Strategy 1: Create tasks for explicitly mentioned users
            if (mentionedSlackIds.length > 0) {
              console.log('📌 Creating tasks for', mentionedSlackIds.length, 'mentioned user(s)');
              
              let taskCreated = false;
              for (const slackUserId of mentionedSlackIds) {
                const targetUser = await getSupabaseUserBySlackId(slackUserId);
                
                if (targetUser) {
            const taskData = {
              title: extractTaskTitle(message.text),
              priority: urgencyToPriority(workRequestAnalysis.urgency),
              description: message.text,
                    tags: [workRequestAnalysis.workType, 'slack-auto', 'assigned'],
                    assignor: message.user,
                    assignee: slackUserId,
                    mentionedUsers: mentionedSlackIds,
              parentSessionId: workflowData.id
            };

                  const result = await dbAdapter.createTask(targetUser.id, taskData);
            
            if (result.success) {
                    taskCreated = true;
                    console.log('✅ Auto-created task for @mentioned user:', {
                task_id: result.task.id,
                title: taskData.title,
                      assigned_to: targetUser.email
              });
              
                    // Notify UI if task is for current logged-in user
                    if (mainWindow && currentUser && targetUser.id === currentUser.id) {
                mainWindow.webContents.send('task:created', result.task);
                mainWindow.webContents.send('notification', {
                  type: 'task_created',
                        message: `Task assigned: ${taskData.title}`
                      });
                    }
                  }
                } else {
                  console.log('⚠️ Mentioned user not in database:', slackUserId);
                }
              }
              
              // Fallback: If no tasks were created (all mentioned users not in DB),
              // create a task for the message sender with assignee info
              if (!taskCreated) {
                console.log('📝 Mentioned users not found - creating task for sender with delegation info');
                const senderUser = await getSupabaseUserBySlackId(message.user);
                
                if (senderUser) {
                  const taskData = {
                    title: extractTaskTitle(message.text),
                    priority: urgencyToPriority(workRequestAnalysis.urgency),
                    description: message.text,
                    tags: [workRequestAnalysis.workType, 'slack-auto', 'delegated'],
                    assignor: message.user,
                    assignee: mentionedSlackIds[0], // Keep first mentioned user as assignee
                    mentionedUsers: mentionedSlackIds,
                    parentSessionId: workflowData.id
                  };

                  const result = await dbAdapter.createTask(senderUser.id, taskData);
                  
                  if (result.success) {
                    console.log('✅ Auto-created delegation task for sender:', {
                      task_id: result.task.id,
                      title: taskData.title,
                      delegated_to: mentionedSlackIds[0]
                    });
                    
                    // Notify UI if this is the current logged-in user
                    if (mainWindow && currentUser && senderUser.id === currentUser.id) {
                      mainWindow.webContents.send('task:created', result.task);
                      mainWindow.webContents.send('notification', {
                        type: 'task_created',
                        message: `Task tracked: ${taskData.title}`
                      });
                    }
                  }
                } else {
                  console.log('⚠️ Message sender not in database:', message.user);
                }
              }
            } 
            // Strategy 2: No mentions - check if it's delegation or self-assigned
            else {
              console.log('📝 No explicit mentions - analyzing task type');
              
              // Get the Slack user who sent the message
              const senderUser = await getSupabaseUserBySlackId(message.user);
              
              if (senderUser) {
                const title = extractTaskTitle(message.text);
                
                // Check if title starts with a name pattern (delegation to someone not in system)
                const isDelegation = /^([A-Z][a-z]+),?\s+(can|could|please|would you|will you)/i.test(title);
                
                let taskData;
                
                if (isDelegation) {
                  // Delegation to someone outside the system
                  console.log('📤 Detected delegation to external person:', title);
                  taskData = {
                    title: title,
                    priority: urgencyToPriority(workRequestAnalysis.urgency),
                    description: message.text,
                    tags: [workRequestAnalysis.workType, 'slack-auto', 'delegated'],
                    assignor: message.user,
                    assignee: null, // Delegated to someone not in system
                    mentionedUsers: [],
                    parentSessionId: workflowData.id
                  };
                } else {
                  // True self-assigned task
                  console.log('📝 Creating self-assigned task');
                  taskData = {
                    title: title,
                    priority: urgencyToPriority(workRequestAnalysis.urgency),
                    description: message.text,
                    tags: [workRequestAnalysis.workType, 'slack-auto', 'self-assigned'],
                    assignor: message.user,
                    assignee: message.user, // Self-assigned
                    mentionedUsers: [],
                    parentSessionId: workflowData.id
                  };
                }

                const result = await dbAdapter.createTask(senderUser.id, taskData);
                
                if (result.success) {
                  console.log(`✅ Auto-created ${isDelegation ? 'delegation' : 'self-assigned'} task:`, {
                    task_id: result.task.id,
                    title: taskData.title,
                    created_for: senderUser.email,
                    assignor: message.user,
                    assignee: taskData.assignee,
                    isDelegation: isDelegation
                  });
                  
                  // Notify UI if task is for current logged-in user
                  if (mainWindow && currentUser && senderUser.id === currentUser.id) {
                    mainWindow.webContents.send('task:created', result.task);
                    mainWindow.webContents.send('notification', {
                      type: 'task_created',
                      message: `${isDelegation ? 'Delegation tracked' : 'New task'}: ${taskData.title}`
                });
              }
            } else {
              console.error('❌ Failed to create task:', result.error);
                }
              } else {
                console.log('⚠️ Message sender not in database:', message.user);
              }
            }
          } catch (taskError) {
            console.error('❌ Task creation error:', taskError.message);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Workflow detection error:', error.message);
    }
  });
  
  // Listen for mentions and analyze them too
  slackService.on('mention', async (message) => {
    try {
      // Mentions are often work requests, analyze with AI
      const workRequestAnalysis = await workRequestSystem.analyzeForWorkRequest(
        { text: message.text, timestamp: message.timestamp },
        { user: message.user, channel: message.channel }
      );
      
      console.log('👋 Bot mentioned - analyzing...', {
        isWorkRequest: workRequestAnalysis.isWorkRequest,
        urgency: workRequestAnalysis.urgency,
        message: message.text.substring(0, 100)
      });
      
      // Capture mention in workflow intelligence with assignment tracking
      if (workflowIntelligence) {
        const workflowData = await workflowIntelligence.captureInboundRequest(
          message.user,
          message.channel,
          message.text,
          {
            messageType: 'mention',
            timestamp: message.timestamp,
            urgent: message.urgent || workRequestAnalysis.urgency === 'high',
            user_name: message.user,
            slack_user_id: message.user
          }
        );
        
        // ✨ AUTO-CREATE TASK from mention - Create for ALL mentioned users
        // When someone says "@Avi can you fix the payment API?"
        // We create a task for Avi (the mentioned user), not the sender
        if (workRequestAnalysis.isWorkRequest) {
          
          try {
            // Extract all mentioned Slack user IDs from the message
            const mentionedSlackIds = extractMentionedSlackUsers(message.text);
            console.log('📌 Mentioned Slack users:', mentionedSlackIds);
            
            // Create task for each mentioned user who has authenticated
            for (const slackUserId of mentionedSlackIds) {
              // Look up Supabase user by their Slack ID
              const targetUser = await getSupabaseUserBySlackId(slackUserId);
              
              if (targetUser) {
            const taskData = {
              title: extractTaskTitle(message.text),
              priority: urgencyToPriority(workRequestAnalysis.urgency || 'medium'),
              description: message.text,
              tags: ['mention', workRequestAnalysis.workType || 'task', 'slack-auto'],
                  assignor: message.user,  // Who sent the message (the assigner)
                  assignee: slackUserId,    // Who was mentioned (the assignee)
                  mentionedUsers: mentionedSlackIds,
              parentSessionId: workflowData.id
            };

                // Create task for the MENTIONED user (not current user)
                const result = await dbAdapter.createTask(targetUser.id, taskData);
            
            if (result.success) {
              console.log('✅ Auto-created task from mention:', {
                task_id: result.task.id,
                    title: taskData.title,
                    created_for_user: targetUser.email,
                    slack_user_id: slackUserId
              });
              
                  // Notify UI if this task is for the current logged-in user
                  if (mainWindow && currentUser && targetUser.id === currentUser.id) {
                mainWindow.webContents.send('task:created', result.task);
                    mainWindow.webContents.send('notification', {
                      title: '✨ New Task Assigned',
                      body: taskData.title,
                      urgency: taskData.priority
                    });
                  }
                }
              } else {
                console.log('⚠️ Mentioned user not found in database (they need to authenticate):', slackUserId);
              }
            }
          } catch (taskError) {
            console.error('❌ Task creation from mention error:', taskError.message);
          }
        }
      }
      
      // Send to renderer with analysis
      if (mainWindow && workRequestAnalysis.isWorkRequest) {
        mainWindow.webContents.send('slack:workRequest', {
          ...message,
          analysis: workRequestAnalysis
        });
      }
      
    } catch (error) {
      console.error('❌ Mention workflow analysis error:', error.message);
    }
  });
  
  console.log('✅ Workflow detection integration complete');
}

// Setup CRM startup event handlers
function setupCRMStartupHandlers() {
  // Forward CRM loading events to renderer
  crmStartupService.on('loading:started', (data) => {
    console.log('🔄 CRM Loading started:', data.message);
    if (mainWindow) {
      mainWindow.webContents.send('crm:loading:started', data);
    }
  });

  crmStartupService.on('loading:progress', (data) => {
    console.log(`📊 CRM Loading progress: ${data.progress}% - ${data.message}`);
    if (mainWindow) {
      mainWindow.webContents.send('crm:loading:progress', data);
    }
  });

  crmStartupService.on('loading:completed', (data) => {
    console.log('✅ CRM Loading completed:', data.message);
    if (mainWindow) {
      mainWindow.webContents.send('crm:loading:completed', data);
    }
  });

  crmStartupService.on('loading:error', (data) => {
    console.log('❌ CRM Loading error:', data.message);
    if (mainWindow) {
      mainWindow.webContents.send('crm:loading:error', data);
    }
  });

  crmStartupService.on('data:updated', (data) => {
    console.log('📈 CRM Data updated - insights:', data.insights?.length || 0);
    if (mainWindow) {
      mainWindow.webContents.send('crm:data:updated', data);
    }
  });
}

// Start CRM loading process
async function startCRMLoading() {
  try {
    console.log('🚀 Starting CRM data loading...');
    await crmStartupService.initialize();
  } catch (error) {
    console.error('❌ CRM startup failed:', error.message);
  }
}

// Create login window
function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 500,
    height: 700,
    show: true,
    center: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'bridge', 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    frame: true
  });

  loginWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
  
  loginWindow.on('closed', () => {
    loginWindow = null;
  });
  
  console.log('🔐 Login window created');
}

// Check authentication and show appropriate window
async function initializeApp() {
  try {
    // Initialize auth service
    authService = new AuthService();
    
    // Try to load existing session
    const session = await authService.loadSession();
    
    if (session && session.user) {
      // User is authenticated
      currentUser = session.user;
      console.log('✅ User authenticated:', currentUser.email);
      
      // Show main app
      createWindow();
      
      // Initialize services (don't let errors here crash the app)
      try {
        initializeServices();
      } catch (serviceError) {
        console.error('⚠️ Service initialization failed (non-fatal):', serviceError.message);
        // App window is already created, so continue running
      }
    } else {
      // No valid session, show login
      console.log('🔐 No valid session, showing login');
      createLoginWindow();
    }
  } catch (error) {
    console.error('❌ App initialization failed:', error);
    // Only show login if we haven't already created a window
    if (!mainWindow && !loginWindow) {
      createLoginWindow();
    }
  }
}

// Register ALL IPC handlers at module level (before windows are created)
function registerAllIPCHandlers() {
  console.log('📡 Registering IPC handlers...');
  
  // These handlers will be populated when services initialize
  // but we register the handler functions now so they exist when window loads
  
  ipcMain.handle('slack:getStatus', () => {
    return slackService ? slackService.getStatus() : { connected: false };
  });

  ipcMain.handle('slack:getRecentMessages', (event, limit) => {
    return slackService ? slackService.getRecentMessages(limit) : [];
  });

  ipcMain.handle('slack:startMonitoring', async () => {
    return slackService ? await slackService.start() : { success: false, error: 'Slack service not initialized' };
  });

  // Topbar controls
  ipcMain.handle('topbar:expand', () => {
    if (typeof expandTopBar === 'function') {
      expandTopBar();
    } else {
      console.warn('⚠️ expandTopBar function not available yet');
    }
  });

  ipcMain.handle('topbar:collapse', () => {
    if (typeof collapseTopBar === 'function') {
      collapseTopBar();
    } else {
      console.warn('⚠️ collapseTopBar function not available yet');
    }
  });

  ipcMain.handle('tasks:getAll', async (event, filters = {}) => {
    try {
      if (!dbAdapter) {
        return { success: false, error: 'Database not initialized', tasks: [] };
      }
      const userId = currentUser?.id || 'desktop-user';
      const result = await dbAdapter.getUserTasks(userId, { 
        includeCompleted: false,
        ...filters
      });
      return result;
    } catch (error) {
      console.error('❌ Failed to get tasks:', error);
      return { success: false, error: error.message, tasks: [] };
    }
  });

  ipcMain.handle('tasks:create', async (event, taskData) => {
    try {
      if (!dbAdapter) {
        return { success: false, error: 'Database not initialized' };
      }
      const userId = currentUser?.id || 'desktop-user';
      const result = await dbAdapter.createTask(userId, taskData);
      return result;
    } catch (error) {
      console.error('Failed to create task:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tasks:update', async (event, taskId, updates) => {
    try {
      if (!dbAdapter) {
        return { success: false, error: 'Database not initialized' };
      }
      const result = await dbAdapter.updateTask(taskId, updates);
      return result;
    } catch (error) {
      console.error('Failed to update task:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tasks:toggle', async (event, taskId, currentStatus) => {
    try {
      if (!dbAdapter) {
        return { success: false, error: 'Database not initialized' };
      }
      const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';
      const result = await dbAdapter.updateTask(taskId, { status: newStatus });
      return result;
    } catch (error) {
      console.error('Failed to toggle task:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tasks:delete', async (event, taskId) => {
    try {
      if (!dbAdapter) {
        return { success: false, error: 'Database not initialized' };
      }
      const result = await dbAdapter.deleteTask(taskId);
      return result;
    } catch (error) {
      console.error('Failed to delete task:', error);
      return { success: false, error: error.message };
    }
  });

  // Engineering Intelligence IPC handlers
  ipcMain.handle('engineering:query', async (event, { query, repository, context }) => {
    try {
      if (!engineeringIntelligence) {
        return {
          success: false,
          error: 'Engineering Intelligence not configured. Add GitHub credentials to .env'
        };
      }

      console.log('📊 Engineering query via IPC:', query.substring(0, 50) + '...');
      
      const result = await engineeringIntelligence.queryCodebase(query, {
        ...context,
        repository: repository || (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME ? {
          owner: process.env.GITHUB_REPO_OWNER,
          repo: process.env.GITHUB_REPO_NAME
        } : null),
        role: context?.role || 'sales'
      });
      
      return {
        success: true,
        result
      };
    } catch (error) {
      console.error('❌ Engineering query failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('engineering:healthCheck', async () => {
    try {
      if (!engineeringIntelligence) {
        return {
          status: 'unhealthy',
          github: 'disconnected',
          error: 'Engineering Intelligence not configured'
        };
      }

      const health = await engineeringIntelligence.healthCheck();
      return health;
    } catch (error) {
      console.error('❌ Engineering health check failed:', error);
      return {
        status: 'unhealthy',
        github: 'disconnected',
        error: error.message
      };
    }
  });

  ipcMain.handle('engineering:getFeatureStatus', async (event, { featureName, repository }) => {
    try {
      if (!engineeringIntelligence) {
        return {
          success: false,
          error: 'Engineering Intelligence not configured'
        };
      }

      const context = repository ? { repository } : {};
      const result = await engineeringIntelligence.getFeatureStatus(featureName, context);
      
      return {
        success: true,
        result
      };
    } catch (error) {
      console.error('❌ Feature status query failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('engineering:listRepos', async () => {
    try {
      if (!engineeringIntelligence) {
        return {
          success: false,
          error: 'Engineering Intelligence not configured'
        };
      }

      const octokit = await engineeringIntelligence._getOctokit();
      const { data } = await octokit.apps.listReposAccessibleToInstallation();
      
      return {
        success: true,
        repos: data.repositories
      };
    } catch (error) {
      console.error('❌ List repos failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  console.log('✅ All IPC handlers registered');
}

// This method will be called when Electron has finished initialization
if (app && typeof app.whenReady === 'function') {
  app.whenReady().then(() => {
    // Register IPC handlers FIRST, before creating any windows
    registerAllIPCHandlers();
    
    // Register custom protocol for OAuth callback
    protocol.registerFileProtocol('heyjarvis', (request, callback) => {
      console.log('🔗 Custom protocol handler called:', request.url);
    });
    
    initializeApp();
  });
} else {
  console.error('Electron app object is not available:', typeof app);
  // Try alternative initialization
  setTimeout(() => {
    try {
      const electron = require('electron');
      if (electron.app && typeof electron.app.whenReady === 'function') {
        electron.app.whenReady().then(() => {
          createWindow();
          initializeServices();
        });
      }
    } catch (error) {
      console.error('Failed to initialize Electron app:', error);
    }
  }, 1000);
}

// Prevent app from quitting when window is closed (persistent overlay)
app.on('window-all-closed', () => {
  // Don't quit - keep running in tray on all platforms
  console.log('🔄 All windows closed, app continues in tray');
  console.log(`🎯 Tray status: ${tray ? (tray.isDestroyed() ? 'destroyed ❌' : 'still alive ✅') : 'not created ⚠️'}`);
});

// Handle app quit
app.on('before-quit', async (event) => {
  if (!isQuittingApp) {
    // Not a real quit, just closing windows - prevent quit
    event.preventDefault();
    return;
  }
  
  console.log('🛑 HeyJarvis shutting down...');
  
  try {
    // Stop Slack service
    if (slackService && typeof slackService.stop === 'function') {
      console.log('⏹️ Stopping Slack service...');
      await slackService.stop();
    }
  
  // Stop CRM service
    if (crmStartupService && typeof crmStartupService.stop === 'function') {
      console.log('⏹️ Stopping CRM service...');
    await crmStartupService.stop();
  }
    
    // Close fact-checker overlays
    if (factCheckerService && typeof factCheckerService.closeOverlay === 'function') {
      console.log('⏹️ Closing fact-checker overlays...');
      factCheckerService.closeOverlay();
    }
    
    // Close highlight overlay
    if (highlightOverlay && !highlightOverlay.isDestroyed()) {
      console.log('⏹️ Closing highlight overlay...');
      highlightOverlay.destroy();
    }
    
    // Close all windows
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.destroy();
    }
  
  // Clean up tray
    if (tray && !tray.isDestroyed()) {
      console.log('⏹️ Destroying tray...');
    tray.destroy();
    }
    
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
});

// Final quit confirmation
app.on('will-quit', () => {
  console.log('💀 App will quit now');
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ===== HIGHLIGHT OVERLAY SYSTEM =====

function createHighlightOverlay() {
  if (highlightOverlay) {
    console.log('🔄 Reusing existing highlight overlay');
    return highlightOverlay;
  }
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  
  console.log(`📺 Creating overlay for screen: ${screenWidth}x${screenHeight}`);
  
  highlightOverlay = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: 0,
    y: 0,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'bridge/highlight-preload.js')
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false, // Don't steal focus
    show: false,
    titleBarStyle: 'hidden',
    type: 'panel'
  });
  
  // Load highlight overlay HTML
  const overlayPath = path.join(__dirname, 'renderer/highlight-overlay.html');
  console.log(`📄 Loading overlay HTML from: ${overlayPath}`);
  highlightOverlay.loadFile(overlayPath);
  
  // Debug: Log when overlay is ready
  highlightOverlay.webContents.once('did-finish-load', () => {
    console.log('✅ Highlight overlay HTML loaded successfully');
  });
  
  // Make it click-through by default, but we'll enable mouse events when highlights are shown
  highlightOverlay.setIgnoreMouseEvents(true, { forward: true });
  
  console.log('✅ Highlight overlay created');
  
  return highlightOverlay;
}

function showHighlights(highlights) {
  console.log('🎯 showHighlights called with', highlights.length, 'highlights');
  
  if (!highlightOverlay) {
    console.log('🏗️ Creating new highlight overlay...');
    createHighlightOverlay();
  }
  
  // Store highlights data
  activeHighlights = highlights;
  
  // Log first few highlights for debugging
  highlights.slice(0, 3).forEach((h, i) => {
    console.log(`📍 Highlight ${i}:`, {
      id: h.id,
      text: h.text?.substring(0, 30) + '...',
      x: h.x,
      y: h.y,
      width: h.width,
      height: h.height
    });
  });
  
  // Keep overlay click-through - let CSS handle selective clicking
  highlightOverlay.setIgnoreMouseEvents(true, { forward: true });
  console.log('🖱️ Overlay kept click-through, CSS handles selective clicking');
  
  // Wait for overlay to be ready before sending data
  if (highlightOverlay.webContents.isLoading()) {
    console.log('⏳ Overlay still loading, waiting...');
    highlightOverlay.webContents.once('did-finish-load', () => {
      console.log('✅ Overlay loaded, sending highlights...');
      sendHighlightsToOverlay(highlights);
    });
  } else {
    console.log('✅ Overlay ready, sending highlights immediately...');
    sendHighlightsToOverlay(highlights);
  }
  
  // Show overlay
  highlightOverlay.show();
  highlightOverlay.focus(); // Try to ensure it's on top
  
  console.log(`✅ Overlay shown with ${highlights.length} highlights`);
}

function sendHighlightsToOverlay(highlights) {
  // Send message to overlay to set up selective click handling
  highlightOverlay.webContents.send('setup-selective-clicks', highlights);
  console.log('📤 Sent setup-selective-clicks message');
  
  // Send highlights to overlay
  highlightOverlay.webContents.send('show-highlights', highlights);
  console.log('📤 Sent show-highlights message');
}

function hideHighlights() {
  if (highlightOverlay) {
    // Re-enable click-through when hiding highlights
    highlightOverlay.setIgnoreMouseEvents(true, { forward: true });
    highlightOverlay.hide();
    activeHighlights = [];
    console.log('🔄 Highlights hidden');
  }
}

function showHighlightExplanation(highlightId) {
  const highlight = activeHighlights.find(h => h.id === highlightId);
  if (highlight) {
    // Send explanation to main window chat
    mainWindow.webContents.send('show-explanation', {
      text: highlight.text,
      reason: highlight.reason,
      confidence: highlight.confidence
    });
  }
}

// ===== AUTHENTICATION IPC HANDLERS =====

// Sign in with Slack
ipcMain.handle('auth:sign-in-slack', async () => {
  try {
    console.log('🔐 Starting Slack sign in...');
    
    if (!authService) {
      authService = new AuthService();
    }
    
    const result = await authService.signInWithSlack();
    
    if (result.success) {
      currentUser = result.user;
      
      // Close login window
      if (loginWindow) {
        loginWindow.close();
        loginWindow = null;
      }
      
      // Create main window
      createWindow();
      
      // Initialize services (don't let errors here crash the app)
      try {
        initializeServices();
      } catch (serviceError) {
        console.error('⚠️ Service initialization failed (non-fatal):', serviceError.message);
        // App window is already created, so continue running
      }
      
      return {
        success: true,
        user: currentUser
      };
    }
    
    return {
      success: false,
      error: 'Authentication failed'
    };
    
  } catch (error) {
    console.error('❌ Sign in failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Sign out
ipcMain.handle('auth:sign-out', async () => {
  try {
    console.log('🔐 Signing out...');
    
    if (authService) {
      await authService.signOut();
    }
    
    currentUser = null;
    conversationHistory = [];
    
    // Close main window
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }
    
    // Show login window
    createLoginWindow();
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Sign out failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Get current user
ipcMain.handle('auth:get-user', async () => {
  return currentUser;
});

// ===== FACT CHECK IPC HANDLERS =====

// Screen capture handler
ipcMain.handle('fact-check:capture-screen', async () => {
  try {
    console.log('📸 Capturing screen for fact check');
    
    const { desktopCapturer, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.min(primaryDisplay.size.width, 1920),
        height: Math.min(primaryDisplay.size.height, 1080)
      }
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    const screenshot = sources[0].thumbnail.toPNG();
    
    console.log('✅ Screen captured successfully');
    
    return {
      success: true,
      image: screenshot.toString('base64'),
      dimensions: primaryDisplay.size
    };
    
  } catch (error) {
    console.error('❌ Screen capture failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// OCR-based text extraction from screen using Tesseract.js
ipcMain.handle('fact-check:extract-text', async (event, imageBase64) => {
  try {
    console.log('🔍 Starting OCR text extraction from screen');
    
    let textBlocks = [];
    let allText = null;
    
    // Method 1: Use Tesseract.js for OCR if we have a screenshot
    if (imageBase64) {
      try {
        console.log('📸 Using OCR to extract text from screenshot');
        const Tesseract = require('tesseract.js');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        
        // Perform OCR with word-level recognition to get positions
        const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        
        // Extract text and word positions safely
        const extractedText = data.text || '';
        console.log(`📝 OCR extracted ${extractedText.length} characters of text`);
        
        // Extract word positions from blocks structure
        const words = [];
        if (data.blocks && Array.isArray(data.blocks)) {
          data.blocks.forEach(block => {
            if (block.paragraphs) {
              block.paragraphs.forEach(para => {
                if (para.lines) {
                  para.lines.forEach(line => {
                    if (line.words) {
                      line.words.forEach(word => {
                        if (word.text && word.bbox) {
                          words.push({
                            text: word.text.trim(),
                            bbox: word.bbox,
                            confidence: word.confidence || 0
                          });
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
        
        console.log(`📚 Extracted ${words.length} words from OCR blocks`);
        
        // Filter for words containing "jarvis" (case insensitive)
        const jarvisWords = words.filter(word => 
          word.text.toLowerCase().includes('jarvis') || 
          word.text.toLowerCase().includes('heyjarvis')
        );
        
        console.log(`🎯 Found ${jarvisWords.length} words containing "jarvis"`);
        
        // Convert OCR word positions to our text block format
        jarvisWords.forEach((word, index) => {
          textBlocks.push({
            text: word.text,
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
            confidence: word.confidence / 100 // Convert to 0-1 scale
          });
        });
        
        // If we found jarvis-related words, return them
        if (textBlocks.length > 0) {
          console.log(`✅ OCR found ${textBlocks.length} "jarvis" text blocks`);
          return {
            success: true,
            textBlocks: textBlocks,
            method: 'ocr'
          };
        }
        
        // If no jarvis words found, create blocks from all text for general analysis
        console.log('📄 No "jarvis" found, creating blocks from all OCR text');
        const allTextBlocks = [];
        
        // Group words into lines/sentences for better analysis
        const lines = data.lines || [];
        if (Array.isArray(lines)) {
          lines.forEach((line, index) => {
            if (line.text && line.text.trim().length > 10 && line.bbox) {
              allTextBlocks.push({
                text: line.text.trim(),
                x: line.bbox.x0,
                y: line.bbox.y0,
                width: line.bbox.x1 - line.bbox.x0,
                height: line.bbox.y1 - line.bbox.y0,
                confidence: (line.confidence || 0) / 100
              });
            }
          });
        }
        
        if (allTextBlocks.length > 0) {
          return {
            success: true,
            textBlocks: allTextBlocks.slice(0, 20), // Limit to first 20 blocks
            method: 'ocr-full'
          };
        }
        
      } catch (ocrError) {
        console.log('⚠️ OCR failed:', ocrError.message);
      }
    }
    
    // Method 2: Fallback to clipboard text
    try {
      const { clipboard } = require('electron');
      const clipboardText = clipboard.readText();
      if (clipboardText && clipboardText.length > 20) {
        console.log('📋 Using clipboard text content as fallback');
        
        // Create mock positioned text blocks from clipboard content
        const mockBlocks = createMockTextBlocks(clipboardText);
        return {
          success: true,
          textBlocks: mockBlocks,
          method: 'clipboard'
        };
      }
    } catch (clipboardError) {
      console.log('⚠️ Clipboard access failed:', clipboardError.message);
    }
    
    // Method 3: Try macOS accessibility API to read screen content
    if (!allText) {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // Get text from Chrome/Safari using AppleScript
        const browserScript = `
          tell application "System Events"
            set frontApp to name of first application process whose frontmost is true
          end tell
          
          if frontApp contains "Chrome" or frontApp contains "Safari" or frontApp contains "Firefox" then
            tell application frontApp
              try
                set pageText to do JavaScript "document.body.innerText" in active tab of front window
                return pageText
              on error
                return ""
              end try
            end tell
          else
            return ""
          end if
        `;
        
        const { stdout } = await execAsync(`osascript -e '${browserScript}'`);
        if (stdout && stdout.trim().length > 20) {
          console.log('🌐 Using browser content text');
          allText = stdout.trim();
        }
      } catch (browserError) {
        console.log('⚠️ Browser content extraction failed:', browserError.message);
      }
    }
    
    // If we got text, create smart positioned blocks
    if (allText && allText.length > 20) {
      textBlocks = createSmartTextBlocks(allText);
      console.log(`✅ Text extraction completed - created ${textBlocks.length} smart text blocks`);
      console.log('📍 Text blocks created:', textBlocks.length);
    } else {
      // Ultimate fallback - create demo blocks for testing
      console.log('⚠️ No text found, using demo content for testing');
      textBlocks = [
        {
          text: 'Revolutionary AI breakthrough increases productivity by 500%',
          x: 300, y: 200, width: 500, height: 30
        },
        {
          text: 'Scientists discover this one weird trick that doctors hate',
          x: 250, y: 280, width: 450, height: 30
        },
        {
          text: 'Exclusive: Company revenue jumps 1000% overnight',
          x: 350, y: 360, width: 400, height: 30
        }
      ];
      console.log('📍 Demo blocks created:', textBlocks.length);
    }
    
    return {
      success: true,
      textBlocks: textBlocks
    };
    
  } catch (error) {
    console.error('❌ Text extraction failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Helper function to create smart positioned text blocks based on typical app layouts
function createSmartTextBlocks(text) {
  const blocks = [];
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  
  console.log(`📺 Screen dimensions: ${screenWidth}x${screenHeight}`);
  
  // Define common application layout areas
  const layoutAreas = [
    // Main content area (center-left, like editor or document)
    { x: Math.floor(screenWidth * 0.2), y: Math.floor(screenHeight * 0.15), width: Math.floor(screenWidth * 0.6), label: 'main-content' },
    // Secondary content (center-right)
    { x: Math.floor(screenWidth * 0.5), y: Math.floor(screenHeight * 0.25), width: Math.floor(screenWidth * 0.4), label: 'secondary-content' },
    // Header/title area
    { x: Math.floor(screenWidth * 0.1), y: Math.floor(screenHeight * 0.05), width: Math.floor(screenWidth * 0.8), label: 'header' },
    // Sidebar content
    { x: Math.floor(screenWidth * 0.05), y: Math.floor(screenWidth * 0.2), width: Math.floor(screenWidth * 0.25), label: 'sidebar' },
    // Footer/bottom area
    { x: Math.floor(screenWidth * 0.1), y: Math.floor(screenHeight * 0.8), width: Math.floor(screenWidth * 0.8), label: 'footer' }
  ];
  
  // Split text into sentences and paragraphs
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 30);
  
  // Use paragraphs if available, otherwise sentences
  const textSegments = paragraphs.length > 0 ? paragraphs : sentences;
  
  textSegments.forEach((segment, index) => {
    const trimmed = segment.trim();
    if (trimmed.length > 15) {
      // Cycle through layout areas
      const area = layoutAreas[index % layoutAreas.length];
      
      // Calculate position within the area
      const rowInArea = Math.floor(index / layoutAreas.length);
      const yOffset = rowInArea * 50; // 50px between rows
      
      const finalY = area.y + yOffset;
      
      // Don't go below screen
      if (finalY < screenHeight - 100) {
        blocks.push({
          text: trimmed,
          x: area.x,
          y: finalY,
          width: Math.min(trimmed.length * 7, area.width - 20),
          height: 35,
          area: area.label
        });
        
        console.log(`📍 Created block in ${area.label}: "${trimmed.substring(0, 30)}..." at (${area.x}, ${finalY})`);
      }
    }
  });
  
  console.log(`✅ Created ${blocks.length} smart text blocks`);
  return blocks;
}

// AI analysis handler
ipcMain.handle('ai:simple-analyze', async (event, prompt) => {
  try {
    console.log('🤖 Starting AI analysis for fact check');
    
    // Use existing AI analyzer
    const AIAnalyzer = require('../core/signals/enrichment/ai-analyzer');
    const aiAnalyzer = new AIAnalyzer();
    
    const response = await aiAnalyzer.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const result = response.content[0].text;
    
    console.log('✅ AI analysis completed');
    
    return result;
    
  } catch (error) {
    console.error('❌ AI analysis failed:', error.message);
    return 'AI analysis temporarily unavailable. Please try again later.';
  }
});

// Highlight overlay handlers
ipcMain.handle('highlights:show', (event, highlights) => {
  showHighlights(highlights);
  return { success: true };
});

ipcMain.handle('highlights:hide', () => {
  hideHighlights();
  return { success: true };
});

ipcMain.handle('highlights:explain', (event, highlightId) => {
  showHighlightExplanation(highlightId);
  return { success: true };
});

// Handle click forwarding (for now, just log it)
ipcMain.handle('highlights:forward-click', (event, x, y) => {
  console.log(`🖱️ Click forwarded at coordinates: ${x}, ${y}`);
  // In the future, we could simulate a click at these coordinates
  return { success: true };
});

// OCR-based fact checking - extract screen text and analyze for BS
ipcMain.handle('fact-check:analyze-screen', async () => {
  console.log('🔍 Starting fact-check analysis of screen content...');
  
  try {
    const { desktopCapturer, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    
    console.log(`📺 Screen: ${screenWidth}x${screenHeight} (scale: ${scaleFactor}x)`);
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: screenWidth * scaleFactor,
        height: screenHeight * scaleFactor
      }
    });
    
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    const screenshot = sources[0].thumbnail.toPNG();
    const imageBuffer = Buffer.from(screenshot.toString('base64'), 'base64');
    const capturedWidth = sources[0].thumbnail.getSize().width;
    const capturedHeight = sources[0].thumbnail.getSize().height;
    
    console.log('📸 Screen captured, extracting text...');
    
    const scaleX = screenWidth / capturedWidth;
    const scaleY = screenHeight / capturedHeight;
    
    const { createWorker } = require('tesseract.js');
    
    const worker = await createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    // Get both text AND word positions for highlighting suspicious content
    const result = await worker.recognize(imageBuffer);
    
    await worker.terminate();
    
    console.log('📋 OCR result structure:', {
      hasResult: !!result,
      hasData: !!result?.data,
      dataKeys: result?.data ? Object.keys(result.data) : [],
      hasBlocks: !!result?.data?.blocks,
      blocksType: typeof result?.data?.blocks,
      blocksLength: Array.isArray(result?.data?.blocks) ? result.data.blocks.length : 'not array'
    });
    
    const data = result.data;
    const extractedText = data.text || '';
    
    console.log(`📝 Extracted ${extractedText.length} characters of text`);
    
    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error(`Not enough text found on screen. Got ${extractedText.length} characters.`);
    }
    
    console.log('Text preview:', extractedText.substring(0, 200));
    
    // Send to AI for fact-checking
    console.log('🤖 Analyzing text for misinformation...');
    
    const AIAnalyzer = require('../core/signals/enrichment/ai-analyzer');
    const aiAnalyzer = new AIAnalyzer();
    
    const factCheckPrompt = `Analyze this text for misinformation, clickbait, or suspicious claims. Identify specific phrases/sentences that are problematic and explain why.

TEXT:
${extractedText}

Respond with:
1. Overall assessment (legitimate/suspicious/misleading)
2. List of specific suspicious phrases/claims (if any)
3. Brief explanation of concerns

Be specific about which exact phrases raised red flags. Format suspicious phrases in quotes.`;

    const response = await aiAnalyzer.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: 'user', content: factCheckPrompt }]
    });
    
    const analysis = response.content[0].text;
    
    console.log('✅ AI analysis completed');
    console.log('Analysis preview:', analysis.substring(0, 200));
    
    // Extract suspicious phrases from AI response and create highlights
    const highlights = [];
    
    // Parse AI response for quoted suspicious phrases
    const quoteMatches = analysis.match(/"([^"]+)"/g);
    
    if (quoteMatches && data.blocks && Array.isArray(data.blocks)) {
      console.log(`🎯 Found ${quoteMatches.length} suspicious phrases to highlight`);
      
      // Extract all words with positions from blocks structure
      const words = [];
      
      // According to Tesseract.js docs, blocks contain paragraphs -> lines -> words
      data.blocks.forEach((block, blockIndex) => {
        console.log(`📦 Block ${blockIndex}:`, {
          hasParagraphs: !!block.paragraphs,
          paragraphsType: typeof block.paragraphs,
          paragraphsLength: Array.isArray(block.paragraphs) ? block.paragraphs.length : 'not array'
        });
        
        if (block.paragraphs && Array.isArray(block.paragraphs)) {
          block.paragraphs.forEach((para, paraIndex) => {
            console.log(`  📄 Paragraph ${paraIndex}:`, {
              hasLines: !!para.lines,
              linesType: typeof para.lines,
              linesLength: Array.isArray(para.lines) ? para.lines.length : 'not array'
            });
            
            if (para.lines && Array.isArray(para.lines)) {
              para.lines.forEach((line, lineIndex) => {
                console.log(`    📝 Line ${lineIndex}:`, {
                  hasWords: !!line.words,
                  wordsType: typeof line.words,
                  wordsLength: Array.isArray(line.words) ? line.words.length : 'not array'
                });
                
                if (line.words && Array.isArray(line.words)) {
                  line.words.forEach((word, wordIndex) => {
                    if (word.text && word.bbox) {
                      words.push({
                        text: word.text.trim().toLowerCase(),
                        bbox: word.bbox,
                        confidence: word.confidence || 0
                      });
                      
                      if (wordIndex < 3) { // Log first few words for debugging
                        console.log(`      🔤 Word ${wordIndex}: "${word.text}" at (${word.bbox.x0}, ${word.bbox.y0})`);
                      }
                    }
                  });
                }
              });
            }
          });
        }
      });
      
      console.log(`📚 Extracted ${words.length} total words from OCR`);
      
      // Fallback: If no words found from blocks, try parsing TSV data
      if (words.length === 0 && data.tsv) {
        console.log('⚠️ No words from blocks, trying TSV fallback...');
        console.log('TSV data type:', typeof data.tsv, 'length:', data.tsv.length);
        
        if (typeof data.tsv === 'string' && data.tsv.length > 0) {
          const tsvLines = data.tsv.split('\n').filter(line => line.trim());
          console.log(`📊 TSV has ${tsvLines.length} lines`);
          
          tsvLines.forEach((line, lineIndex) => {
            const parts = line.split('\t');
            if (parts.length >= 12 && parts[0] === '5') { // Level 5 = word level
              const left = parseInt(parts[6]);
              const top = parseInt(parts[7]);
              const width = parseInt(parts[8]);
              const height = parseInt(parts[9]);
              const confidence = parseInt(parts[10]);
              const text = parts[11];
              
              if (text && text.trim() && !isNaN(left) && !isNaN(top)) {
                words.push({
                  text: text.trim().toLowerCase(),
                  bbox: {
                    x0: left,
                    y0: top,
                    x1: left + width,
                    y1: top + height
                  },
                  confidence: confidence
                });
                
                if (lineIndex < 5) { // Log first few for debugging
                  console.log(`      📊 TSV Word: "${text}" at (${left}, ${top})`);
                }
              }
            }
          });
          
          console.log(`✅ TSV fallback extracted ${words.length} words`);
        }
      }
      
      // For each suspicious phrase, find matching words and create highlight
      quoteMatches.forEach((quotedPhrase, index) => {
        const phrase = quotedPhrase.replace(/"/g, '').toLowerCase();
        const phraseWords = phrase.split(/\s+/).filter(w => w.length > 2); // Only significant words
        
        console.log(`🔍 Searching for phrase: "${phrase}" (${phraseWords.length} words)`);
        
        // Find words that match this phrase
        phraseWords.forEach(searchWord => {
          const matchingWords = words.filter(w => 
            w.text.includes(searchWord) || searchWord.includes(w.text)
          );
          
          matchingWords.forEach((word, wordIndex) => {
            const screenX = Math.round(word.bbox.x0 * scaleX);
            const screenY = Math.round(word.bbox.y0 * scaleY);
            const screenW = Math.round((word.bbox.x1 - word.bbox.x0) * scaleX);
            const screenH = Math.round((word.bbox.y1 - word.bbox.y0) * scaleY);
            
            highlights.push({
              id: `suspicious-${index}-${wordIndex}`,
              text: word.text,
              reason: `Suspicious claim: "${phrase}"`,
              confidence: word.confidence / 100,
              x: screenX,
              y: screenY,
              width: Math.max(screenW, 50),
              height: Math.max(screenH, 20)
            });
          });
        });
      });
      
      console.log(`✨ Created ${highlights.length} highlights for suspicious content`);
      
      if (highlights.length > 0) {
        showHighlights(highlights);
      }
    }
    
    return {
      success: true,
      extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
      analysis: analysis,
      highlightsCreated: highlights.length,
      textLength: extractedText.length
    };
    
  } catch (error) {
    console.error('❌ Fact-check failed:', error);
    return {
      success: false,
      error: error.message,
      analysis: `Error analyzing screen: ${error.message}`
    };
  }
});

// Legacy handler for backwards compatibility
ipcMain.handle('highlights:find-heyjarvis', async () => {
  console.log('⚠️ Legacy handler called - redirecting to new fact-check system');
  // Just return a simple success for now to prevent errors
  return { 
    success: true, 
    found: 0, 
    method: 'legacy-redirect',
    message: 'Please use the new fact-check system'
  };
});

// Calibration mode - creates a grid to help fine-tune OCR coordinate mapping
ipcMain.handle('highlights:calibrate', async () => {
  console.log('🎯 Starting coordinate calibration mode...');
  
  try {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    
    // Create a calibration grid with known coordinates
    const calibrationPoints = [];
    
    // Create a 3x3 grid of calibration points
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = Math.round((screenWidth / 4) * (col + 1));
        const y = Math.round((screenHeight / 4) * (row + 1));
        
        calibrationPoints.push({
          id: `calibration-${row}-${col}`,
          text: `CAL(${x},${y})`,
          reason: `Calibration point at exact coordinates (${x}, ${y})`,
          confidence: 1.0,
          x: x,
          y: y,
          width: 120,
          height: 30,
          debugColor: 'lime' // Use lime color for calibration points
        });
      }
    }
    
    // Add corner markers
    const corners = [
      { x: 50, y: 50, label: 'TOP-LEFT' },
      { x: screenWidth - 150, y: 50, label: 'TOP-RIGHT' },
      { x: 50, y: screenHeight - 80, label: 'BOTTOM-LEFT' },
      { x: screenWidth - 150, y: screenHeight - 80, label: 'BOTTOM-RIGHT' }
    ];
    
    corners.forEach((corner, index) => {
      calibrationPoints.push({
        id: `corner-${index}`,
        text: corner.label,
        reason: `Corner marker at (${corner.x}, ${corner.y})`,
        confidence: 1.0,
        x: corner.x,
        y: corner.y,
        width: 100,
        height: 25,
        debugColor: 'cyan'
      });
    });
    
    console.log(`🎯 Created ${calibrationPoints.length} calibration points`);
    showHighlights(calibrationPoints);
    
    return { 
      success: true, 
      found: calibrationPoints.length, 
      method: 'calibration',
      screenDimensions: { width: screenWidth, height: screenHeight }
    };
    
  } catch (error) {
    console.error('❌ Calibration failed:', error);
    return { success: false, error: error.message };
  }
});

// Test function to highlight "heyjarvis" on Cursor screen using real text detection
ipcMain.handle('highlights:test', async () => {
  console.log('🧪 Testing highlight overlay - searching for actual "heyjarvis" text positions');
  
  try {
    // Use AppleScript to find text positions in the frontmost application
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // First try to capture screen and use simple text search
    console.log('🔍 Attempting screen capture for text detection...');
    
    const { desktopCapturer, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: primaryDisplay.size.width,
          height: primaryDisplay.size.height
        }
      });
      
      if (sources.length > 0) {
        console.log('📸 Screen captured, attempting text search...');
        // For now, we'll use the accessibility API as fallback
      }
    } catch (captureError) {
      console.log('⚠️ Screen capture failed:', captureError.message);
    }
    
    // Get the frontmost application and search for text
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        log "Searching in application: " & frontApp
        tell application process frontApp
          try
            -- Try multiple approaches to find text
            set allTextElements to {}
            
            -- Method 1: Search for text fields and static text
            try
              set textFields to every text field
              set staticTexts to every static text
              set allTextElements to textFields & staticTexts
            end try
            
            -- Method 2: Search all UI elements recursively
            try
              set allElements to every UI element
              set allTextElements to allTextElements & allElements
            end try
            
            set results to {}
            set searchTerms to {"heyjarvis", "HeyJarvis", "jarvis", "Jarvis", "JARVIS"}
            
            repeat with textElement in allTextElements
              try
                set elementValue to value of textElement
                if elementValue is not missing value and elementValue is not "" then
                  repeat with searchTerm in searchTerms
                    if elementValue contains searchTerm then
                      set elementPosition to position of textElement
                      set elementSize to size of textElement
                      set end of results to {elementValue, elementPosition, elementSize, searchTerm}
                      exit repeat
                    end if
                  end repeat
                end if
              end try
            end repeat
            
            log "Found " & (count of results) & " matching elements"
            return results
          on error errMsg
            log "Error searching for text: " & errMsg
            return {}
          end try
        end tell
      end tell
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    console.log('🔍 AppleScript result:', stdout);
    
    // Parse the results and create highlights
    const testHighlights = [];
    
    // If we found actual text positions, use them
    if (stdout && stdout.trim().length > 0) {
      // Parse AppleScript output (this is a simplified parser)
      const lines = stdout.split('\n').filter(line => line.trim());
      lines.forEach((line, index) => {
        if (line.includes('jarvis')) {
          testHighlights.push({
            id: `found-heyjarvis-${index}`,
            text: 'heyjarvis (found)',
            reason: `Found actual "heyjarvis" text in application`,
            confidence: 0.95,
            x: 100 + (index * 150), // Spread them out horizontally
            y: 200 + (index * 50),   // Spread them out vertically
            width: 140,
            height: 30
          });
        }
      });
    }
    
    // Fallback: Create highlights at common Cursor locations
    if (testHighlights.length === 0) {
      console.log('📍 No text found via accessibility, using Cursor-specific positions');
      
      // Get screen dimensions for better positioning
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
      
      console.log(`📺 Screen dimensions: ${screenWidth}x${screenHeight}`);
      
      // Create a grid of test highlights to help debug positioning
      const debugPositions = [
        // Corner markers
        { x: 50, y: 50, label: 'Top-left corner', color: 'red' },
        { x: screenWidth - 200, y: 50, label: 'Top-right corner', color: 'blue' },
        { x: 50, y: screenHeight - 100, label: 'Bottom-left corner', color: 'green' },
        { x: screenWidth - 200, y: screenHeight - 100, label: 'Bottom-right corner', color: 'purple' },
        
        // Center markers
        { x: screenWidth / 2 - 100, y: 100, label: 'Top center', color: 'orange' },
        { x: screenWidth / 2 - 100, y: screenHeight / 2, label: 'Screen center', color: 'yellow' },
        { x: screenWidth / 2 - 100, y: screenHeight - 150, label: 'Bottom center', color: 'pink' },
        
        // Common Cursor areas (updated for better detection)
        { x: 100, y: screenHeight - 200, label: 'Terminal area', color: 'cyan' },
        { x: 50, y: 150, label: 'File explorer', color: 'lime' },
        { x: screenWidth / 3, y: 80, label: 'Tab area', color: 'magenta' },
        { x: screenWidth / 2, y: 200, label: 'Main editor', color: 'teal' },
      ];
      
      debugPositions.forEach((pos, index) => {
        testHighlights.push({
          id: `debug-pos-${index}`,
          text: `DEBUG: ${pos.label}`,
          reason: `Debug highlight at ${pos.label} (${pos.x}, ${pos.y}) - Screen: ${screenWidth}x${screenHeight}`,
          confidence: 0.9,
          x: pos.x,
          y: pos.y,
          width: 200,
          height: 40,
          debugColor: pos.color
        });
      });
      
      console.log(`🎯 Created ${debugPositions.length} debug highlights across screen`);
    }
    
    console.log(`🎯 Created ${testHighlights.length} test highlights`);
    showHighlights(testHighlights);
    return { success: true, found: testHighlights.length };
    
  } catch (error) {
    console.error('❌ Test highlight error:', error);
    
    // Ultimate fallback - single obvious highlight
    const fallbackHighlight = [{
      id: 'fallback-test',
      text: 'TEST HIGHLIGHT',
      reason: 'Fallback test highlight - accessibility search failed',
      confidence: 0.5,
      x: 200,
      y: 200,
      width: 200,
      height: 40
    }];
    
    showHighlights(fallbackHighlight);
    return { success: false, error: error.message };
  }
});

// Helper function to create mock text blocks from clipboard content
function createMockTextBlocks(text) {
  const blocks = [];
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  
  // Split into sentences and paragraphs
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Common content area (center 70% of screen, avoiding edges)
  const contentStartX = Math.floor(screenWidth * 0.15);
  const contentEndX = Math.floor(screenWidth * 0.85);
  const contentStartY = Math.floor(screenHeight * 0.15);
  
  sentences.forEach((sentence, index) => {
    const trimmed = sentence.trim();
    if (trimmed.length > 10) {
      // Distribute blocks across typical content areas
      const row = Math.floor(index / 2);
      const col = index % 2;
      
      blocks.push({
        text: trimmed,
        x: contentStartX + (col * Math.floor((contentEndX - contentStartX) / 2)),
        y: contentStartY + (row * 60), // 60px between rows
        width: Math.min(trimmed.length * 7, Math.floor((contentEndX - contentStartX) / 2) - 20),
        height: 40,
        confidence: 0.8
      });
    }
  });
  
  return blocks;
}

console.log('✅ Fact check IPC handlers registered');
console.log('✅ Highlight overlay handlers registered');