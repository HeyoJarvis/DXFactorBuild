/**
 * HeyJarvis Desktop v2 - Main Process Entry Point
 * Modern architecture with organized services and IPC handlers
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { app, globalShortcut } = require('electron');
const path = require('path');
const winston = require('winston');

// Import managers
const MainWindowManager = require('./windows/MainWindowManager');
const CopilotOverlayManager = require('./windows/CopilotOverlayManager');
const TrayManager = require('./windows/TrayManager');

// Import services
const SlackService = require('./services/SlackService');
const CRMService = require('./services/CRMService');
const AIService = require('./services/AIService');

// Import IPC handlers
const registerChatHandlers = require('./ipc/chat-handlers');
const registerTaskHandlers = require('./ipc/task-handlers');
const registerTaskChatHandlers = require('./ipc/task-chat-handlers');
const registerSystemHandlers = require('./ipc/system-handlers');
const registerWindowHandlers = require('./ipc/window-handlers');
const registerArcReactorHandlers = require('./ipc/arc-reactor-handlers');

// Setup logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
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
  defaultMeta: { service: 'desktop2-main' }
});

// Application state
const appState = {
  windows: {},
  services: {},
  tray: null,
  isQuitting: false
};

// Global error handlers
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
});

/**
 * Initialize all services
 */
async function initializeServices() {
  logger.info('Initializing services...');

  try {
    // Load Supabase adapter
    const SupabaseAdapter = require('./services/SupabaseAdapter');
    appState.services.dbAdapter = new SupabaseAdapter({ useServiceRole: true });

    // Initialize services
    appState.services.slack = new SlackService({ logger });
    appState.services.crm = new CRMService({ logger });
    appState.services.ai = new AIService({ logger });

    // Start services
    await Promise.all([
      appState.services.slack.initialize(),
      appState.services.crm.initialize(),
      appState.services.ai.initialize()
    ]);
    
    // Setup Slack task auto-creation
    appState.services.slack.on('task-detected', async (taskData) => {
      try {
        logger.info('Auto-creating task from Slack', { title: taskData.title });
        
        const result = await appState.services.dbAdapter.createTask('desktop-user', taskData);
        
        if (result.success) {
          logger.info('✅ Task auto-created from Slack', {
            taskId: result.task.id,
            title: taskData.title
          });
          
          // Notify UI to refresh tasks
          const mainWindow = appState.windows.main?.getWindow();
          if (mainWindow) {
            mainWindow.webContents.send('task:created', {
              id: result.task.id,
              title: result.task.session_title,
              priority: result.task.workflow_metadata?.priority,
              status: 'todo',
              createdAt: result.task.started_at
            });
          }
        } else {
          logger.error('Failed to auto-create task', { error: result.error });
        }
      } catch (error) {
        logger.error('Task auto-creation error:', error);
      }
    });

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Service initialization failed:', error);
  }
}

/**
 * Setup IPC handlers
 */
function setupIPC() {
  logger.info('Setting up IPC handlers...');

  registerChatHandlers(appState.services, logger);
  registerTaskHandlers(appState.services, logger);
  registerTaskChatHandlers(appState.services, logger);
  registerSystemHandlers(appState.services, logger);
  registerWindowHandlers(appState.windows, logger);
  registerArcReactorHandlers(appState.services, logger);

  logger.info('IPC handlers registered');
}

/**
 * Create application windows
 */
function createWindows() {
  logger.info('Creating windows...');

  // Create main window manager
  appState.windows.main = new MainWindowManager({ logger });
  appState.windows.main.create();

  // Create copilot overlay manager
  appState.windows.copilot = new CopilotOverlayManager({ logger });
  
  // Create system tray
  appState.tray = new TrayManager({ logger, windows: appState.windows });
  appState.tray.create();

  logger.info('Windows created successfully');
}

/**
 * Setup emergency escape shortcuts
 */
function setupEmergencyShortcuts() {
  // Command+Q / Ctrl+Q - Quit app
  globalShortcut.register('CommandOrControl+Q', () => {
    logger.info('🚨 Emergency quit triggered (Cmd/Ctrl+Q)');
    app.quit();
  });

  // Command+Escape / Ctrl+Escape - Force quit
  globalShortcut.register('CommandOrControl+Escape', () => {
    logger.info('🚨 Emergency force quit triggered (Cmd/Ctrl+Escape)');
    app.quit();
  });

  // Command+Shift+Q - Also quit (standard macOS)
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    logger.info('🚨 Emergency quit triggered (Cmd/Ctrl+Shift+Q)');
    app.quit();
  });

  logger.info('🛡️ Emergency shortcuts registered (Cmd+Q, Cmd+Escape, Cmd+Shift+Q)');
}

/**
 * Application ready handler
 */
app.whenReady().then(async () => {
  logger.info('🚀 HeyJarvis Desktop v2 starting...');

  // Setup emergency shortcuts FIRST
  setupEmergencyShortcuts();

  // Initialize services
  await initializeServices();

  // Setup IPC communication
  setupIPC();

  // Create windows
  createWindows();

  logger.info('✅ HeyJarvis Desktop v2 ready');

  // macOS specific: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (!appState.windows.main.getWindow()) {
      appState.windows.main.create();
    } else {
      appState.windows.main.show();
    }
  });
});

/**
 * All windows closed handler
 */
app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Before quit handler
 */
app.on('before-quit', () => {
  appState.isQuitting = true;
  logger.info('Application quitting...');
  
  // Cleanup services
  Object.values(appState.services).forEach(service => {
    if (service.cleanup) service.cleanup();
  });
});

/**
 * Quit handler
 */
app.on('quit', () => {
  logger.info('👋 HeyJarvis Desktop v2 stopped');
});

// Export for testing
module.exports = { appState, logger };

