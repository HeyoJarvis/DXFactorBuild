/**
 * Mission Control IPC Handlers
 * Handles calendar and email integration for Microsoft and Google
 */

const { ipcMain } = require('electron');
const MicrosoftOAuthHandler = require('../../../oauth/microsoft-oauth-handler');
const GoogleOAuthHandler = require('../../../oauth/google-oauth-handler');

let microsoftOAuthHandler = null;
let googleOAuthHandler = null;

function registerMissionControlHandlers(services, logger) {
  logger.info('🔧 Registering Mission Control handlers...');
  
  // 🔥 Use shared service instances from appState instead of creating new ones
  // This ensures the services initialized on login are the same ones checked by Settings

  // Initialize OAuth handlers for authentication
  logger.info('Initializing Microsoft OAuth handler', {
    clientId: process.env.MICROSOFT_CLIENT_ID ? 'present' : 'missing',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ? 'present' : 'missing',
    redirectUri: process.env.MICROSOFT_REDIRECT_URI
  });
  
  microsoftOAuthHandler = new MicrosoftOAuthHandler({
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:8889/auth/microsoft/callback',
    port: 8889, // Match the port in MICROSOFT_REDIRECT_URI
    logger
  });
  
  logger.info('✅ Microsoft OAuth handler initialized');

  googleOAuthHandler = new GoogleOAuthHandler({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8893/auth/google/callback',
    port: 8893, // Google uses port 8893
    logger
  });

  // ============================================
  // MICROSOFT HANDLERS
  // ============================================

  /**
   * Check Microsoft connection status
   */
  ipcMain.handle('microsoft:checkConnection', async () => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.info('Microsoft connection check: No user authenticated');
        return {
          success: false,
          connected: false,
          error: 'User not authenticated'
        };
      }

      // Check if service is already initialized and ready to use
      const microsoftService = services.microsoft;
      const serviceReady = microsoftService?.isInitialized && microsoftService?.graphService;

      // If service is ready, it's connected! (Fast path)
      if (serviceReady) {
        logger.info('Microsoft connection check: Service ready in memory');
        return {
          success: true,
          connected: true,
          source: 'memory'
        };
      }

      // Service not ready - check database for stored tokens
      const { data: userData, error: dbError } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      if (dbError) {
        logger.error('Failed to check Microsoft connection in DB:', dbError);
        return {
          success: false,
          connected: false,
          error: dbError.message
        };
      }

      const microsoftSettings = userData?.integration_settings?.microsoft;
      const hasTokens = microsoftSettings?.access_token && microsoftSettings?.authenticated === true;

      // If we have tokens but service isn't initialized, auto-initialize it!
      if (hasTokens) {
        logger.info('Microsoft tokens found, auto-initializing service...', { userId });
        try {
          const initResult = await microsoftService.initialize(userId);
          if (initResult.success && initResult.connected) {
            logger.info('✅ Microsoft service auto-initialized successfully');
            return {
              success: true,
              connected: true,
              source: 'auto-init',
              account: microsoftSettings?.account
            };
          } else {
            logger.warn('Microsoft auto-initialization failed', initResult);
            return {
              success: true,
              connected: false,
              error: initResult.error || 'Initialization failed'
            };
          }
        } catch (initError) {
          logger.error('Microsoft auto-initialization error:', initError);
          return {
            success: true,
            connected: false,
            error: initError.message
          };
        }
      }

      // No tokens = never connected
      logger.info('Microsoft connection check: No tokens found');
      return {
        success: true,
        connected: false,
        source: 'no-tokens'
      };

    } catch (error) {
      logger.error('Microsoft connection check error:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  });

  /**
   * Authenticate with Microsoft
   */
  ipcMain.handle('microsoft:authenticate', async () => {
    logger.info('🔵 microsoft:authenticate IPC handler called');
    
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.error('No user authenticated', { 
          hasAuth: !!services.auth,
          hasCurrentUser: !!services.auth?.currentUser 
        });
        throw new Error('User not authenticated');
      }

      logger.info('Starting Microsoft OAuth flow', { userId });

      // Add timeout to prevent hanging indefinitely
      const authPromise = microsoftOAuthHandler.startAuthFlow();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Authentication timeout - please try again')), 120000); // 2 minute timeout
      });

      const authResult = await Promise.race([authPromise, timeoutPromise]);

      if (!authResult || !authResult.success) {
        throw new Error('Authentication failed');
      }

      // Save authentication status and tokens to Supabase
      const { data: currentUser } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const integrationSettings = currentUser?.integration_settings || {};
      
      // 🔥 CRITICAL: Get tokens from the Graph Service instance (MSAL stores them internally)
      const graphService = microsoftOAuthHandler.graphService;
      const accessToken = graphService.accessToken;
      const refreshToken = graphService.refreshToken || null; // MSAL may not expose refresh token
      
      // Preserve existing Microsoft settings and merge with new tokens
      const existingMicrosoft = integrationSettings.microsoft || {};
      integrationSettings.microsoft = {
        ...existingMicrosoft,
        authenticated: true,
        account: authResult.account?.username,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: authResult.expiresOn,
        connected_at: existingMicrosoft.connected_at || new Date().toISOString(),
        last_authenticated_at: new Date().toISOString(),
        expires_on: authResult.expiresOn
      };

      logger.info('💾 Saving Microsoft tokens to database', {
        userId,
        account: authResult.account?.username,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        expiresOn: authResult.expiresOn
      });

      const { error: updateError } = await services.dbAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // 🔥 Store the Graph Service instance with the authenticated session in shared instance
      const microsoftService = services.microsoft;
      microsoftService.graphService = microsoftOAuthHandler.graphService;
      microsoftService.isInitialized = true;

      logger.info('Microsoft authenticated successfully', {
        userId,
        account: authResult.account?.username
      });

      return {
        success: true,
        connected: true,
        account: authResult.account?.username
      };

    } catch (error) {
      logger.error('Microsoft authentication error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Create Microsoft calendar event
   */
  ipcMain.handle('microsoft:createEvent', async (_event, eventData) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // 🔥 Use shared service instance
      const microsoftService = services.microsoft;

      // Check if Graph Service is initialized
      if (!microsoftService.isInitialized || !microsoftService.graphService) {
        throw new Error('Microsoft not connected. Please authenticate first.');
      }

      // Use Graph Service directly
      const createdEvent = await microsoftService.graphService.createCalendarEvent(eventData);

      return {
        success: true,
        event: createdEvent,
        meetingLink: createdEvent.onlineMeeting?.joinUrl
      };

    } catch (error) {
      logger.error('Failed to create Microsoft event:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Send email via Outlook
   */
  ipcMain.handle('microsoft:sendEmail', async (_event, emailData) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // 🔥 Use shared service instance
      const microsoftService = services.microsoft;

      // Ensure service is initialized
      if (!microsoftService.isConnected()) {
        await microsoftService.initialize(userId);
      }

      const result = await microsoftService.sendEmail(emailData);

      return result;

    } catch (error) {
      logger.error('Failed to send email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get upcoming Microsoft calendar events
   */
  ipcMain.handle('microsoft:getUpcomingEvents', async (_event, options) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // 🔥 Use shared service instance
      const microsoftService = services.microsoft;

      // Check if Graph Service is initialized
      if (!microsoftService.isInitialized || !microsoftService.graphService) {
        throw new Error('Microsoft not connected. Please authenticate first.');
      }

      const { startDateTime, endDateTime } = options || {};

      // Use Graph Service directly
      const events = await microsoftService.graphService.getUpcomingEvents(
        startDateTime || new Date().toISOString(),
        endDateTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        50
      );

      logger.info('Fetched Microsoft calendar events', {
        userId,
        count: events.length
      });

      return {
        success: true,
        events: events || []
      };

    } catch (error) {
      logger.error('Failed to get events:', error);
      return {
        success: false,
        error: error.message,
        events: []
      };
    }
  });

  /**
   * Find available meeting times
   */
  ipcMain.handle('microsoft:findMeetingTimes', async (_event, attendees, durationMinutes, options) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // 🔥 Use shared service instance
      const microsoftService = services.microsoft;

      // Ensure service is initialized
      if (!microsoftService.isConnected()) {
        await microsoftService.initialize(userId);
      }

      const result = await microsoftService.findMeetingTimes(attendees, durationMinutes, options);

      return result;

    } catch (error) {
      logger.error('Failed to find meeting times:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Microsoft health check
   */
  ipcMain.handle('microsoft:healthCheck', async () => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        return {
          status: 'disconnected',
          microsoft: 'user not authenticated'
        };
      }

      // 🔥 Use shared service instance
      const microsoftService = services.microsoft;

      // Ensure service is initialized
      if (!microsoftService.isConnected()) {
        await microsoftService.initialize(userId);
      }

      const health = await microsoftService.healthCheck();

      return health;

    } catch (error) {
      logger.error('Microsoft health check error:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  });

  // ============================================
  // GOOGLE HANDLERS
  // ============================================

  /**
   * Check Google connection status
   */
  ipcMain.handle('google:checkConnection', async () => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        return {
          success: false,
          connected: false,
          error: 'User not authenticated'
        };
      }

      // Check if service is already initialized and ready to use
      const googleService = services.google;
      const serviceReady = googleService?.isInitialized && googleService?.gmailService;

      // If service is ready, it's connected! (Fast path)
      if (serviceReady) {
        logger.info('Google connection check: Service ready in memory');
        return {
          success: true,
          connected: true,
          source: 'memory'
        };
      }

      // Service not ready - check database for stored tokens
      const { data: userData, error: dbError } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      if (dbError) {
        logger.error('Failed to check Google connection in DB:', dbError);
        return {
          success: false,
          connected: false,
          error: dbError.message
        };
      }

      const googleSettings = userData?.integration_settings?.google;
      const hasTokens = googleSettings?.access_token && googleSettings?.authenticated === true;

      // If we have tokens but service isn't initialized, auto-initialize it!
      if (hasTokens) {
        logger.info('Google tokens found, auto-initializing service...', { userId });
        try {
          const initResult = await googleService.initialize(userId);
          if (initResult.success && initResult.connected) {
            logger.info('✅ Google service auto-initialized successfully');
            return {
              success: true,
              connected: true,
              source: 'auto-init',
              email: googleSettings?.email
            };
          } else {
            logger.warn('Google auto-initialization failed', initResult);
            return {
              success: true,
              connected: false,
              error: initResult.error || 'Initialization failed'
            };
          }
        } catch (initError) {
          logger.error('Google auto-initialization error:', initError);
          return {
            success: true,
            connected: false,
            error: initError.message
          };
        }
      }

      // No tokens = never connected
      logger.info('Google connection check: No tokens found');
      return {
        success: true,
        connected: false,
        source: 'no-tokens'
      };

    } catch (error) {
      logger.error('Google connection check error:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  });

  /**
   * Authenticate with Google
   */
  ipcMain.handle('google:authenticate', async () => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Starting Google OAuth flow', { userId });

      const authResult = await googleOAuthHandler.startAuthFlow();

      if (!authResult || !authResult.success) {
        throw new Error('Authentication failed');
      }

      // Save authentication status to Supabase (OAuth2Client handles tokens internally)
      const { data: currentUser } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const integrationSettings = currentUser?.integration_settings || {};
      
      // 🔥 CRITICAL: Get tokens from the Gmail Service instance (OAuth2Client stores them internally)
      const gmailService = googleOAuthHandler.gmailService;
      const accessToken = gmailService.accessToken;
      const refreshToken = gmailService.refreshToken;
      
      // Preserve existing Google settings and merge with new tokens
      const existingGoogle = integrationSettings.google || {};
      integrationSettings.google = {
        ...existingGoogle,
        authenticated: true,
        email: authResult.account?.email,
        name: authResult.account?.name,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: authResult.expiresOn,
        connected_at: existingGoogle.connected_at || new Date().toISOString(),
        last_authenticated_at: new Date().toISOString(),
        expires_on: authResult.expiresOn
      };

      logger.info('💾 Saving Google tokens to database', {
        userId,
        email: authResult.account?.email,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        expiresOn: authResult.expiresOn
      });

      const { error: updateError } = await services.dbAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // 🔥 Store the Gmail Service instance with the authenticated session in shared instance
      const googleService = services.google;
      googleService.gmailService = googleOAuthHandler.gmailService;
      googleService.isInitialized = true;

      logger.info('Google authenticated successfully', {
        userId,
        email: authResult.account?.email
      });

      return {
        success: true,
        connected: true,
        email: authResult.account?.email
      };

    } catch (error) {
      logger.error('Google authentication error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Create Google calendar event
   */
  ipcMain.handle('google:createEvent', async (_event, eventData) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // 🔥 Use shared service instance
      const googleService = services.google;

      // Check if Gmail Service is initialized
      if (!googleService.isInitialized || !googleService.gmailService) {
        throw new Error('Google not connected. Please authenticate first.');
      }

      // Use Gmail Service directly to create calendar event
      const createdEvent = await googleService.gmailService.createCalendarEvent(eventData);

      return {
        success: true,
        event: createdEvent,
        meetingLink: createdEvent.hangoutLink || createdEvent.htmlLink
      };

    } catch (error) {
      logger.error('Failed to create Google event:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Send email via Gmail
   */
  ipcMain.handle('google:sendEmail', async (_event, emailData) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // 🔥 Use shared service instance
      const googleService = services.google;

      // Ensure service is initialized
      if (!googleService.isConnected()) {
        await googleService.initialize(userId);
      }

      const result = await googleService.sendEmail(emailData);

      return result;

    } catch (error) {
      logger.error('Failed to send Gmail:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get upcoming Google calendar events
   */
  ipcMain.handle('google:getUpcomingEvents', async (_event, options) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // 🔥 Use shared service instance
      const googleService = services.google;

      // Check if Gmail Service is initialized
      if (!googleService.isInitialized || !googleService.gmailService) {
        throw new Error('Google not connected. Please authenticate first.');
      }

      const { timeMin, timeMax } = options || {};

      // Use Gmail Service directly
      const events = await googleService.gmailService.getUpcomingEvents(
        timeMin || new Date().toISOString(),
        timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        50
      );

      logger.info('Fetched Google calendar events', {
        userId,
        count: events.length
      });

      return {
        success: true,
        events: events || []
      };

    } catch (error) {
      logger.error('Failed to get Google events:', error);
      return {
        success: false,
        error: error.message,
        events: []
      };
    }
  });

  /**
   * Google health check
   */
  ipcMain.handle('google:healthCheck', async () => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        return {
          status: 'disconnected',
          google: 'user not authenticated'
        };
      }

      // 🔥 Use shared service instance
      const googleService = services.google;

      // Ensure service is initialized
      if (!googleService.isConnected()) {
        await googleService.initialize(userId);
      }

      const health = await googleService.healthCheck();

      return health;

    } catch (error) {
      logger.error('Google health check error:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  });

  // ============================================
  // EMAIL HANDLERS (UNIFIED INBOX)
  // ============================================

  /**
   * Get unified inbox (emails from Gmail, Outlook, and optionally Slack/Teams)
   */
  ipcMain.handle('inbox:getUnified', async (_event, options = {}) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const {
        maxResults = 50,
        includeSources = ['gmail', 'outlook'] // Can add 'slack', 'teams' later
      } = options;

      logger.info('Fetching unified inbox', { userId, includeSources, maxResults });

      const allEmails = [];

      // Fetch from Gmail if connected and included
      if (includeSources.includes('gmail') && services.google?.isConnected()) {
        try {
          const gmailResult = await services.google.getUnreadEmails(maxResults);
          if (gmailResult.success && gmailResult.emails) {
            // Tag each email with source
            const taggedEmails = gmailResult.emails.map(email => ({
              ...email,
              source: 'gmail'
            }));
            allEmails.push(...taggedEmails);
            logger.info('Gmail emails added to unified inbox', { count: gmailResult.emails.length });
          }
        } catch (error) {
          logger.error('Failed to fetch Gmail emails for unified inbox', { error: error.message });
        }
      }

      // Fetch from Outlook if connected and included
      if (includeSources.includes('outlook') && services.microsoft?.isConnected()) {
        try {
          const outlookResult = await services.microsoft.getEmails('inbox', maxResults);
          if (outlookResult.success && outlookResult.emails) {
            // Tag each email with source
            const taggedEmails = outlookResult.emails.map(email => ({
              ...email,
              source: 'outlook'
            }));
            allEmails.push(...taggedEmails);
            logger.info('Outlook emails added to unified inbox', { count: outlookResult.emails.length });
          }
        } catch (error) {
          logger.error('Failed to fetch Outlook emails for unified inbox', { error: error.message });
        }
      }

      // TODO: Add Slack channels if included
      // TODO: Add Teams channels if included

      // Sort all emails by date (most recent first)
      allEmails.sort((a, b) => {
        const dateA = a.date || a.receivedDateTime || new Date(0);
        const dateB = b.date || b.receivedDateTime || new Date(0);
        return new Date(dateB) - new Date(dateA);
      });

      // Limit to maxResults
      const limitedEmails = allEmails.slice(0, maxResults);

      logger.info('Unified inbox fetched', {
        userId,
        totalEmails: limitedEmails.length,
        sources: includeSources
      });

      return {
        success: true,
        emails: limitedEmails,
        count: limitedEmails.length
      };

    } catch (error) {
      logger.error('Failed to get unified inbox', { error: error.message });
      return {
        success: false,
        error: error.message,
        emails: []
      };
    }
  });

  /**
   * Get Gmail emails
   */
  ipcMain.handle('google:getEmails', async (_event, options = {}) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const googleService = services.google;

      if (!googleService || !googleService.isConnected()) {
        throw new Error('Google not connected');
      }

      const result = await googleService.getEmails(options);

      logger.info('Gmail emails fetched', {
        userId,
        count: result.emails?.length || 0
      });

      return result;

    } catch (error) {
      logger.error('Failed to get Gmail emails', { error: error.message });
      return {
        success: false,
        error: error.message,
        emails: []
      };
    }
  });

  /**
   * Get Gmail unread emails
   */
  ipcMain.handle('google:getUnreadEmails', async (_event, maxResults = 50) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const googleService = services.google;

      if (!googleService || !googleService.isConnected()) {
        throw new Error('Google not connected');
      }

      const result = await googleService.getUnreadEmails(maxResults);

      logger.info('Gmail unread emails fetched', {
        userId,
        count: result.emails?.length || 0
      });

      return result;

    } catch (error) {
      logger.error('Failed to get Gmail unread emails', { error: error.message });
      return {
        success: false,
        error: error.message,
        emails: []
      };
    }
  });

  /**
   * Get Gmail email thread
   */
  ipcMain.handle('google:getEmailThread', async (_event, threadId) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const googleService = services.google;

      if (!googleService || !googleService.isConnected()) {
        throw new Error('Google not connected');
      }

      const result = await googleService.getEmailThread(threadId);

      logger.info('Gmail thread fetched', {
        userId,
        threadId,
        messageCount: result.thread?.messageCount || 0
      });

      return result;

    } catch (error) {
      logger.error('Failed to get Gmail thread', { threadId, error: error.message });
      return {
        success: false,
        error: error.message,
        thread: null
      };
    }
  });

  /**
   * Mark Gmail email as read
   */
  ipcMain.handle('google:markEmailAsRead', async (_event, messageId) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const googleService = services.google;

      if (!googleService || !googleService.isConnected()) {
        throw new Error('Google not connected');
      }

      const result = await googleService.markEmailAsRead(messageId);

      logger.info('Gmail email marked as read', { userId, messageId });

      return result;

    } catch (error) {
      logger.error('Failed to mark Gmail email as read', { messageId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get Outlook emails
   */
  ipcMain.handle('microsoft:getEmails', async (_event, folderId = 'inbox', maxResults = 50) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const microsoftService = services.microsoft;

      if (!microsoftService || !microsoftService.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      const result = await microsoftService.getEmails(folderId, maxResults);

      logger.info('Outlook emails fetched', {
        userId,
        folderId,
        count: result.emails?.length || 0
      });

      return result;

    } catch (error) {
      logger.error('Failed to get Outlook emails', { error: error.message });
      return {
        success: false,
        error: error.message,
        emails: []
      };
    }
  });

  /**
   * Get Outlook unread emails
   */
  ipcMain.handle('microsoft:getUnreadEmails', async (_event, maxResults = 50) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const microsoftService = services.microsoft;

      if (!microsoftService || !microsoftService.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      const result = await microsoftService.getUnreadEmails(maxResults);

      logger.info('Outlook unread emails fetched', {
        userId,
        count: result.emails?.length || 0
      });

      return result;

    } catch (error) {
      logger.error('Failed to get Outlook unread emails', { error: error.message });
      return {
        success: false,
        error: error.message,
        emails: []
      };
    }
  });

  /**
   * Mark Outlook email as read
   */
  ipcMain.handle('microsoft:markEmailAsRead', async (_event, messageId) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const microsoftService = services.microsoft;

      if (!microsoftService || !microsoftService.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      const result = await microsoftService.markEmailAsRead(messageId);

      logger.info('Outlook email marked as read', { userId, messageId });

      return result;

    } catch (error) {
      logger.error('Failed to mark Outlook email as read', { messageId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('Mission Control handlers registered');
}

module.exports = registerMissionControlHandlers;

