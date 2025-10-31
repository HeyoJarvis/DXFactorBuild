/**
 * HeyJarvis Desktop v2 - Main Process Entry Point
 * Modern architecture with organized services and IPC handlers
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { app, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const winston = require('winston');

// Import managers
const MainWindowManager = require('./windows/MainWindowManager');
const SecondaryWindowManager = require('./windows/SecondaryWindowManager');
const CopilotOverlayManager = require('./windows/CopilotOverlayManager');
const TrayManager = require('./windows/TrayManager');

// Import services
const AuthService = require('./services/AuthService');
const SlackService = require('./services/SlackService');
const CRMService = require('./services/CRMService');
const AIService = require('./services/AIService');

// Import IPC handlers
const registerAuthHandlers = require('./ipc/auth-handlers');
const registerChatHandlers = require('./ipc/chat-handlers');
const registerTaskHandlers = require('./ipc/task-handlers');
const registerTaskChatHandlers = require('./ipc/task-chat-handlers');
const registerTeamChatHandlers = require('./ipc/team-chat-handlers');
const registerUserChatHandlers = require('./ipc/user-chat-handlers');
const registerSystemHandlers = require('./ipc/system-handlers');
const registerWindowHandlers = require('./ipc/window-handlers');
const registerArcReactorHandlers = require('./ipc/arc-reactor-handlers');
const registerJIRAHandlers = require('./ipc/jira-handlers');
const { registerConfluenceHandlers } = require('./ipc/confluence-handlers');
const registerMissionControlHandlers = require('./ipc/mission-control-handlers');
const registerOnboardingHandlers = require('./ipc/onboarding-handlers');
const registerTeamHandlers = require('./ipc/team-handlers');
const registerAdminHandlers = require('./ipc/admin-handlers');
const CodeIndexerHandlers = require('./ipc/code-indexer-handlers');

// Setup logger (console only at startup, file transport added after app ready)
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
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
  logger.error('Unhandled Rejection:', {
    reason: reason?.message || reason?.toString() || reason,
    stack: reason?.stack,
    type: typeof reason
  });
  console.error('Unhandled Promise Rejection:', reason);
});

/**
 * Auto-initialize user's connected integrations
 * Called on app startup if user session exists, or after login
 */
async function autoInitializeUserIntegrations(userId) {
  try {
    logger.info('🔄 Auto-initializing user integrations...', { userId });
    
    // Get user's integration settings
    const { data: userData, error } = await appState.services.dbAdapter.supabase
      .from('users')
      .select('integration_settings')
      .eq('id', userId)
      .single();
    
    if (error) {
      logger.warn('Could not fetch integration settings', { error: error.message });
      return;
    }
    
    const integrations = userData?.integration_settings || {};
    const initPromises = [];

    // Log what integrations we found
    logger.info('📋 Integration settings found in database:', {
      userId,
      hasJira: !!integrations.jira?.access_token,
      hasGoogle: !!integrations.google?.access_token,
      hasMicrosoft: !!integrations.microsoft?.access_token,
      microsoftAuthenticated: integrations.microsoft?.authenticated,
      microsoftAccount: integrations.microsoft?.account
    });

    // Initialize JIRA if tokens exist
    if (integrations.jira?.access_token) {
      logger.info('🔗 Auto-initializing JIRA service...', { userId });
      initPromises.push(
        appState.services.jira.initialize(userId)
          .then((result) => {
            if (result.success && result.connected) {
              logger.info('✅ JIRA service initialized successfully', {
                userId,
                siteUrl: result.siteUrl
              });
              // Start auto-sync for JIRA tasks
              appState.services.jira.startAutoSync(userId, 10); // Every 10 minutes
              logger.info('🔄 JIRA auto-sync started (10 min interval)');
            } else {
              logger.warn('⚠️ JIRA initialization returned not connected', { result });
            }
          })
          .catch((error) => {
            logger.error('❌ JIRA initialization failed', { 
              error: error.message,
              userId 
            });
          })
      );
    }
    
    // Initialize Google if tokens exist
    if (integrations.google?.access_token) {
      logger.info('🔗 Auto-initializing Google service...', { userId });
      initPromises.push(
        appState.services.google.initialize(userId)
          .then((result) => {
            if (result.success && result.connected) {
              logger.info('✅ Google service initialized successfully', { userId });
            } else {
              logger.warn('⚠️ Google initialization returned not connected', { result });
            }
          })
          .catch((error) => {
            logger.error('❌ Google initialization failed', { 
              error: error.message,
              userId 
            });
          })
      );
    }
    
    // Initialize Microsoft if tokens exist
    if (integrations.microsoft?.access_token) {
      logger.info('🔗 Auto-initializing Microsoft service...', { userId });
      initPromises.push(
        appState.services.microsoft.initialize(userId)
          .then((result) => {
            if (result.success && result.connected) {
              logger.info('✅ Microsoft service initialized successfully', { userId });
            } else {
              logger.warn('⚠️ Microsoft initialization returned not connected', { result });
            }
          })
          .catch((error) => {
            logger.error('❌ Microsoft initialization failed', { 
              error: error.message,
              userId 
            });
          })
      );
    }
    
    // Wait for all initializations (don't fail if one fails)
    if (initPromises.length > 0) {
      await Promise.allSettled(initPromises);
      logger.info(`🎉 Integration auto-initialization complete (${initPromises.length} service(s))`, {
        userId
      });
    } else {
      logger.info('ℹ️ No existing integrations found for user', { userId });
    }
    
  } catch (error) {
    logger.error('Failed to auto-initialize user integrations', { 
      error: error.message,
      userId 
    });
    // Don't throw - this shouldn't prevent app from starting
  }
}

