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
   * Disconnect Microsoft
   */
  ipcMain.handle('microsoft:disconnect', async () => {
    try {
      logger.info('🔵 Microsoft disconnect requested');
      
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Removing Microsoft tokens from database', { userId });

      // Remove Microsoft tokens from Supabase
      const { data: currentUser } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const integrationSettings = currentUser?.integration_settings || {};
      const hadMicrosoft = !!integrationSettings.microsoft;
      delete integrationSettings.microsoft;

      await services.dbAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      logger.info('Microsoft tokens removed from database', { userId, hadMicrosoft });

      // Clear Microsoft service instance using the service's disconnect method
      const microsoftService = services.microsoft;
      if (microsoftService) {
        logger.info('Calling Microsoft service disconnect method');
        microsoftService.disconnect();
        logger.info('Microsoft service disconnect method completed');
      } else {
        logger.warn('Microsoft service not found in services object');
      }

      logger.info('✅ Microsoft disconnected successfully', { userId });

      return {
        success: true
      };

    } catch (error) {
      logger.error('❌ Microsoft disconnect error:', error);
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
   * Disconnect Google
   */
  ipcMain.handle('google:disconnect', async () => {
    try {
      logger.info('🔴 Google disconnect requested');
      
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      logger.info('Removing Google tokens from database', { userId });

      // Remove Google tokens from Supabase
      const { data: currentUser } = await services.dbAdapter.supabase
        .from('users')
        .select('integration_settings')
        .eq('id', userId)
        .single();

      const integrationSettings = currentUser?.integration_settings || {};
      const hadGoogle = !!integrationSettings.google;
      delete integrationSettings.google;

      await services.dbAdapter.supabase
        .from('users')
        .update({ integration_settings: integrationSettings })
        .eq('id', userId);

      logger.info('Google tokens removed from database', { userId, hadGoogle });

      // Clear Google service instance using the service's disconnect method
      const googleService = services.google;
      if (googleService) {
        logger.info('Calling Google service disconnect method');
        googleService.disconnect();
        logger.info('Google service disconnect method completed');
      } else {
        logger.warn('Google service not found in services object');
      }

      logger.info('✅ Google disconnected successfully', { userId });

      return {
        success: true
      };

    } catch (error) {
      logger.error('❌ Google disconnect error:', error);
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
   * Generate AI suggestions from inbox messages
   */
  ipcMain.handle('inbox:generateSuggestions', async (_event, messages) => {
    try {
      logger.info('Generating AI suggestions from messages', { count: messages.length });

      if (!messages || messages.length === 0) {
        return {
          success: true,
          suggestions: []
        };
      }

      // Analyze top 10 messages with AI
      const topMessages = messages.slice(0, 10);
      
      // Build context for AI analysis
      const emailContext = topMessages.map((msg, idx) => 
        `${idx + 1}. From: ${msg.company} (${msg.from})
   Subject: ${msg.subject}
   Preview: ${msg.preview}
   Timestamp: ${msg.timestamp}
   Tags: ${msg.tags?.join(', ') || 'none'}
   Status: ${msg.status || 'unread'}`
      ).join('\n\n');

      const analysisPrompt = `You are an AI assistant analyzing a user's inbox to generate actionable suggestions.

INBOX MESSAGES:
${emailContext}

TASK: Analyze these emails and generate 3-5 high-value actionable suggestions. Focus on:
1. Follow-up opportunities (meetings, calls, important conversations)
2. Urgent responses needed (time-sensitive emails, unanswered important messages)
3. Lead opportunities (potential sales, partnerships, business opportunities)
4. Action items (tasks mentioned in emails, deadlines, commitments)
5. Relationship building (important contacts to engage with)

For each suggestion, provide:
- type: "follow-up", "response", "lead", "action", or "relationship"
- priority: "high", "medium", or "low"
- title: Short actionable title (e.g., "Follow up with TechCorp")
- description: Brief context (1-2 sentences)
- action: Action button text (e.g., "Schedule Meeting", "Draft Reply", "Add to CRM")
- messageIndex: Index of the related message (0-based)

Respond ONLY with valid JSON array (no markdown, no extra text):
[
  {
    "type": "follow-up",
    "priority": "high",
    "title": "Follow up with Company Name",
    "description": "Brief context about why this is important",
    "action": "Schedule Meeting",
    "messageIndex": 0
  }
]`;

      // Get AI analysis
      const aiResponse = await services.ai.sendMessage(analysisPrompt, {
        systemPrompt: 'You are a business intelligence assistant that analyzes emails and generates actionable insights. Always respond with valid JSON only.'
      });

      // Parse AI response
      let suggestions = [];
      try {
        const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.content;
        // Extract JSON from response (in case AI adds markdown)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedSuggestions = JSON.parse(jsonMatch[0]);
          
          // Map suggestions to include related message data
          suggestions = parsedSuggestions.map(sug => ({
            id: `ai-${sug.type}-${sug.messageIndex}`,
            type: sug.type,
            priority: sug.priority,
            title: sug.title,
            description: sug.description,
            action: sug.action,
            relatedMessage: topMessages[sug.messageIndex],
            icon: getIconForType(sug.type)
          }));
        }
      } catch (parseError) {
        logger.error('Failed to parse AI suggestions', { error: parseError.message });
        // Return empty suggestions on parse error
        suggestions = [];
      }

      logger.info('AI suggestions generated', { count: suggestions.length });

      return {
        success: true,
        suggestions
      };

    } catch (error) {
      logger.error('Failed to generate AI suggestions', { error: error.message });
      return {
        success: false,
        error: error.message,
        suggestions: []
      };
    }
  });

  // Helper function to get icon for suggestion type
  function getIconForType(type) {
    const iconMap = {
      'follow-up': '📅',
      'response': '✉️',
      'lead': '🎯',
      'action': '✅',
      'relationship': '🤝'
    };
    return iconMap[type] || '💡';
  }

  /**
   * Get unified calendar events from Google and Outlook
   */
  ipcMain.handle('missionControl:getCalendar', async (_event, options = {}) => {
    try {
      const userId = services.auth?.currentUser?.id;

      if (!userId) {
        logger.warn('User not authenticated for calendar');
      }

      const {
        startDateTime,
        endDateTime,
        maxResults = 500 // Fetch up to 500 events (increased from 50)
      } = options;

      logger.info('Fetching unified calendar', { 
        userId, 
        startDateTime, 
        endDateTime,
        googleConnected: services.google?.isConnected(),
        microsoftConnected: services.microsoft?.isConnected()
      });

      const allEvents = [];

      // Fetch from Google Calendar if connected
      if (services.google?.isConnected()) {
        console.log('📅 Calendar: Fetching Google Calendar events...');
        try {
          const googleResult = await services.google.gmailService.getUpcomingEvents(
            startDateTime || new Date().toISOString(),
            endDateTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            maxResults
          );
          
          if (googleResult && Array.isArray(googleResult)) {
            const transformedEvents = googleResult.map(event => ({
              ...event,
              source: 'google',
              provider: 'google'
            }));
            allEvents.push(...transformedEvents);
            logger.info('Google Calendar events added', { count: googleResult.length });
            console.log('📅 Calendar: Added', googleResult.length, 'Google events');
          }
        } catch (error) {
          logger.error('Failed to fetch Google Calendar events', { error: error.message });
          console.error('📅 Calendar: Google fetch error:', error);
        }
      } else {
        console.log('📅 Calendar: Skipping Google - not connected');
      }

      // Fetch from Outlook Calendar if connected
      if (services.microsoft?.isConnected()) {
        console.log('📅 Calendar: Fetching Outlook Calendar events...');
        try {
          const outlookResult = await services.microsoft.getCalendarEvents(
            startDateTime || new Date().toISOString(),
            endDateTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            maxResults
          );
          
          if (outlookResult.success && outlookResult.events) {
            const transformedEvents = outlookResult.events.map(event => ({
              ...event,
              source: 'microsoft',
              provider: 'outlook'
            }));
            allEvents.push(...transformedEvents);
            logger.info('Outlook Calendar events added', { count: outlookResult.events.length });
            console.log('📅 Calendar: Added', outlookResult.events.length, 'Outlook events');
          }
        } catch (error) {
          logger.error('Failed to fetch Outlook Calendar events', { error: error.message });
          console.error('📅 Calendar: Outlook fetch error:', error);
        }
      } else {
        console.log('📅 Calendar: Skipping Outlook - not connected');
      }

      // Sort all events by start time
      allEvents.sort((a, b) => {
        const aTime = new Date(a.start?.dateTime || a.start?.date);
        const bTime = new Date(b.start?.dateTime || b.start?.date);
        return aTime - bTime;
      });

      logger.info('Unified calendar fetched', {
        userId,
        totalEvents: allEvents.length
      });

      console.log('📅 Calendar: Returning', allEvents.length, 'events to frontend');

      return {
        success: true,
        events: allEvents,
        count: allEvents.length
      };

    } catch (error) {
      logger.error('Failed to get unified calendar', { error: error.message });
      return {
        success: false,
        error: error.message,
        events: []
      };
    }
  });

  /**
   * Generate AI suggestions from calendar events
   */
  ipcMain.handle('calendar:generateSuggestions', async (_event, events) => {
    try {
      logger.info('Generating AI calendar suggestions from events', { count: events.length });

      if (!events || events.length === 0) {
        return {
          success: true,
          suggestions: []
        };
      }

      // Analyze events with AI
      const eventContext = events.map((evt, idx) => 
        `${idx + 1}. Event: ${evt.subject || evt.summary}
   Organizer: ${evt.organizer?.emailAddress?.name || evt.organizer?.email || 'Unknown'}
   Time: ${new Date(evt.start?.dateTime || evt.start?.date).toLocaleString()}
   Attendees: ${evt.attendees?.length || 0} people
   Location: ${evt.location || 'Not specified'}`
      ).join('\n\n');

      const analysisPrompt = `You are an AI assistant analyzing a user's calendar to generate actionable suggestions.

CALENDAR EVENTS:
${eventContext}

TASK: Analyze these calendar events and generate 3-5 high-value actionable suggestions. Focus on:
1. Preparation needed (meetings requiring prep work, materials, or research)
2. Follow-up actions (meetings that need follow-up emails or tasks)
3. Scheduling conflicts (overlapping meetings or tight schedules)
4. Networking opportunities (important attendees to connect with)
5. Time management (back-to-back meetings, need for breaks)

For each suggestion, provide:
- type: "preparation", "follow-up", "conflict", "networking", or "time-management"
- priority: "high", "medium", or "low"
- title: Short actionable title (e.g., "Prepare materials for TechCorp meeting")
- description: Brief context (1-2 sentences)
- action: Action button text (e.g., "Create Agenda", "Schedule Follow-up", "Block Time")
- eventIndex: Index of the related event (0-based)

Respond ONLY with valid JSON array (no markdown, no extra text):
[
  {
    "type": "preparation",
    "priority": "high",
    "title": "Prepare for meeting with Company Name",
    "description": "Brief context about why preparation is needed",
    "action": "Create Agenda",
    "eventIndex": 0
  }
]`;

      // Get AI analysis
      const aiResponse = await services.ai.sendMessage(analysisPrompt, {
        systemPrompt: 'You are a calendar intelligence assistant that analyzes meetings and generates actionable insights. Always respond with valid JSON only.'
      });

      // Parse AI response
      let suggestions = [];
      try {
        const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.content;
        // Extract JSON from response (in case AI adds markdown)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedSuggestions = JSON.parse(jsonMatch[0]);
          
          // Map suggestions to include related event data
          suggestions = parsedSuggestions.map(sug => ({
            id: `ai-calendar-${sug.type}-${sug.eventIndex}`,
            type: sug.type,
            priority: sug.priority,
            title: sug.title,
            description: sug.description,
            action: sug.action,
            relatedEvent: events[sug.eventIndex],
            icon: getCalendarIconForType(sug.type)
          }));
        }
      } catch (parseError) {
        logger.error('Failed to parse AI calendar suggestions', { error: parseError.message });
        suggestions = [];
      }

      logger.info('AI calendar suggestions generated', { count: suggestions.length });

      return {
        success: true,
        suggestions
      };

    } catch (error) {
      logger.error('Failed to generate AI calendar suggestions', { error: error.message });
      return {
        success: false,
        error: error.message,
        suggestions: []
      };
    }
  });

  // Helper function to get icon for calendar suggestion type
  function getCalendarIconForType(type) {
    const iconMap = {
      'preparation': '📋',
      'follow-up': '✉️',
      'conflict': '⚠️',
      'networking': '🤝',
      'time-management': '⏰'
    };
    return iconMap[type] || '📅';
  }

  /**
   * Get unified inbox (emails from Gmail, Outlook, LinkedIn, and optionally Slack/Teams)
   */
  ipcMain.handle('inbox:getUnified', async (_event, options = {}) => {
    try {
      const userId = services.auth?.currentUser?.id;

      // Allow unauthenticated access for demo purposes
      if (!userId) {
        logger.warn('User not authenticated, using mock data');
      }

      const {
        maxResults = 500, // Fetch up to 500 emails (increased from 50)
        includeSources = ['email', 'linkedin'] // Can add 'slack', 'teams' later
      } = options;

      logger.info('Fetching unified inbox', { 
        userId, 
        includeSources, 
        maxResults,
        googleConnected: services.google?.isConnected(),
        microsoftConnected: services.microsoft?.isConnected()
      });
      console.log('📧 Unibox: Fetching inbox with sources:', includeSources);
      console.log('📧 Unibox: Google connected?', services.google?.isConnected());
      console.log('📧 Unibox: Microsoft connected?', services.microsoft?.isConnected());

      const allMessages = [];

      // Fetch from Gmail if email source is included and connected
      if (includeSources.includes('email') && services.google?.isConnected()) {
        console.log('📧 Unibox: Fetching Gmail emails...');
        try {
          const gmailResult = await services.google.getUnreadEmails(maxResults);
          if (gmailResult.success && gmailResult.emails) {
            // Transform Gmail emails to unified format
            const transformedEmails = gmailResult.emails.map(email => ({
              id: email.id,
              company: email.from?.split('<')[0]?.trim() || 'Unknown',
              from: email.from,
              subject: email.subject,
              preview: email.snippet || email.preview,
              body: email.body || email.snippet || email.preview,
              bodyHtml: email.bodyHtml,
              timestamp: formatTimestamp(email.date || email.receivedDateTime),
              source: 'email',
              provider: 'gmail',
              category: inferCategory(email),
              tags: inferTags(email),
              status: email.isRead ? 'replied' : null
            }));
            allMessages.push(...transformedEmails);
            logger.info('Gmail emails added to unified inbox', { count: gmailResult.emails.length });
            console.log('📧 Unibox: Added', gmailResult.emails.length, 'Gmail emails');
            console.log('📧 Unibox: Sample Gmail message:', transformedEmails[0]);
          } else {
            console.log('📧 Unibox: Gmail result:', gmailResult);
          }
        } catch (error) {
          logger.error('Failed to fetch Gmail emails for unified inbox', { error: error.message });
          console.error('📧 Unibox: Gmail fetch error:', error);
        }
      } else {
        console.log('📧 Unibox: Skipping Gmail - email in sources?', includeSources.includes('email'), 'connected?', services.google?.isConnected());
      }

      // Fetch from Outlook if email source is included and connected
      if (includeSources.includes('email') && services.microsoft?.isConnected()) {
        console.log('📧 Unibox: Fetching Outlook emails...');
        try {
          const outlookResult = await services.microsoft.getEmails('inbox', maxResults);
          if (outlookResult.success && outlookResult.emails) {
            // Transform Outlook emails to unified format
            const transformedEmails = outlookResult.emails.map(email => ({
              id: email.id,
              company: email.from?.emailAddress?.name || 'Unknown',
              from: email.from?.emailAddress?.address,
              subject: email.subject,
              preview: email.bodyPreview,
              body: email.body?.content || email.bodyPreview,
              bodyHtml: email.body?.contentType === 'html' ? email.body?.content : null,
              timestamp: formatTimestamp(email.receivedDateTime),
              source: 'email',
              provider: 'outlook',
              category: inferCategory(email),
              tags: inferTags(email),
              status: email.isRead ? 'replied' : null
            }));
            allMessages.push(...transformedEmails);
            logger.info('Outlook emails added to unified inbox', { count: outlookResult.emails.length });
            console.log('📧 Unibox: Added', outlookResult.emails.length, 'Outlook emails');
          } else {
            console.log('📧 Unibox: Outlook result:', outlookResult);
          }
        } catch (error) {
          logger.error('Failed to fetch Outlook emails for unified inbox', { error: error.message });
          console.error('📧 Unibox: Outlook fetch error:', error);
        }
      } else {
        console.log('📧 Unibox: Skipping Outlook - email in sources?', includeSources.includes('email'), 'connected?', services.microsoft?.isConnected());
      }

      // TODO: Fetch from LinkedIn if included and connected
      if (includeSources.includes('linkedin')) {
        logger.info('LinkedIn integration not yet implemented');
      }

      // TODO: Fetch from Slack if included and connected
      if (includeSources.includes('slack')) {
        logger.info('Slack integration not yet implemented');
      }

      // TODO: Fetch from Teams if included and connected
      if (includeSources.includes('teams')) {
        logger.info('Teams integration not yet implemented');
      }

      // Log if no messages found
      if (allMessages.length === 0) {
        logger.info('No messages found in unified inbox', { 
          userId: userId || 'unauthenticated',
          includeSources,
          gmailConnected: services.google?.isConnected(),
          outlookConnected: services.microsoft?.isConnected()
        });
        console.log('📧 Unibox: No messages found. Total:', allMessages.length);
      } else {
        console.log('📧 Unibox: Total messages before sorting:', allMessages.length);
      }

      // Sort all messages by date (most recent first)
      allMessages.sort((a, b) => {
        const dateA = parseTimestamp(a.timestamp);
        const dateB = parseTimestamp(b.timestamp);
        return dateB - dateA;
      });

      // Limit to maxResults
      const limitedMessages = allMessages.slice(0, maxResults);

      logger.info('Unified inbox fetched', {
        userId,
        totalMessages: limitedMessages.length,
        sources: includeSources
      });

      console.log('📧 Unibox: Returning', limitedMessages.length, 'messages to frontend');
      console.log('📧 Unibox: First message being returned:', limitedMessages[0]);

      return {
        success: true,
        messages: limitedMessages,
        count: limitedMessages.length
      };

    } catch (error) {
      logger.error('Failed to get unified inbox', { error: error.message });
      return {
        success: false,
        error: error.message,
        messages: []
      };
    }
  });

  // Helper functions for inbox formatting
  function formatTimestamp(date) {
    if (!date) return 'Unknown';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return d.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    } else {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  function parseTimestamp(timestamp) {
    const now = new Date();
    if (timestamp.startsWith('Today')) {
      return now;
    } else if (timestamp.startsWith('Yesterday')) {
      return new Date(now - 24 * 60 * 60 * 1000);
    } else {
      return new Date(timestamp);
    }
  }

  function inferCategory(email) {
    const text = `${email.subject} ${email.preview || email.snippet || ''}`.toLowerCase();
    if (text.includes('marketing') || text.includes('campaign') || text.includes('design')) {
      return 'marketing';
    } else if (text.includes('sales') || text.includes('lead') || text.includes('deal')) {
      return 'sales';
    }
    return 'sales'; // default
  }

  function inferTags(email) {
    const tags = [];
    const text = `${email.subject} ${email.preview || email.snippet || ''}`.toLowerCase();
    
    if (text.includes('marketing')) tags.push('Marketing');
    if (text.includes('sales')) tags.push('Sales');
    if (text.includes('lead')) tags.push('Lead Generation');
    if (text.includes('campaign')) tags.push('Campaign Design');
    if (text.includes('deal') || text.includes('closing')) tags.push('Deal Closing');
    
    return tags.length > 0 ? tags : ['Sales'];
  }

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
  ipcMain.handle('google:getUnreadEmails', async (_event, maxResults = 500) => {
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
  ipcMain.handle('microsoft:getEmails', async (_event, folderId = 'inbox', maxResults = 500) => {
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
  ipcMain.handle('microsoft:getUnreadEmails', async (_event, maxResults = 500) => {
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

