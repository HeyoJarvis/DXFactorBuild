/**
 * Microsoft Graph API Service
 * 
 * Integrates with Microsoft 365 services:
 * - Outlook (email automation)
 * - Calendar (meeting scheduling)
 * - Teams (messaging and collaboration)
 * 
 * Features:
 * 1. OAuth 2.0 authentication with MSAL
 * 2. Auto-create calendar events from workflows
 * 3. Send emails based on task assignments
 * 4. Post Teams messages for notifications
 * 5. Intelligent scheduling with availability checks
 */

const { Client } = require('@microsoft/microsoft-graph-client');
const { PublicClientApplication } = require('@azure/msal-node');
const winston = require('winston');
const crypto = require('crypto');
const EventEmitter = require('events');
require('isomorphic-fetch');

class MicrosoftGraphService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      clientId: options.clientId || process.env.MICROSOFT_CLIENT_ID,
      clientSecret: options.clientSecret || process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: options.tenantId || process.env.MICROSOFT_TENANT_ID || 'common',
      redirectUri: options.redirectUri || process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:8889/auth/microsoft/callback',
      scopes: options.scopes || [
        // User & Authentication
        'User.Read',
        'User.ReadBasic.All',
        
        // Email (for task detection & sending)
        'Mail.Send',
        'Mail.ReadWrite',
        
        // Calendar (for meeting scheduling)
        'Calendars.ReadWrite',
        
        // Teams Chat & Messaging
        'Chat.ReadWrite',
        'ChatMessage.Read',
        
        // Teams Channels
        'ChannelMessage.Send',
        'ChannelMessage.Read.All',
        
        // Teams Structure (for listing teams/channels)
        'Team.ReadBasic.All',
        'Channel.ReadBasic.All',
        
        // Online Meetings (for Teams meeting links)
        'OnlineMeetings.ReadWrite',
        
        // Presence (user availability)
        'Presence.Read',
        
        // Essential for refresh tokens
        'offline_access'
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
          filename: 'logs/microsoft-graph.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'microsoft-graph-service' }
    });

    // Initialize MSAL (Public Client for desktop app)
    this.msalConfig = {
      auth: {
        clientId: this.options.clientId,
        authority: `https://login.microsoftonline.com/${this.options.tenantId}`
        // No clientSecret for public clients (desktop apps)
      }
    };

    this.msalClient = new PublicClientApplication(this.msalConfig);
    this.graphClient = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.codeVerifier = null;
    this.codeChallenge = null;

    this.logger.info('Microsoft Graph Service initialized', {
      tenantId: this.options.tenantId,
      scopes: this.options.scopes.length
    });
  }


  /**
   * Generate PKCE code verifier and challenge
   */
  _generatePKCE() {
    // Generate random code verifier (43-128 characters)
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code challenge (SHA256 hash of verifier)
    this.codeChallenge = crypto
      .createHash('sha256')
      .update(this.codeVerifier)
      .digest('base64url');
    
    this.logger.debug('PKCE generated', {
      verifierLength: this.codeVerifier.length,
      challengeLength: this.codeChallenge.length
    });
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl(state = null) {
    // Generate PKCE parameters
    this._generatePKCE();
    
    const authCodeUrlParameters = {
      scopes: this.options.scopes,
      redirectUri: this.options.redirectUri,
      state: state || Date.now().toString(),
      codeChallenge: this.codeChallenge,
      codeChallengeMethod: 'S256'
    };

    return this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  /**
   * Exchange authorization code for access token
   */
  async authenticateWithCode(code) {
    try {
      const tokenRequest = {
        code,
        scopes: this.options.scopes,
        redirectUri: this.options.redirectUri,
        codeVerifier: this.codeVerifier
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);
      
      this.accessToken = response.accessToken;
      this.tokenExpiry = response.expiresOn;

      this.logger.info('Successfully authenticated with Microsoft', {
        account: response.account?.username,
        expiresOn: this.tokenExpiry
      });

      this._initializeGraphClient();

      this.emit('authenticated', {
        account: response.account,
        expiresOn: this.tokenExpiry
      });

      return {
        success: true,
        account: response.account,
        expiresOn: this.tokenExpiry
      };
    } catch (error) {
      this.logger.error('Authentication failed', {
        error: error.message,
        errorCode: error.errorCode
      });

      throw new Error(`Microsoft authentication failed: ${error.message}`);
    }
  }

  /**
   * Authenticate with client credentials (app-only)
   */
  async authenticateAsApp() {
    try {
      const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default']
      };

      const response = await this.msalClient.acquireTokenByClientCredential(tokenRequest);
      
      this.accessToken = response.accessToken;
      this.tokenExpiry = response.expiresOn;

      this.logger.info('Successfully authenticated as application');

      this._initializeGraphClient();

      return { success: true };
    } catch (error) {
      this.logger.error('App authentication failed', {
        error: error.message
      });

      throw new Error(`Microsoft app authentication failed: ${error.message}`);
    }
  }

  /**
   * Initialize Graph client with access token
   */
  _initializeGraphClient() {
    this.graphClient = Client.init({
      authProvider: (done) => {
        done(null, this.accessToken);
      }
    });
  }

  /**
   * Ensure we have a valid access token
   */
  async _ensureAuthenticated() {
    if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      throw new Error('Not authenticated or token expired. Please authenticate first.');
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

      const event = {
        subject: eventData.subject || eventData.title,
        body: {
          contentType: 'HTML',
          content: eventData.body || eventData.description || ''
        },
        start: {
          dateTime: eventData.startTime,
          timeZone: eventData.timeZone || 'UTC'
        },
        end: {
          dateTime: eventData.endTime,
          timeZone: eventData.timeZone || 'UTC'
        },
        location: eventData.location ? {
          displayName: eventData.location
        } : undefined,
        attendees: (eventData.attendees || []).map(attendee => {
          // Handle both string emails and objects with email property
          const email = typeof attendee === 'string' ? attendee : (attendee.email || attendee.address);
          if (!email || typeof email !== 'string') {
            this.logger.warn('Invalid attendee format', { attendee });
            return null;
          }
          return {
            emailAddress: {
              address: email,
              name: email.split('@')[0]
            },
            type: 'required'
          };
        }).filter(Boolean), // Remove any null entries
        isOnlineMeeting: eventData.isOnlineMeeting !== false,
        onlineMeetingProvider: eventData.isOnlineMeeting !== false ? 'teamsForBusiness' : undefined
      };

      const result = await this.graphClient
        .api('/me/events')
        .post(event);

      // Extract meeting link from various possible locations
      const meetingLink = result.onlineMeeting?.joinUrl 
        || result.onlineMeetingUrl 
        || result.webLink;

      this.logger.info('Calendar event created', {
        event_id: result.id,
        subject: result.subject,
        start: result.start.dateTime,
        has_online_meeting: !!result.onlineMeeting,
        meeting_link: meetingLink
      });

      this.emit('calendar_event_created', {
        eventId: result.id,
        subject: result.subject,
        attendees: eventData.attendees,
        meetingLink: meetingLink
      });

      return {
        success: true,
        event: result,
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
   * Get user's calendar availability
   */
  async getAvailability(userEmails, startTime, endTime) {
    try {
      await this._ensureAuthenticated();

      const scheduleRequest = {
        schedules: userEmails,
        startTime: {
          dateTime: startTime,
          timeZone: 'UTC'
        },
        endTime: {
          dateTime: endTime,
          timeZone: 'UTC'
        },
        availabilityViewInterval: 30
      };

      const result = await this.graphClient
        .api('/me/calendar/getSchedule')
        .post(scheduleRequest);

      this.logger.info('Retrieved availability', {
        users: userEmails.length,
        timeRange: `${startTime} - ${endTime}`
      });

      return {
        success: true,
        schedules: result.value
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

      const request = {
        attendees: attendees.map(email => ({
          emailAddress: {
            address: email
          },
          type: 'required'
        })),
        timeConstraint: {
          timeslots: options.timeSlots || [
            {
              start: {
                dateTime: options.startTime || new Date().toISOString(),
                timeZone: 'UTC'
              },
              end: {
                dateTime: options.endTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                timeZone: 'UTC'
              }
            }
          ]
        },
        meetingDuration: `PT${durationMinutes}M`,
        maxCandidates: options.maxCandidates || 10,
        isOrganizerOptional: false
      };

      const result = await this.graphClient
        .api('/me/findMeetingTimes')
        .post(request);

      this.logger.info('Found meeting times', {
        candidates: result.meetingTimeSuggestions?.length || 0
      });

      return {
        success: true,
        suggestions: result.meetingTimeSuggestions || []
      };
    } catch (error) {
      this.logger.error('Failed to find meeting times', {
        error: error.message
      });

      throw error;
    }
  }

  // ===== EMAIL METHODS =====

  /**
   * Send an email
   */
  async sendEmail(emailData) {
    try {
      await this._ensureAuthenticated();

      const message = {
        message: {
          subject: emailData.subject,
          body: {
            contentType: emailData.isHtml ? 'HTML' : 'Text',
            content: emailData.body
          },
          toRecipients: (emailData.to || []).map(email => ({
            emailAddress: {
              address: email
            }
          })),
          ccRecipients: (emailData.cc || []).map(email => ({
            emailAddress: {
              address: email
            }
          })),
          bccRecipients: (emailData.bcc || []).map(email => ({
            emailAddress: {
              address: email
            }
          })),
          importance: emailData.importance || 'normal'
        },
        saveToSentItems: emailData.saveToSentItems !== false
      };

      await this.graphClient
        .api('/me/sendMail')
        .post(message);

      this.logger.info('Email sent', {
        subject: emailData.subject,
        recipients: emailData.to?.length || 0
      });

      this.emit('email_sent', {
        subject: emailData.subject,
        to: emailData.to
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to send email', {
        error: error.message,
        subject: emailData.subject
      });

      throw error;
    }
  }

  /**
   * Create draft email
   */
  async createDraftEmail(emailData) {
    try {
      await this._ensureAuthenticated();

      const draft = {
        subject: emailData.subject,
        body: {
          contentType: emailData.isHtml ? 'HTML' : 'Text',
          content: emailData.body
        },
        toRecipients: (emailData.to || []).map(email => ({
          emailAddress: {
            address: email
          }
        }))
      };

      const result = await this.graphClient
        .api('/me/messages')
        .post(draft);

      this.logger.info('Draft email created', {
        draft_id: result.id,
        subject: result.subject
      });

      return {
        success: true,
        draft: result
      };
    } catch (error) {
      this.logger.error('Failed to create draft', {
        error: error.message
      });

      throw error;
    }
  }

  // ===== TEAMS METHODS =====

  /**
   * Send a Teams message to a channel
   */
  async sendTeamsMessage(teamId, channelId, message) {
    try {
      await this._ensureAuthenticated();

      const chatMessage = {
        body: {
          content: message.content || message,
          contentType: message.contentType || 'text'
        }
      };

      const result = await this.graphClient
        .api(`/teams/${teamId}/channels/${channelId}/messages`)
        .post(chatMessage);

      this.logger.info('Teams message sent', {
        team_id: teamId,
        channel_id: channelId,
        message_id: result.id
      });

      return {
        success: true,
        message: result
      };
    } catch (error) {
      this.logger.error('Failed to send Teams message', {
        error: error.message,
        team_id: teamId
      });

      throw error;
    }
  }

  /**
   * Create a Teams meeting
   */
  async createTeamsMeeting(meetingData) {
    try {
      await this._ensureAuthenticated();

      const onlineMeeting = {
        startDateTime: meetingData.startTime,
        endDateTime: meetingData.endTime,
        subject: meetingData.subject || meetingData.title
      };

      const result = await this.graphClient
        .api('/me/onlineMeetings')
        .post(onlineMeeting);

      this.logger.info('Teams meeting created', {
        meeting_id: result.id,
        join_url: result.joinUrl
      });

      return {
        success: true,
        meeting: result,
        joinUrl: result.joinUrl
      };
    } catch (error) {
      this.logger.error('Failed to create Teams meeting', {
        error: error.message
      });

      throw error;
    }
  }

  // ===== USER METHODS =====

  /**
   * Get current user profile
   */
  async getUserProfile() {
    try {
      await this._ensureAuthenticated();

      const user = await this.graphClient
        .api('/me')
        .select('displayName,mail,userPrincipalName,id')
        .get();

      this.logger.info('Retrieved user profile', {
        user_id: user.id,
        email: user.mail
      });

      return {
        success: true,
        user
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
        isHtml: true,
        importance: task.priority === 'urgent' ? 'high' : 'normal'
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
    let body = `<h3>Workflow Details</h3>`;
    body += `<p><strong>Title:</strong> ${workflow.title || workflow.session_title}</p>`;
    
    if (workflow.description || workflow.workflow_metadata?.description) {
      body += `<p><strong>Description:</strong> ${workflow.description || workflow.workflow_metadata.description}</p>`;
    }
    
    if (workflow.priority || workflow.workflow_metadata?.priority) {
      body += `<p><strong>Priority:</strong> ${workflow.priority || workflow.workflow_metadata.priority}</p>`;
    }

    body += `<p><em>Auto-generated by HeyJarvis</em></p>`;
    
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

  /**
   * ========================================
   * TEAMS MESSAGE MONITORING
   * ========================================
   */

  /**
   * Get messages from a Teams channel
   * @param {string} teamId - Team ID
   * @param {string} channelId - Channel ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Channel messages
   */
  async getTeamChannelMessages(teamId, channelId, options = {}) {
    try {
      this.logger.info('Fetching Teams channel messages', { teamId, channelId, options });

      const queryParams = new URLSearchParams();
      if (options.top) queryParams.append('$top', options.top);
      if (options.orderby) queryParams.append('$orderby', options.orderby);
      
      const endpoint = `/teams/${teamId}/channels/${channelId}/messages${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await this.graphClient
        .api(endpoint)
        .get();

      this.logger.info('Teams channel messages fetched', {
        teamId,
        channelId,
        messageCount: response.value?.length || 0
      });

      return response.value || [];

    } catch (error) {
      this.logger.error('Failed to fetch Teams channel messages', {
        teamId,
        channelId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get messages from a Teams chat (1:1 or group)
   * @param {string} chatId - Chat ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Chat messages
   */
  async getTeamChatMessages(chatId, options = {}) {
    try {
      this.logger.info('Fetching Teams chat messages', { chatId, options });

      const queryParams = new URLSearchParams();
      if (options.top) queryParams.append('$top', options.top);
      if (options.orderby) queryParams.append('$orderby', options.orderby);
      
      const endpoint = `/chats/${chatId}/messages${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await this.graphClient
        .api(endpoint)
        .get();

      this.logger.info('Teams chat messages fetched', {
        chatId,
        messageCount: response.value?.length || 0
      });

      return response.value || [];

    } catch (error) {
      this.logger.error('Failed to fetch Teams chat messages', {
        chatId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all Teams for the authenticated user
   * @returns {Promise<Array>} List of teams
   */
  async getUserTeams() {
    try {
      this.logger.info('Fetching user teams');

      const response = await this.graphClient
        .api('/me/joinedTeams')
        .get();

      this.logger.info('User teams fetched', {
        teamCount: response.value?.length || 0
      });

      return response.value || [];

    } catch (error) {
      this.logger.error('Failed to fetch user teams', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all channels for a team
   * @param {string} teamId - Team ID
   * @returns {Promise<Array>} List of channels
   */
  async getTeamChannels(teamId) {
    try {
      this.logger.info('Fetching team channels', { teamId });

      const response = await this.graphClient
        .api(`/teams/${teamId}/channels`)
        .get();

      this.logger.info('Team channels fetched', {
        teamId,
        channelCount: response.value?.length || 0
      });

      return response.value || [];

    } catch (error) {
      this.logger.error('Failed to fetch team channels', {
        teamId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all chats for the authenticated user
   * @returns {Promise<Array>} List of chats
   */
  async getUserChats() {
    try {
      this.logger.info('Fetching user chats');

      const response = await this.graphClient
        .api('/me/chats')
        .get();

      this.logger.info('User chats fetched', {
        chatCount: response.value?.length || 0
      });

      return response.value || [];

    } catch (error) {
      this.logger.error('Failed to fetch user chats', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Subscribe to Teams channel messages (webhook)
   * @param {string} teamId - Team ID
   * @param {string} channelId - Channel ID
   * @param {string} notificationUrl - Webhook URL to receive notifications
   * @param {number} expirationMinutes - Subscription expiration in minutes (max 4230 = 3 days)
   * @returns {Promise<Object>} Subscription details
   */
  async subscribeToTeamsMessages(teamId, channelId, notificationUrl, expirationMinutes = 4230) {
    try {
      this.logger.info('Creating Teams message subscription', {
        teamId,
        channelId,
        notificationUrl,
        expirationMinutes
      });

      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(expirationDateTime.getMinutes() + expirationMinutes);

      const subscription = {
        changeType: 'created',
        notificationUrl: notificationUrl,
        resource: `/teams/${teamId}/channels/${channelId}/messages`,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: crypto.randomBytes(16).toString('hex')
      };

      const response = await this.graphClient
        .api('/subscriptions')
        .post(subscription);

      this.logger.info('Teams message subscription created', {
        subscriptionId: response.id,
        expiresAt: response.expirationDateTime
      });

      this.emit('teams_subscription_created', response);

      return response;

    } catch (error) {
      this.logger.error('Failed to create Teams subscription', {
        teamId,
        channelId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * ========================================
   * EMAIL MONITORING
   * ========================================
   */

  /**
   * Get unread emails from inbox
   * @param {string} folderId - Folder ID (default: 'inbox')
   * @param {number} maxResults - Maximum number of emails to fetch
   * @returns {Promise<Array>} Unread emails
   */
  async getUnreadEmails(folderId = 'inbox', maxResults = 50) {
    try {
      this.logger.info('Fetching unread emails', { folderId, maxResults });

      const response = await this.graphClient
        .api(`/me/mailFolders/${folderId}/messages`)
        .filter('isRead eq false')
        .top(maxResults)
        .orderby('receivedDateTime DESC')
        .select('id,subject,bodyPreview,body,from,receivedDateTime,isRead,importance,hasAttachments')
        .get();

      this.logger.info('Unread emails fetched', {
        folderId,
        emailCount: response.value?.length || 0
      });

      return response.value || [];

    } catch (error) {
      this.logger.error('Failed to fetch unread emails', {
        folderId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark an email as read
   * @param {string} messageId - Email message ID
   * @returns {Promise<Object>} Updated message
   */
  async markEmailAsRead(messageId) {
    try {
      this.logger.info('Marking email as read', { messageId });

      const response = await this.graphClient
        .api(`/me/messages/${messageId}`)
        .patch({ isRead: true });

      this.logger.info('Email marked as read', { messageId });

      return response;

    } catch (error) {
      this.logger.error('Failed to mark email as read', {
        messageId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Subscribe to email changes (webhook)
   * @param {string} notificationUrl - Webhook URL to receive notifications
   * @param {number} expirationMinutes - Subscription expiration in minutes (max 4230 = 3 days)
   * @returns {Promise<Object>} Subscription details
   */
  async subscribeToEmailChanges(notificationUrl, expirationMinutes = 4230) {
    try {
      this.logger.info('Creating email subscription', {
        notificationUrl,
        expirationMinutes
      });

      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(expirationDateTime.getMinutes() + expirationMinutes);

      const subscription = {
        changeType: 'created',
        notificationUrl: notificationUrl,
        resource: '/me/mailFolders/inbox/messages',
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: crypto.randomBytes(16).toString('hex')
      };

      const response = await this.graphClient
        .api('/subscriptions')
        .post(subscription);

      this.logger.info('Email subscription created', {
        subscriptionId: response.id,
        expiresAt: response.expirationDateTime
      });

      this.emit('email_subscription_created', response);

      return response;

    } catch (error) {
      this.logger.error('Failed to create email subscription', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = MicrosoftGraphService;
