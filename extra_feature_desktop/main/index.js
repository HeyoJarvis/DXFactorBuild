/**
 * Main Process Entry Point
 * Team Sync Intelligence Electron App
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const winston = require('winston');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Services
const TeamSyncSupabaseAdapter = require('./services/TeamSyncSupabaseAdapter');

// OAuth Services (NEW - Team Sync specific)
const MicrosoftOAuthService = require('./services/oauth/MicrosoftOAuthService');
const JIRAOAuthService = require('./services/oauth/JIRAOAuthService');
const GitHubOAuthService = require('./services/oauth/GitHubOAuthService');

// Standalone Integration Services (NEW)
const StandaloneMicrosoftService = require('./services/StandaloneMicrosoftService');
const StandaloneJIRAService = require('./services/StandaloneJIRAService');
const GitHubServiceWrapper = require('./services/GitHubServiceWrapper');

// Intelligence Services
const MeetingIntelligenceService = require('./services/MeetingIntelligenceService');
const TranscriptPollingService = require('./services/TranscriptPollingService');
const TaskCodeIntelligenceService = require('./services/TaskCodeIntelligenceService');
const TeamContextEngine = require('./services/TeamContextEngine');
const BackgroundSyncService = require('./services/BackgroundSyncService');
const TimeZoneService = require('./services/TimeZoneService');

// Code Intelligence Services (GitHub Repository Indexing)
const CodeIndexer = require('../../core/intelligence/code-indexer');

// IPC Handlers
const { registerMeetingHandlers } = require('./ipc/meeting-handlers');
const { registerIntelligenceHandlers } = require('./ipc/intelligence-handlers');
const { registerSyncHandlers } = require('./ipc/sync-handlers');
const { registerAuthHandlers } = require('./ipc/auth-handlers');
const { registerGitHubHandlers } = require('./ipc/github-handlers');
const { registerCodeIndexerHandlers } = require('./ipc/code-indexer-handlers');
const { registerTeamHandlers } = require('./ipc/team-handlers');

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/main.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  defaultMeta: { service: 'team-sync-main' },
  // Prevent uncaught exceptions from crashing the app
  exitOnError: false
});

// Add console transport only if not in production and handle errors
if (process.env.NODE_ENV !== 'production') {
  const consoleTransport = new winston.transports.Console({
    handleExceptions: true
  });
  
  // Ignore EPIPE errors from console
  consoleTransport.on('error', (error) => {
    if (error.code === 'EPIPE') {
      // Ignore broken pipe errors
      return;
    }
    console.error('Console transport error:', error.message);
  });
  
  logger.add(consoleTransport);
}

let mainWindow = null;
let services = {};

/**
 * Create main window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../bridge/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Main window created');
}

/**
 * Initialize transcript polling service
 */
function initializeTranscriptPolling(transcriptPollingService) {
  try {
    logger.info('Starting transcript polling service...');
    transcriptPollingService.start();
    logger.info('✅ Transcript polling started - checking every 2 minutes');
    logger.info('📝 No webhooks needed - stable polling-based transcript sync');
  } catch (error) {
    logger.error('Failed to start transcript polling', {
      error: error.message
    });
  }
}

/**
 * Initialize services
 */
