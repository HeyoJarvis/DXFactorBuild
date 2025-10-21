/**
 * Google Workspace Service for Desktop2
 * Manages Google OAuth and Calendar/Gmail integration
 */

const GoogleOAuthHandler = require('../../../oauth/google-oauth-handler');
const GoogleGmailService = require('../../../core/integrations/google-gmail-service');
const EventEmitter = require('events');

class GoogleService extends EventEmitter {
  constructor({ logger, supabaseAdapter }) {
    super();
    
    this.logger = logger;
    this.supabaseAdapter = supabaseAdapter;
    this.oauthHandler = null;
    this.gmailService = null;  // This will be set by the OAuth handler after authentication
    this.isInitialized = false;
    
    this.logger.info('Google Service initialized (desktop2)');
  }

  /**
   * Check if service is connected and ready
   */
  isConnected() {
    return this.isInitialized && this.gmailService !== null;
  }

  /**
   * Initialize Google service with user tokens
   */
  async initialize(userId) {
    try {
      this.logger.info('Initializing Google service', { userId });

      // Get user's Google tokens from Supabase
      const { data: userData, error: userError} = await this.supabaseAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('Failed to get user data');
      }

      const googleTokens = userData.integration_settings?.google;
      
      if (!googleTokens || !googleTokens.access_token) {
        this.logger.warn('Google not connected for user', { userId });
        return {
          success: false,
          connected: false,
          error: 'Google not connected'
        };
      }

      // Initialize OAuth handler
      this.oauthHandler = new GoogleOAuthHandler({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
        port: 8893, // Google uses port 8893
        logger: this.logger
      });

      // Set existing tokens
      this.oauthHandler.accessToken = googleTokens.access_token;
      this.oauthHandler.refreshToken = googleTokens.refresh_token;
      this.oauthHandler.tokenExpiry = googleTokens.token_expiry ? new Date(googleTokens.token_expiry).getTime() : null;

      // Initialize Gmail service with existing tokens
      this.gmailService = new GoogleGmailService({
        accessToken: googleTokens.access_token,
        refreshToken: googleTokens.refresh_token,
        tokenExpiry: googleTokens.token_expiry,
        logger: this.logger
      });

      // Note: GoogleOAuthHandler doesn't extend EventEmitter, so we don't set up event listeners
      // Token refresh is handled internally by GoogleGmailService

      this.isInitialized = true;
      this.logger.info('Google service initialized successfully', { userId });

      return {
        success: true,
        connected: true
      };

    } catch (error) {
      this.logger.error('Failed to initialize Google service', {
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
      integrationSettings.google = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.token_expiry ? new Date(tokens.token_expiry).toISOString() : null
      };

      const { error } = await this.supabaseAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      if (error) throw error;

      this.logger.info('Google tokens saved', { userId });
      return { success: true };

    } catch (error) {
      this.logger.error('Failed to save Google tokens', {
        userId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if Google is connected
   */
  isConnected() {
    return this.isInitialized && this.gmailService && this.gmailService.accessToken;
  }

  /**
   * Create calendar event
   */
  async createCalendarEvent(eventData) {
    try {
      if (!this.isConnected()) {
        throw new Error('Google not connected');
      }

      this.logger.info('Creating Google Calendar event', {
        summary: eventData.subject || eventData.summary,
        startTime: eventData.startTime || eventData.start
      });

      // Transform to Google Calendar format
      const googleEvent = {
        summary: eventData.subject || eventData.summary,
        description: eventData.body || eventData.description,
        start: {
          dateTime: eventData.startTime || eventData.start,
          timeZone: eventData.timeZone || 'America/Denver'
        },
        end: {
          dateTime: eventData.endTime || eventData.end,
          timeZone: eventData.timeZone || 'America/Denver'
        },
        attendees: (eventData.attendees || []).map(email => 
          typeof email === 'string' ? { email } : email
        ),
        conferenceData: eventData.isOnlineMeeting ? {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        } : undefined
      };

      const result = await this.gmailService.createCalendarEvent(googleEvent);

      this.logger.info('Google Calendar event created', {
        eventId: result.id,
        summary: result.summary
      });

      return {
        success: true,
        event: result,
        meetingLink: result.hangoutLink || result.conferenceData?.entryPoints?.[0]?.uri
      };

    } catch (error) {
      this.logger.error('Failed to create Google Calendar event', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email via Gmail
   */
  async sendEmail(emailData) {
    try {
      if (!this.isConnected()) {
        throw new Error('Google not connected');
      }

      this.logger.info('Sending Gmail', {
        subject: emailData.subject,
        to: emailData.to
      });

      const result = await this.gmailService.sendEmail(emailData);

      this.logger.info('Gmail sent successfully', { messageId: result.id });

      return {
        success: true,
        result
      };

    } catch (error) {
      this.logger.error('Failed to send Gmail', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get upcoming calendar events
   */
  async getUpcomingEvents(options = {}) {
    try {
      if (!this.isConnected()) {
        throw new Error('Google not connected');
      }

      const {
        timeMin = new Date().toISOString(),
        timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        maxResults = 50
      } = options;

      this.logger.info('Fetching Google Calendar events', { timeMin, timeMax });

      const events = await this.gmailService.getUpcomingEvents(timeMin, timeMax, maxResults);

      this.logger.info('Google Calendar events fetched', { count: events.length });

      return {
        success: true,
        events
      };

    } catch (error) {
      this.logger.error('Failed to fetch Google Calendar events', {
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
   * Get unread emails
   */
  async getUnreadEmails(maxResults = 50) {
    try {
      if (!this.isConnected()) {
        throw new Error('Google not connected');
      }

      this.logger.info('Fetching unread emails', { maxResults });

      const emails = await this.gmailService.getUnreadEmails(maxResults);

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
   * Get emails with optional query
   */
  async getEmails(options = {}) {
    try {
      if (!this.isConnected()) {
        throw new Error('Google not connected');
      }

      this.logger.info('Fetching emails', options);

      const result = await this.gmailService.getEmails(options);

      this.logger.info('Emails fetched', { count: result.emails.length });

      return {
        success: true,
        ...result
      };

    } catch (error) {
      this.logger.error('Failed to fetch emails', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        emails: [],
        nextPageToken: null
      };
    }
  }

  /**
   * Get email thread
   */
  async getEmailThread(threadId) {
    try {
      if (!this.isConnected()) {
        throw new Error('Google not connected');
      }

      this.logger.info('Fetching email thread', { threadId });

      const thread = await this.gmailService.getEmailThread(threadId);

      this.logger.info('Email thread fetched', {
        threadId,
        messageCount: thread.messageCount
      });

      return {
        success: true,
        thread
      };

    } catch (error) {
      this.logger.error('Failed to fetch email thread', {
        threadId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        thread: null
      };
    }
  }

  /**
   * Mark email as read
   */
  async markEmailAsRead(messageId) {
    try {
      if (!this.isConnected()) {
        throw new Error('Google not connected');
      }

      await this.gmailService.markEmailAsRead(messageId);

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
        throw new Error('Google not connected');
      }

      const result = await this.gmailService.sendEmail(emailData);

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
          google: 'not connected'
        };
      }

      const profile = await this.gmailService.getUserProfile();

      return {
        status: 'healthy',
        google: 'connected',
        user: profile.emailAddress
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = GoogleService;

