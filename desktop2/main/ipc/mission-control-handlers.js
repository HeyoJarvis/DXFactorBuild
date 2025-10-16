/**
 * Mission Control IPC Handlers
 * Handles calendar and email integration for Microsoft and Google
 */

const { ipcMain, shell } = require('electron');
const MicrosoftService = require('../services/MicrosoftService');
const GoogleService = require('../services/GoogleService');
const MicrosoftOAuthHandler = require('../../../oauth/microsoft-oauth-handler');
const GoogleOAuthHandler = require('../../../oauth/google-oauth-handler');

let microsoftService = null;
let googleService = null;
let microsoftOAuthHandler = null;
let googleOAuthHandler = null;

function registerMissionControlHandlers(services, logger) {
  // Initialize services
  microsoftService = new MicrosoftService({
    logger,
    supabaseAdapter: services.dbAdapter
  });

  googleService = new GoogleService({
    logger,
    supabaseAdapter: services.dbAdapter
  });

  // Initialize OAuth handlers for authentication
  microsoftOAuthHandler = new MicrosoftOAuthHandler({
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:8890/auth/microsoft/callback',
    logger
  });

  googleOAuthHandler = new GoogleOAuthHandler({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8890/auth/google/callback',
    logger
  });

  // ============================================
  // MICROSOFT HANDLERS
  // ============================================

  /**
   * Check Microsoft connection status
   */
  ipcMain.handle('microsoft:checkConnection', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        return {
          success: false,
          connected: false,
          error: 'User not authenticated'
        };
      }

      // Check if Graph Service is initialized
      const connected = microsoftService.isInitialized && microsoftService.graphService;

      return {
        success: true,
        connected: connected || false
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
  ipcMain.handle('microsoft:authenticate', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Starting Microsoft OAuth flow', { userId });

      const authResult = await microsoftOAuthHandler.startAuthFlow();

      if (!authResult || !authResult.success) {
        throw new Error('Authentication failed');
      }

      // Save authentication status to Supabase (MSAL handles tokens internally)
      const { data: currentUser } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const integrationSettings = currentUser?.integration_settings || {};
      integrationSettings.microsoft = {
        authenticated: true,
        account: authResult.account?.username,
        connected_at: new Date().toISOString(),
        expires_on: authResult.expiresOn
      };

      const { error: updateError } = await services.dbAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Store the Graph Service instance with the authenticated session
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
  ipcMain.handle('microsoft:createEvent', async (event, eventData) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

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
  ipcMain.handle('microsoft:sendEmail', async (event, emailData) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

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
  ipcMain.handle('microsoft:getUpcomingEvents', async (event, options) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

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
  ipcMain.handle('microsoft:findMeetingTimes', async (event, attendees, durationMinutes, options) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

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
  ipcMain.handle('microsoft:healthCheck', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        return {
          status: 'disconnected',
          microsoft: 'user not authenticated'
        };
      }

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
  ipcMain.handle('google:checkConnection', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        return {
          success: false,
          connected: false,
          error: 'User not authenticated'
        };
      }

      // Check if Gmail Service is initialized
      const connected = googleService.isInitialized && googleService.gmailService;

      return {
        success: true,
        connected: connected || false
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
  ipcMain.handle('google:authenticate', async (event) => {
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
      integrationSettings.google = {
        authenticated: true,
        email: authResult.account?.email,
        name: authResult.account?.name,
        connected_at: new Date().toISOString(),
        expires_on: authResult.expiresOn
      };

      const { error: updateError } = await services.dbAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Store the Gmail Service instance with the authenticated session
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
  ipcMain.handle('google:createEvent', async (event, eventData) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

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
  ipcMain.handle('google:sendEmail', async (event, emailData) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

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
  ipcMain.handle('google:getUpcomingEvents', async (event, options) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

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
  ipcMain.handle('google:healthCheck', async (event) => {
    try {
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        return {
          status: 'disconnected',
          google: 'user not authenticated'
        };
      }

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

  logger.info('Mission Control handlers registered');
}

module.exports = registerMissionControlHandlers;