async function initializeServices() {
  try {
    logger.info('Initializing services...');

    // Initialize Supabase adapter
    const supabaseAdapter = new TeamSyncSupabaseAdapter({ logger });
    
    // Initialize OAuth Services (for authentication)
    const microsoftOAuthService = new MicrosoftOAuthService({ 
      logger, 
      supabaseAdapter 
    });
    
    const jiraOAuthService = new JIRAOAuthService({ 
      logger, 
      supabaseAdapter 
    });
    
    const githubOAuthService = new GitHubOAuthService({ 
      logger, 
      supabaseAdapter 
    });

    // Initialize Standalone Integration Services (use OAuth tokens)
    const microsoftService = new StandaloneMicrosoftService({ 
      logger, 
      supabaseAdapter,
      oauthService: microsoftOAuthService
    });

    const jiraService = new StandaloneJIRAService({ 
      logger, 
      supabaseAdapter,
      oauthService: jiraOAuthService
    });

    // GitHub service - handle initialization errors gracefully
    let githubService = null;
    try {
      githubService = new GitHubServiceWrapper({ 
        logger,
        supabaseAdapter,
        oauthService: githubOAuthService
      });
    } catch (error) {
      logger.warn('Failed to initialize GitHub service', { error: error.message });
      // Create a mock service that returns empty results
      githubService = {
        isConnected: async () => false,
        isAvailable: () => false,
        getRecentPRs: async () => [],
        getRecentCommits: async () => []
      };
    }

    // Initialize Meeting Intelligence service
    const meetingIntelligenceService = new MeetingIntelligenceService({
      microsoftService,
      supabaseAdapter,
      logger
    });

    // Initialize Transcript Polling Service (STABLE)
    const transcriptPollingService = new TranscriptPollingService({
      microsoftService,
      supabaseAdapter,
      logger
    });

    // Initialize Task & Code Intelligence service
    const taskCodeIntelligenceService = new TaskCodeIntelligenceService({
      jiraService,
      githubService,
      supabaseAdapter,
      logger
    });

    // Initialize Team Context Engine
    const teamContextEngine = new TeamContextEngine({
      supabaseAdapter,
      logger
    });

    // Initialize TimeZone Service
    const timeZoneService = new TimeZoneService({ logger });
    logger.info('✅ TimeZone Service initialized');

    // Initialize Code Indexer (for GitHub repository querying)
    let codeIndexer = null;
    try {
      codeIndexer = new CodeIndexer({
        logLevel: process.env.LOG_LEVEL || 'info'
      });
      logger.info('✅ Code Indexer initialized');
    } catch (error) {
      logger.warn('Failed to initialize Code Indexer', { error: error.message });
      // Create a mock service that returns appropriate errors
      codeIndexer = {
        indexRepository: async () => { 
          throw new Error('Code Indexer not available'); 
        },
        queryEngine: { 
          query: async () => { 
            throw new Error('Code Indexer not available'); 
          } 
        },
        vectorStore: {
          getIndexingStatus: async () => null
        },
        getJobStatus: () => null,
        fileFetcher: {
          _getOctokit: async () => { 
            throw new Error('Code Indexer not available'); 
          }
        }
      };
    }

    // Attach code indexer to team context engine for code-aware queries
    if (codeIndexer && codeIndexer.vectorStore) {
      teamContextEngine.setCodeIndexer(codeIndexer);
      logger.info('✅ Code Indexer attached to Team Context Engine');
    }

    // Initialize Background Sync Service
    const backgroundSyncService = new BackgroundSyncService({
      meetingIntelligenceService,
      transcriptPollingService,  // Pass polling service for transcript fetching
      taskIntelligenceService: taskCodeIntelligenceService,
      logger
    });

    // Listen for sync completion and notify all windows
    backgroundSyncService.on('sync-completed', (data) => {
      logger.info('Sync completed, notifying renderer windows', data);
      
      // Send to all renderer windows
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('sync-completed', data);
      });
    });

    services = {
      supabaseAdapter,
      microsoftOAuthService,
      jiraOAuthService,
      githubOAuthService,
      microsoftService,
      jiraService,
      githubService,
      meetingIntelligenceService,
      transcriptPollingService,
      taskCodeIntelligenceService,
      teamContextEngine,
      backgroundSyncService,
      timeZoneService,
      codeIndexer,
      logger
    };

    // Register IPC handlers
    registerMeetingHandlers(services);
    registerIntelligenceHandlers(services);
    registerSyncHandlers(services);
    registerAuthHandlers(services);
    registerGitHubHandlers(services);
    registerCodeIndexerHandlers(services);
    registerTeamHandlers(services);

    // Start transcript polling service
    initializeTranscriptPolling(transcriptPollingService);

    logger.info('All services initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize services', { error: error.message });
    throw error;
  }
}

/**
 * App ready handler
 */
app.on('ready', async () => {
  try {
    await initializeServices();
    createWindow();
  } catch (error) {
    logger.error('App initialization failed', { error: error.message });
    app.quit();
  }
});

/**
 * Activate handler (macOS)
 */
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Window all closed handler
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Before quit handler
 */
app.on('before-quit', () => {
  logger.info('App shutting down');
  
  // Stop transcript polling service
  if (services.transcriptPollingService) {
    services.transcriptPollingService.stop();
    logger.info('Transcript polling service stopped');
  }
});

// Handle uncaught exceptions and unhandled rejections gracefully
process.on('uncaughtException', (error) => {
  // Ignore EPIPE errors
  if (error.code === 'EPIPE') {
    return;
  }
  
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
    code: error.code
  });
  
  // Don't exit the app
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason,
    promise: promise
  });
});

logger.info('Team Sync Intelligence app starting...');