/**
 * Start OAuth server for Microsoft/Google authentication
 */
async function startOAuthServer() {
  try {
    logger.info('🔐 Starting OAuth server for Microsoft/Google authentication...');
    
    const express = require('express');
    const oauthApp = express();
    const PORT = 8890;
    
    // Store pending auth data that AuthService will poll for
    let pendingAuthData = null;
    
    // Simple health check
    oauthApp.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    // Status endpoint for AuthService to poll
    oauthApp.get('/auth/status', (req, res) => {
      if (pendingAuthData) {
        const data = { ...pendingAuthData };
        pendingAuthData = null; // Clear after reading
        res.json(data);
      } else {
        res.json({ authenticated: false });
      }
    });
    
    // Store PKCE verifiers for each auth session with timestamp
    const pkceVerifiers = new Map();

    // Clean up expired verifiers (older than 10 minutes)
    setInterval(() => {
      const now = Date.now();
      for (const [state, data] of pkceVerifiers.entries()) {
        if (now - data.timestamp > 10 * 60 * 1000) {
          logger.warn('🧹 Cleaning up expired PKCE verifier', { state });
          pkceVerifiers.delete(state);
        }
      }
    }, 60 * 1000); // Check every minute

    // Helper to generate PKCE challenge
    function generatePKCE() {
      const crypto = require('crypto');
      const verifier = crypto.randomBytes(32).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      return { verifier, challenge };
    }

    // Microsoft OAuth routes with PKCE
    oauthApp.get('/auth/microsoft', (req, res) => {
      // Generate PKCE challenge
      const { verifier, challenge } = generatePKCE();
      const state = require('crypto').randomBytes(16).toString('hex');

      // Store verifier with timestamp for later use
      pkceVerifiers.set(state, {
        verifier,
        timestamp: Date.now()
      });

      logger.info('🔐 Starting Microsoft OAuth with PKCE', {
        state,
        totalVerifiers: pkceVerifiers.size
      });

      // Redirect to Microsoft OAuth with PKCE
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const redirectUri = encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${PORT}/auth/microsoft/callback`);
      const scopes = encodeURIComponent('openid profile email User.Read Calendars.ReadWrite Mail.Read');

      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

      res.redirect(authUrl);
    });
    
    // Microsoft OAuth callback with PKCE
    oauthApp.get('/auth/microsoft/callback', async (req, res) => {
      const { code, error, state } = req.query;

      logger.info('📥 Microsoft OAuth callback received', {
        hasCode: !!code,
        hasError: !!error,
        state,
        totalVerifiers: pkceVerifiers.size,
        availableStates: Array.from(pkceVerifiers.keys())
      });

      if (error) {
        logger.error('Microsoft OAuth error:', error);
        res.send(`<html><body><h1>Authentication Failed</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`);
        return;
      }

      // Get PKCE verifier for this session
      const verifierData = pkceVerifiers.get(state);
      if (!verifierData) {
        logger.error('PKCE verifier not found for state:', {
          requestedState: state,
          availableStates: Array.from(pkceVerifiers.keys()),
          totalVerifiers: pkceVerifiers.size
        });
        res.send(`<html><body><h1>Authentication Failed</h1><p>Session expired. Please try again.</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`);
        return;
      }

      const codeVerifier = verifierData.verifier;
      const age = Date.now() - verifierData.timestamp;
      logger.info('✅ PKCE verifier found', {
        state,
        ageSeconds: Math.floor(age / 1000)
      });

      // Clean up used verifier
      pkceVerifiers.delete(state);
      
      // Exchange code for tokens using PKCE (no client_secret)
      const axios = require('axios');
      try {
        logger.info('🔄 Exchanging Microsoft code for tokens with PKCE...', {
          redirectUri: process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${PORT}/auth/microsoft/callback`,
          hasCode: !!code,
          hasVerifier: !!codeVerifier
        });
        
        const tokenResponse = await axios.post(
          'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID,
            code: code,
            redirect_uri: process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${PORT}/auth/microsoft/callback`,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );
        
        logger.info('✅ Token exchange successful with PKCE');
        
        const tokens = tokenResponse.data;
        
        // Get user info from Microsoft Graph
        const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        
        const userData = userResponse.data;
        
        // Store auth data for AuthService to poll
        // 🔥 CRITICAL FIX: tokens must be at root level, not nested in user
        pendingAuthData = {
          authenticated: true,
          provider: 'microsoft',
          user: {
            id: userData.id,
            email: userData.mail || userData.userPrincipalName,
            name: userData.displayName,
            avatar_url: null
          },
          // Tokens at root level for AuthService to save to database
          tokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            token_type: tokens.token_type,
            scope: tokens.scope
          }
        };
        
        logger.info('✅ Microsoft auth successful, data ready for polling', { 
          email: userData.mail 
        });
        
        // Send success response with user data
        res.send(`
          <html>
          <body>
            <h1>Authentication Successful!</h1>
            <p>Welcome, ${userData.displayName || userData.mail}</p>
            <p>You can close this window.</p>
            <script>
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
          </html>
        `);
        
      } catch (error) {
        logger.error('Failed to exchange Microsoft code for tokens:', {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        
        const errorDetails = error.response?.data?.error_description || error.message;
        res.send(`<html><body><h1>Authentication Failed</h1><p>${errorDetails}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`);
      }
    });
    
    // Google OAuth routes (similar pattern)
    oauthApp.get('/auth/google', (req, res) => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`);
      const scopes = encodeURIComponent('openid profile email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly');
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&access_type=offline&prompt=consent`;
      
      res.redirect(authUrl);
    });
    
    oauthApp.get('/auth/google/callback', async (req, res) => {
      const { code, error } = req.query;
      
      if (error) {
        logger.error('Google OAuth error:', error);
        res.send(`<html><body><h1>Authentication Failed</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`);
        return;
      }
      
      const axios = require('axios');
      try {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code: code,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`,
          grant_type: 'authorization_code'
        });
        
        const tokens = tokenResponse.data;
        
        // Get user info
        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        
        const userData = userResponse.data;

        // Store auth data for AuthService to poll
        // 🔥 CRITICAL FIX: tokens must be at root level, not nested in user
        pendingAuthData = {
          authenticated: true,
          provider: 'google',
          user: {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            avatar_url: userData.picture
          },
          // Tokens at root level for AuthService to save to database
          tokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            token_type: tokens.token_type,
            scope: tokens.scope
          }
        };

        logger.info('✅ Google auth successful, data ready for polling', {
          email: userData.email
        });
        
        res.send(`
          <html>
          <body>
            <h1>Authentication Successful!</h1>
            <p>Welcome, ${userData.name || userData.email}</p>
            <p>You can close this window.</p>
            <script>
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
          </html>
        `);
        
      } catch (error) {
        logger.error('Failed to exchange Google code for tokens:', error.message);
        res.send(`<html><body><h1>Authentication Failed</h1><p>${error.message}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`);
      }
    });
    
    // Start server
    const server = oauthApp.listen(PORT, () => {
      logger.info(`✅ OAuth server running on http://localhost:${PORT}`);
      console.log(`🔐 OAuth server ready for Microsoft/Google authentication`);
    });
    
    appState.oauthServer = server;
    
  } catch (error) {
    logger.error('Failed to start OAuth server:', error.message);
    // Don't fail app startup if OAuth server fails
  }
}

