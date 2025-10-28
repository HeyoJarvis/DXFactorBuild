/**
 * Microsoft 365 Service for Desktop2
 * Manages Microsoft Graph API integration for calendar and email
 */

const MicrosoftOAuthHandler = require('../../../oauth/microsoft-oauth-handler');
const MicrosoftGraphService = require('../../../core/integrations/microsoft-graph-service');
const EventEmitter = require('events');

class MicrosoftService extends EventEmitter {
  constructor({ logger, supabaseAdapter }) {
    super();
    
    this.logger = logger;
    this.supabaseAdapter = supabaseAdapter;
    this.oauthHandler = null;
    this.graphService = null;  // This will be set by the OAuth handler after authentication
    this.isInitialized = false;
    
    this.logger.info('Microsoft Service initialized (desktop2)');
  }

  /**
   * Check if service is connected and ready
   */
  isConnected() {
    return this.isInitialized && this.graphService !== null;
  }

  /**
   * Initialize Microsoft service with user tokens
   */
  async initialize(userId) {
    try {
      this.logger.info('Initializing Microsoft service', { userId });

      // Get user's Microsoft tokens from Supabase
      const { data: userData, error: userError } = await this.supabaseAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('Failed to get user data');
      }

      const microsoftTokens = userData.integration_settings?.microsoft;
      
      if (!microsoftTokens || !microsoftTokens.access_token) {
        this.logger.warn('Microsoft not connected for user', { userId });
        return {
          success: false,
          connected: false,
          error: 'Microsoft not connected'
        };
      }

      // Initialize OAuth handler
      this.oauthHandler = new MicrosoftOAuthHandler({
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI,
        logger: this.logger
      });

      // Set existing tokens
      this.oauthHandler.accessToken = microsoftTokens.access_token;
      this.oauthHandler.refreshToken = microsoftTokens.refresh_token;
      this.oauthHandler.tokenExpiry = microsoftTokens.token_expiry ? new Date(microsoftTokens.token_expiry).getTime() : null;

      // Initialize Graph service with existing tokens
      this.graphService = new MicrosoftGraphService({
        accessToken: microsoftTokens.access_token,
        tokenExpiry: microsoftTokens.token_expiry,
        logger: this.logger
      });

      // Note: MicrosoftOAuthHandler doesn't extend EventEmitter, so we don't set up event listeners
      // Token refresh is handled internally by MSAL (Microsoft Authentication Library)

      this.isInitialized = true;
      this.logger.info('Microsoft service initialized successfully', { userId });

      return {
        success: true,
        connected: true
      };

    } catch (error) {
      this.logger.error('Failed to initialize Microsoft service', {
        userId,
        error: error.message
      });
      
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Disconnect and clear Microsoft service
   */
  disconnect() {
    this.logger.info('Disconnecting Microsoft service');
    
    // Clear all service state
    this.graphService = null;
    this.oauthHandler = null;
    this.isInitialized = false;
    
    this.logger.info('Microsoft service disconnected');
  }

  /**
   * Save tokens to Supabase
   */
  async saveTokens(userId, tokens) {
    try {
      const { data: currentUser } = await this.supabaseAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const integrationSettings = currentUser?.integration_settings || {};
      integrationSettings.microsoft = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.token_expiry ? new Date(tokens.token_expiry).toISOString() : null
      };

      const { error } = await this.supabaseAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      if (error) throw error;

      this.logger.info('Microsoft tokens saved', { userId });
      return { success: true };

    } catch (error) {
      this.logger.error('Failed to save Microsoft tokens', {
        userId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if Microsoft is connected
   */
  isConnected() {
    return this.isInitialized && this.graphService && this.graphService.accessToken;
  }

  /**
   * Create calendar event
   */
  async createCalendarEvent(eventData) {
    try {
      if (!this.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      this.logger.info('Creating calendar event', {
        subject: eventData.subject,
        startTime: eventData.startTime
      });

      const result = await this.graphService.createCalendarEvent(eventData);

      this.logger.info('Calendar event created', {
        eventId: result.event?.id,
        subject: result.event?.subject
      });

      return {
        success: true,
        event: result.event,
        meetingLink: result.event?.onlineMeeting?.joinUrl
      };

    } catch (error) {
      this.logger.error('Failed to create calendar event', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email
   */
  async sendEmail(emailData) {
    try {
      if (!this.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      this.logger.info('Sending email', {
        subject: emailData.subject,
        to: emailData.to
      });

      const result = await this.graphService.sendEmail(emailData);

      this.logger.info('Email sent successfully');

      return {
        success: true,
        result
      };

    } catch (error) {
      this.logger.error('Failed to send email', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(options = {}) {
    try {
      if (!this.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      const {
        startDateTime = new Date().toISOString(),
        endDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        top = 50
      } = options;

      this.logger.info('Fetching upcoming events', { startDateTime, endDateTime });

      const events = await this.graphService.getUpcomingEvents(startDateTime, endDateTime, top);

      this.logger.info('Events fetched', { count: events.length });

      return {
        success: true,
        events
      };

    } catch (error) {
      this.logger.error('Failed to fetch events', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        events: []
      };
    }
  }

  /**
   * Find available meeting times
   */
  async findMeetingTimes(attendees, durationMinutes, options = {}) {
    try {
      if (!this.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      this.logger.info('Finding meeting times', { attendees, durationMinutes });

      const result = await this.graphService.findMeetingTimes(attendees, durationMinutes, options);

      this.logger.info('Meeting times found', {
        suggestions: result.suggestions?.length || 0
      });

      return {
        success: true,
        suggestions: result.suggestions
      };

    } catch (error) {
      this.logger.error('Failed to find meeting times', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get unread emails
   */
  async getUnreadEmails(maxResults = 50) {
    try {
      if (!this.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      this.logger.info('Fetching unread emails', { maxResults });

      const emails = await this.graphService.getUnreadEmails('inbox', maxResults);

      this.logger.info('Unread emails fetched', { count: emails.length });

      return {
        success: true,
        emails
      };

    } catch (error) {
      this.logger.error('Failed to fetch unread emails', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        emails: []
      };
    }
  }

  /**
   * Get emails from a folder (all emails, not just unread)
   */
  async getEmails(folderId = 'inbox', maxResults = 50) {
    try {
      if (!this.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      this.logger.info('Fetching all emails', { folderId, maxResults });

      const emails = await this.graphService.getEmails(folderId, maxResults);

      this.logger.info('All emails fetched', { count: emails.length });

      return {
        success: true,
        emails
      };

    } catch (error) {
      this.logger.error('Failed to fetch emails', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        emails: []
      };
    }
  }

  /**
   * Mark email as read
   */
  async markEmailAsRead(messageId) {
    try {
      if (!this.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      await this.graphService.markEmailAsRead(messageId);

      this.logger.info('Email marked as read', { messageId });

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('Failed to mark email as read', {
        messageId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send an email
   */
  async sendEmail(emailData) {
    try {
      if (!this.isConnected()) {
        throw new Error('Microsoft not connected');
      }

      const result = await this.graphService.sendEmail(emailData);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('Failed to send email', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected()) {
        return {
          status: 'disconnected',
          microsoft: 'not connected'
        };
      }

      const profile = await this.graphService.getUserProfile();

      return {
        status: 'healthy',
        microsoft: 'connected',
        user: profile.displayName
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = MicrosoftService;

