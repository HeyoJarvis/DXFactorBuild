/**
 * Google Gmail API Service
 * 
 * Integrates with Google Workspace services:
 * - Gmail (email automation)
 * - Google Calendar (meeting scheduling)
 * - Google Meet (online meetings)
 * 
 * Features:
 * 1. OAuth 2.0 authentication with Google
 * 2. Auto-create calendar events from workflows
 * 3. Send emails based on task assignments
 * 4. Intelligent scheduling with availability checks
 * 5. Auto-create Google Meet links for meetings
 */

const { google } = require('googleapis');
const winston = require('winston');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class GoogleGmailService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      clientId: options.clientId || process.env.GOOGLE_CLIENT_ID,
      clientSecret: options.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: options.redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8890/auth/google/callback',
      scopes: options.scopes || [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      logLevel: options.logLevel || 'info',
      ...options
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/google-gmail.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'google-gmail-service' }
    });

    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      this.options.clientId,
      this.options.clientSecret,
      this.options.redirectUri
    );

    this.gmail = null;
    this.calendar = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;

    this.logger.info('Google Gmail Service initialized', {
      redirectUri: this.options.redirectUri,
      scopes: this.options.scopes.length
    });
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl(state = null) {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: this.options.scopes,
      state: state || Date.now().toString(),
      prompt: 'consent' // Force consent screen to get refresh token
    });

    this.logger.info('Generated auth URL', {
      state,
      scopes: this.options.scopes.length
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async authenticateWithCode(code) {
    try {
      this.logger.info('Exchanging authorization code for tokens');

      const { tokens } = await this.oauth2Client.getToken(code);
      
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;
      this.tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

      // Set credentials
      this.oauth2Client.setCredentials(tokens);

      // Initialize API clients
      this._initializeApiClients();

      // Get user info
      const userInfo = await this._getUserInfo();

      this.logger.info('Successfully authenticated with Google', {
        email: userInfo.email,
        expiresOn: this.tokenExpiry
      });

      this.emit('authenticated', {
        email: userInfo.email,
        expiresOn: this.tokenExpiry
      });

      return {
        success: true,
        account: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        },
        expiresOn: this.tokenExpiry
      };
    } catch (error) {
      this.logger.error('Authentication failed', {
        error: error.message,
        errorCode: error.code
      });

      throw new Error(`Google authentication failed: ${error.message}`);
    }
  }

  /**
   * Initialize Gmail and Calendar API clients
   */
  _initializeApiClients() {
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    this.logger.info('API clients initialized');
  }

  /**
   * Get user info from Google
   */
  async _getUserInfo() {
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();
      return data;
    } catch (error) {
      this.logger.error('Failed to get user info', { error: error.message });
      return { email: 'unknown', name: 'Unknown User' };
    }
  }

  /**
   * Ensure we have a valid access token
   */
  async _ensureAuthenticated() {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    // Check if token is expired and refresh if needed
    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      if (this.refreshToken) {
        try {
          this.logger.info('Token expired, refreshing...');
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          this.oauth2Client.setCredentials(credentials);
          this.accessToken = credentials.access_token;
          this.tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
          this.logger.info('Token refreshed successfully');
        } catch (error) {
          this.logger.error('Token refresh failed', { error: error.message });
          throw new Error('Token expired and refresh failed. Please re-authenticate.');
        }
      } else {
        throw new Error('Token expired and no refresh token available. Please re-authenticate.');
      }
    }
  }

  // ===== CALENDAR METHODS =====

  /**
   * Create a calendar event
   * @param {Object} eventData - Event details
   * @returns {Promise<Object>} Created event
   */
  async createCalendarEvent(eventData) {
    try {
      await this._ensureAuthenticated();

      // Create Google Meet link if requested
      const conferenceData = eventData.isOnlineMeeting !== false ? {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      } : undefined;

      const event = {
        summary: eventData.subject || eventData.title,
        description: eventData.body || eventData.description || '',
        start: {
          dateTime: eventData.startTime,
          timeZone: eventData.timeZone || 'America/Denver'
        },
        end: {
          dateTime: eventData.endTime,
          timeZone: eventData.timeZone || 'America/Denver'
        },
        location: eventData.location,
        attendees: (eventData.attendees || []).map(attendee => {
          const email = typeof attendee === 'string' ? attendee : (attendee.email || attendee.address);
          if (!email || typeof email !== 'string') {
            this.logger.warn('Invalid attendee format', { attendee });
            return null;
          }
          return { email };
        }).filter(Boolean),
        conferenceData: conferenceData,
        reminders: {
          useDefault: true
        }
      };

      const result = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: conferenceData ? 1 : 0,
        sendUpdates: 'all' // Send email invitations to attendees
      });

      const meetingLink = result.data.hangoutLink || result.data.htmlLink;

      this.logger.info('Calendar event created', {
        event_id: result.data.id,
        summary: result.data.summary,
        start: result.data.start.dateTime,
        has_online_meeting: !!result.data.hangoutLink,
        meeting_link: meetingLink
      });

      this.emit('calendar_event_created', {
        eventId: result.data.id,
        summary: result.data.summary,
        attendees: eventData.attendees,
        meetingLink: meetingLink
      });

      return {
        success: true,
        event: result.data,
        meetingLink: meetingLink
      };
    } catch (error) {
      this.logger.error('Failed to create calendar event', {
        error: error.message,
        eventData
      });

      throw error;
    }
  }

  /**
   * Get upcoming calendar events
   */
  async getUpcomingEvents(startDateTime, endDateTime, maxResults = 50) {
    try {
      await this._ensureAuthenticated();

      this.logger.info('Fetching upcoming calendar events', {
        startDateTime,
        endDateTime,
        maxResults
      });

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDateTime,
        timeMax: endDateTime,
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: 'America/Denver' // Request times in Mountain Time
      });

      this.logger.info('Calendar events fetched', {
        count: response.data.items?.length || 0
      });

      return response.data.items || [];

    } catch (error) {
      this.logger.error('Failed to get calendar events', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get user's calendar availability
   */
  async getAvailability(calendarIds, startTime, endTime) {
    try {
      await this._ensureAuthenticated();

      const timeMin = new Date(startTime).toISOString();
      const timeMax = new Date(endTime).toISOString();

      const result = await this.calendar.freebusy.query({
        resource: {
          timeMin,
          timeMax,
          items: calendarIds.map(id => ({ id }))
        }
      });

      this.logger.info('Retrieved availability', {
        calendars: calendarIds.length,
        timeRange: `${timeMin} - ${timeMax}`
      });

      return {
        success: true,
        calendars: result.data.calendars
      };
    } catch (error) {
      this.logger.error('Failed to get availability', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Find available meeting times
   */
  async findMeetingTimes(attendees, durationMinutes = 60, options = {}) {
    try {
      await this._ensureAuthenticated();

      const timeMin = new Date(options.startTime || Date.now()).toISOString();
      const timeMax = new Date(options.endTime || Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get free/busy info for attendees
      const result = await this.calendar.freebusy.query({
        resource: {
          timeMin,
          timeMax,
          items: [{ id: 'primary' }] // Only check organizer's calendar
        }
      });

      // Simple algorithm: find gaps in busy times
      const busyTimes = result.data.calendars.primary?.busy || [];
      const suggestions = this._findTimeGaps(busyTimes, timeMin, timeMax, durationMinutes);

      this.logger.info('Found meeting times', {
        candidates: suggestions.length,
        duration: durationMinutes
      });

      return {
        success: true,
        suggestions: suggestions.slice(0, options.maxCandidates || 10)
      };
    } catch (error) {
      this.logger.error('Failed to find meeting times', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Helper to find time gaps between busy periods
   */
  _findTimeGaps(busyTimes, timeMin, timeMax, durationMinutes) {
    const suggestions = [];
    const minDuration = durationMinutes * 60 * 1000; // Convert to milliseconds
    
    let currentTime = new Date(timeMin);
    const endTime = new Date(timeMax);

    // Sort busy times
    busyTimes.sort((a, b) => new Date(a.start) - new Date(b.start));

    for (const busy of busyTimes) {
      const busyStart = new Date(busy.start);
      
      // Check if there's a gap before this busy period
      if (busyStart - currentTime >= minDuration) {
        suggestions.push({
          start: currentTime.toISOString(),
          end: new Date(currentTime.getTime() + minDuration).toISOString()
        });
      }

      currentTime = new Date(Math.max(currentTime, new Date(busy.end)));
    }

    // Check for time after last busy period
    if (endTime - currentTime >= minDuration) {
      suggestions.push({
        start: currentTime.toISOString(),
        end: new Date(currentTime.getTime() + minDuration).toISOString()
      });
    }

    return suggestions;
  }

  // ===== EMAIL METHODS =====

  /**
   * Send an email via Gmail
   */
  async sendEmail(emailData) {
    try {
      await this._ensureAuthenticated();

      // Create email message
      const message = this._createEmailMessage(emailData);
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = await this.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: encodedMessage
        }
      });

      this.logger.info('Email sent', {
        message_id: result.data.id,
        subject: emailData.subject,
        recipients: emailData.to?.length || 0
      });

      this.emit('email_sent', {
        messageId: result.data.id,
        subject: emailData.subject,
        to: emailData.to
      });

      return { 
        success: true,
        messageId: result.data.id
      };
    } catch (error) {
      this.logger.error('Failed to send email', {
        error: error.message,
        subject: emailData.subject
      });

      throw error;
    }
  }

  /**
   * Create RFC 2822 formatted email message
   */
  _createEmailMessage(emailData) {
    const lines = [];
    
    // Headers
    lines.push(`To: ${(emailData.to || []).join(', ')}`);
    if (emailData.cc && emailData.cc.length > 0) {
      lines.push(`Cc: ${emailData.cc.join(', ')}`);
    }
    if (emailData.bcc && emailData.bcc.length > 0) {
      lines.push(`Bcc: ${emailData.bcc.join(', ')}`);
    }
    lines.push(`Subject: ${emailData.subject}`);
    
    // Content type
    const contentType = emailData.isHtml ? 'text/html' : 'text/plain';
    lines.push(`Content-Type: ${contentType}; charset=utf-8`);
    lines.push('');
    
    // Body
    lines.push(emailData.body);
    
    return lines.join('\r\n');
  }

  /**
   * Create draft email
   */
  async createDraftEmail(emailData) {
    try {
      await this._ensureAuthenticated();

      const message = this._createEmailMessage(emailData);
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = await this.gmail.users.drafts.create({
        userId: 'me',
        resource: {
          message: {
            raw: encodedMessage
          }
        }
      });

      this.logger.info('Draft email created', {
        draft_id: result.data.id,
        subject: emailData.subject
      });

      return {
        success: true,
        draft: result.data
      };
    } catch (error) {
      this.logger.error('Failed to create draft', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile() {
    try {
      await this._ensureAuthenticated();

      const profile = await this.gmail.users.getProfile({
        userId: 'me'
      });

      const userInfo = await this._getUserInfo();

      this.logger.info('Retrieved user profile', {
        email: profile.data.emailAddress
      });

      return {
        success: true,
        user: {
          email: profile.data.emailAddress,
          name: userInfo.name,
          picture: userInfo.picture,
          messagesTotal: profile.data.messagesTotal,
          threadsTotal: profile.data.threadsTotal
        }
      };
    } catch (error) {
      this.logger.error('Failed to get user profile', {
        error: error.message
      });

      throw error;
    }
  }

  // ===== WORKFLOW AUTOMATION METHODS =====

  /**
   * Auto-create calendar event from workflow/task
   */
  async createEventFromWorkflow(workflow) {
    try {
      const eventData = {
        subject: workflow.title || workflow.session_title,
        body: this._generateEventBodyFromWorkflow(workflow),
        startTime: workflow.suggested_start_time || this._suggestStartTime(workflow),
        endTime: workflow.suggested_end_time || this._suggestEndTime(workflow),
        attendees: this._extractAttendeesFromWorkflow(workflow),
        isOnlineMeeting: true,
        location: workflow.location
      };

      const result = await this.createCalendarEvent(eventData);

      this.logger.info('Created event from workflow', {
        workflow_id: workflow.id,
        event_id: result.event.id
      });

      this.emit('workflow_event_created', {
        workflowId: workflow.id,
        eventId: result.event.id,
        meetingLink: result.meetingLink
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create event from workflow', {
        error: error.message,
        workflow_id: workflow.id
      });

      throw error;
    }
  }

  /**
   * Auto-send email notification for task assignment
   */
  async sendTaskAssignmentEmail(task, assignee) {
    try {
      const emailData = {
        to: [assignee.email],
        subject: `Task Assigned: ${task.title}`,
        body: this._generateTaskAssignmentEmailBody(task, assignee),
        isHtml: true
      };

      const result = await this.sendEmail(emailData);

      this.logger.info('Sent task assignment email', {
        task_id: task.id,
        assignee: assignee.email
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to send task assignment email', {
        error: error.message,
        task_id: task.id
      });

      throw error;
    }
  }

  // ===== HELPER METHODS =====

  _generateEventBodyFromWorkflow(workflow) {
    let body = `Workflow Details\n\n`;
    body += `Title: ${workflow.title || workflow.session_title}\n`;
    
    if (workflow.description || workflow.workflow_metadata?.description) {
      body += `Description: ${workflow.description || workflow.workflow_metadata.description}\n`;
    }
    
    if (workflow.priority || workflow.workflow_metadata?.priority) {
      body += `Priority: ${workflow.priority || workflow.workflow_metadata.priority}\n`;
    }

    body += `\nAuto-generated by HeyJarvis`;
    
    return body;
  }

  _suggestStartTime(workflow) {
    // Default to tomorrow at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString();
  }

  _suggestEndTime(workflow) {
    // Default to 1 hour after start
    const endTime = new Date(this._suggestStartTime(workflow));
    endTime.setHours(endTime.getHours() + 1);
    return endTime.toISOString();
  }

  _extractAttendeesFromWorkflow(workflow) {
    const attendees = [];
    
    // Extract from mentioned users
    if (workflow.workflow_metadata?.mentioned_users) {
      // These would need to be resolved to email addresses
      // For now, return empty array
    }
    
    return attendees;
  }

  _generateTaskAssignmentEmailBody(task, assignee) {
    return `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
          <h2>New Task Assigned</h2>
          <p>Hi ${assignee.name || assignee.email.split('@')[0]},</p>
          <p>You have been assigned a new task:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${task.title}</h3>
            ${task.description ? `<p>${task.description}</p>` : ''}
            <p><strong>Priority:</strong> <span style="color: ${this._getPriorityColor(task.priority)};">${task.priority}</span></p>
            ${task.due_date ? `<p><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>` : ''}
          </div>
          
          <p>Please review and complete this task at your earliest convenience.</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            <em>This email was automatically generated by HeyJarvis</em>
          </p>
        </body>
      </html>
    `;
  }

  _getPriorityColor(priority) {
    const colors = {
      urgent: '#FF3B30',
      high: '#FF9F0A',
      medium: '#007AFF',
      low: '#8E8E93'
    };
    return colors[priority] || colors.medium;
  }
}

module.exports = GoogleGmailService;