/**
 * Initialize all services
 */
async function initializeServices() {
  logger.info('Initializing services...');

  try {
    // Load Supabase adapter
    const SupabaseAdapter = require('./services/SupabaseAdapter');
    appState.services.dbAdapter = new SupabaseAdapter({ useServiceRole: true });

    // Initialize auth service
    appState.services.auth = new AuthService({ logger });
    
    // 🔥 Start OAuth server for Microsoft/Google
    await startOAuthServer();

    // Initialize core services
    appState.services.slack = new SlackService({ 
      logger, 
      supabaseAdapter: appState.services.dbAdapter 
    });
    appState.services.crm = new CRMService({ logger });
    appState.services.ai = new AIService({ logger });
    
    // 🔥 Initialize integration services (will be connected per-user)
    const JIRAService = require('./services/JIRAService');
    const GoogleService = require('./services/GoogleService');
    const MicrosoftService = require('./services/MicrosoftService');
    const GitHubService = require('./services/GitHubService');
    
    appState.services.jira = new JIRAService({ 
      logger, 
      supabaseAdapter: appState.services.dbAdapter 
    });
    
    appState.services.google = new GoogleService({ 
      logger, 
      supabaseAdapter: appState.services.dbAdapter 
    });
    
    appState.services.microsoft = new MicrosoftService({
      logger,
      supabaseAdapter: appState.services.dbAdapter
    });
    
    appState.services.github = new GitHubService({
      logger,
      supabaseAdapter: appState.services.dbAdapter
    });
    
    logger.info('✅ Integration services created', {
      serviceKeys: Object.keys(appState.services),
      hasGithub: !!appState.services.github,
      hasJira: !!appState.services.jira,
      hasGoogle: !!appState.services.google,
      hasMicrosoft: !!appState.services.microsoft
    });

    // Start core services
    await Promise.all([
      appState.services.slack.initialize(),
      appState.services.crm.initialize(),
      appState.services.ai.initialize()
    ]);
    
    // 🔥 Check if user is already logged in and auto-initialize their integrations
    try {
      const existingSession = await appState.services.auth.loadSession();
      if (existingSession?.user) {
        logger.info('✅ Existing session found, auto-initializing user integrations...', {
          userId: existingSession.user.id,
          email: existingSession.user.email
        });
        await autoInitializeUserIntegrations(existingSession.user.id);
      } else {
        logger.info('ℹ️ No existing session - user will need to log in');
      }
    } catch (error) {
      logger.error('Failed to check existing session', { error: error.message });
    }
    
    // Setup Slack task auto-creation
    appState.services.slack.on('task-detected', async (taskData) => {
      try {
        logger.info('Auto-creating task from Slack', { title: taskData.title });
        
        // Get current authenticated user ID
        const userId = appState.services.auth?.currentUser?.id;
        if (!userId) {
          logger.error('Cannot create task: No authenticated user');
          return;
        }
        
        const result = await appState.services.dbAdapter.createTask(userId, taskData);
        
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

  registerAuthHandlers(appState.services, logger);
  registerChatHandlers(appState.services, logger);
  registerTaskHandlers(appState.services, logger);
  registerTaskChatHandlers(appState.services, logger);
  registerTeamChatHandlers(appState.services, logger);
  registerUserChatHandlers(appState.services, logger);
  registerSystemHandlers(appState.services, logger);
  registerWindowHandlers(appState.windows, logger);
  registerArcReactorHandlers(appState.services, logger);
  registerJIRAHandlers(appState.services, logger);
  registerConfluenceHandlers(appState.services, logger);
  registerMissionControlHandlers(appState.services, logger);
  registerOnboardingHandlers(appState.services, logger);
  registerTeamHandlers(appState.services, logger);
  registerAdminHandlers(appState.services, logger);

  // Setup code indexer handlers
  const codeIndexerHandlers = new CodeIndexerHandlers(logger, appState.services);
  codeIndexerHandlers.setup();

  logger.info('IPC handlers registered');
}

/**
 * Create application windows
 */
function createWindows() {
  logger.info('Creating windows...');

  // Create main window manager (Arc Reactor orb only)
  appState.windows.main = new MainWindowManager({ logger });
  appState.windows.main.create();

  // Create secondary window manager (for Tasks/Copilot UI)
  // Pass main window manager and ipcMain for communication
  appState.windows.secondary = new SecondaryWindowManager(logger, appState.windows.main, ipcMain);
  // Don't create yet - will be created on demand when user clicks menu

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
 * Deep link handler for OAuth callbacks
 * Handles: heyjarvis://auth/callback?code=xxx&state=xxx
 */
function setupDeepLinkHandler() {
  // Protocol registration
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('heyjarvis', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('heyjarvis');
  }

  // Handle deep link on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    logger.info('Deep link received:', url);
    handleDeepLink(url);
  });

  // Handle deep link on Windows/Linux (second instance)
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('heyjarvis://'));
    if (url) {
      logger.info('Deep link received (second instance):', url);
      handleDeepLink(url);
    }

    // Focus the main window
    if (appState.windows.main) {
      const mainWindow = appState.windows.main.getWindow();
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });

  logger.info('Deep link handler registered for heyjarvis:// protocol');
}

/**
 * Process deep link URL
 * @param {string} url - Deep link URL (e.g., heyjarvis://auth/callback?code=xxx)
 */
function handleDeepLink(url) {
  try {
    const parsedUrl = new URL(url);

    // Handle OAuth callback
    if (parsedUrl.protocol === 'heyjarvis:' && parsedUrl.pathname === '//auth/callback') {
      const code = parsedUrl.searchParams.get('code');
      const state = parsedUrl.searchParams.get('state');
      const error = parsedUrl.searchParams.get('error');

      logger.info('OAuth callback received', { code: !!code, state, error });

      // Send to renderer process (login flow)
      const mainWindow = appState.windows.main?.getWindow();
      if (mainWindow) {
        mainWindow.webContents.send('auth:callback', {
          code,
          state,
          error,
          url
        });

        // Focus and show window
        mainWindow.show();
        mainWindow.focus();
      }

      // Also check secondary window (if login is shown there)
      const secondaryWindow = appState.windows.secondary?.getWindow();
      if (secondaryWindow) {
        secondaryWindow.webContents.send('auth:callback', {
          code,
          state,
          error,
          url
        });
        secondaryWindow.show();
        secondaryWindow.focus();
      }
    }
  } catch (err) {
    logger.error('Failed to handle deep link:', err);
  }
}

/**
 * Application ready handler
 */
app.whenReady().then(async () => {
  logger.info('🚀 HeyJarvis Desktop v2 starting...');

  // Setup deep link handler FIRST (before windows are created)
  setupDeepLinkHandler();

  // Setup emergency shortcuts
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

