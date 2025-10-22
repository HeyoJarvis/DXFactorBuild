/**
 * Standalone Microsoft Service for Team Sync Intelligence
 * 
 * Uses Microsoft Graph API to fetch:
 * - Calendar events
 * - Meeting transcripts (Copilot notes)
 * - User profile
 * 
 * Completely independent from Desktop2
 */

const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

class StandaloneMicrosoftService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.oauthService = options.oauthService;
    this.supabaseAdapter = options.supabaseAdapter;
    
    this.logger.info('Standalone Microsoft Service initialized for Team Sync');
  }

  /**
   * Check if Microsoft is connected for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isConnected(userId) {
    try {
      const { data, error } = await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('service_name', 'microsoft')
        .single();

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Graph client with valid token
   * @param {string} userId - User ID
   * @returns {Promise<Client>} Graph client
   */
  async _getGraphClient(userId) {
    const accessToken = await this.oauthService.getAccessToken(userId);
    
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  /**
   * Get upcoming calendar events
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Calendar events
   */
  async getUpcomingEvents(userId, options = {}) {
    try {
      const days = options.days || 14;
      const startDateTime = new Date().toISOString();
      const endDateTime = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const client = await this._getGraphClient(userId);

      this.logger.info('Fetching calendar events', { 
        userId, 
        days,
        startDateTime,
        endDateTime 
      });

      const response = await client
        .api('/me/calendarView')
        .query({
          startDateTime,
          endDateTime,
          $top: options.maxResults || 50,
          $orderby: 'start/dateTime'
        })
        // Don't force UTC - use user's local timezone
        .select('id,subject,start,end,attendees,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,body,location,organizer,recurrence')
        .get();

      this.logger.info('Calendar events fetched', {
        userId,
        count: response.value?.length || 0
      });

      return response.value || [];

    } catch (error) {
      this.logger.error('Failed to fetch calendar events', {
        userId,
        error: error.message
      });
      throw new Error('Microsoft not connected');
    }
  }

  /**
   * Get meeting transcript and Copilot notes
   * Fetches both raw transcript and AI-generated recap
   * @param {string} userId - User ID
   * @param {string} meetingId - Calendar event ID
   * @returns {Promise<Object|null>} Combined transcript and notes data
   */
  async getMeetingTranscript(userId, meetingId) {
    try {
      const client = await this._getGraphClient(userId);

      this.logger.info('Fetching meeting transcript and Copilot notes', { userId, meetingId });

      // Get the calendar event details
      const event = await client
        .api(`/me/events/${meetingId}`)
        .select('id,subject,start,end,onlineMeeting,onlineMeetingUrl,body')
        .get();

      this.logger.info('Calendar event retrieved', {
        subject: event.subject,
        hasOnlineMeeting: !!event.onlineMeeting,
        hasOnlineMeetingUrl: !!event.onlineMeetingUrl
      });

      // Try to find transcript in OneDrive (where Teams saves meeting recordings)
      try {
        this.logger.info('Searching for meeting recordings in OneDrive', {
          subject: event.subject
        });
        
        // Search for files with the meeting name + transcript
        const searchQuery = `${event.subject} transcript`;
        const searchResult = await client
          .api(`/me/drive/root/search(q='${encodeURIComponent(searchQuery)}')`)
          .filter("file ne null")
          .top(20)
          .get();

        this.logger.info('OneDrive search results', {
          totalFiles: searchResult.value?.length || 0
        });

        if (searchResult.value && searchResult.value.length > 0) {
          // Look for VTT or transcript files
          const transcriptFiles = searchResult.value.filter(f => {
            const name = f.name.toLowerCase();
            return name.includes('transcript') || name.endsWith('.vtt') || name.endsWith('.docx');
          });
          
          this.logger.info('Filtered transcript files', {
            count: transcriptFiles.length,
            files: transcriptFiles.map(f => ({ name: f.name, size: f.size }))
          });

          if (transcriptFiles.length > 0) {
            // Sort by creation date (newest first)
            transcriptFiles.sort((a, b) => 
              new Date(b.createdDateTime) - new Date(a.createdDateTime)
            );

            const transcriptFile = transcriptFiles[0];
            this.logger.info('Downloading transcript file', {
              name: transcriptFile.name,
              id: transcriptFile.id,
              size: transcriptFile.size
            });

            // Download the transcript content
            const transcriptContent = await client
              .api(`/me/drive/items/${transcriptFile.id}/content`)
              .getStream();

            // Convert stream to string
            const chunks = [];
            for await (const chunk of transcriptContent) {
              chunks.push(chunk);
            }
            const transcriptText = Buffer.concat(chunks).toString('utf-8');

            this.logger.info('Transcript downloaded successfully', {
              size: transcriptText.length
            });

            return {
              transcript: transcriptText,
              copilotNotes: null,  // Copilot notes may be in a separate file or not available
              metadata: {
                transcriptId: transcriptFile.id,
                createdDateTime: transcriptFile.createdDateTime,
                meetingId: event.id,
                fileName: transcriptFile.name
              }
            };
          }
        }
      } catch (searchError) {
        this.logger.warn('Could not search OneDrive for transcripts', {
          error: searchError.message
        });
      }

      // If not found in OneDrive, return null
      this.logger.info('No transcript found', { meetingId });
      return null;

    } catch (error) {
      this.logger.error('Failed to fetch meeting transcript', {
        userId,
        meetingId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(userId) {
    try {
      const client = await this._getGraphClient(userId);

      this.logger.info('Fetching user profile', { userId });

      const user = await client
        .api('/me')
        .select('displayName,mail,userPrincipalName,id')
        .get();

      this.logger.info('User profile fetched', {
        userId,
        email: user.mail
      });

      return {
        id: user.id,
        displayName: user.displayName,
        email: user.mail || user.userPrincipalName
      };

    } catch (error) {
      this.logger.error('Failed to fetch user profile', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search calendar events by query
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Matching events
   */
  async searchCalendarEvents(userId, query, options = {}) {
    try {
      const client = await this._getGraphClient(userId);

      this.logger.info('Searching calendar events', { userId, query });

      const response = await client
        .api('/me/events')
        .filter(`contains(subject,'${query}') or contains(bodyPreview,'${query}')`)
        .top(options.maxResults || 20)
        .orderby('start/dateTime desc')
        .select('id,subject,start,end,attendees,isOnlineMeeting,onlineMeetingUrl')
        .get();

      this.logger.info('Calendar events search completed', {
        userId,
        query,
        count: response.value?.length || 0
      });

      return response.value || [];

    } catch (error) {
      this.logger.error('Failed to search calendar events', {
        userId,
        query,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get event by ID
   * @param {string} userId - User ID
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Event details
   */
  async getEvent(userId, eventId) {
    try {
      const client = await this._getGraphClient(userId);

      this.logger.info('Fetching event details', { userId, eventId });

      const event = await client
        .api(`/me/events/${eventId}`)
        .select('id,subject,start,end,attendees,isOnlineMeeting,onlineMeetingUrl,body,location')
        .get();

      this.logger.info('Event details fetched', { userId, eventId });

      return event;

    } catch (error) {
      this.logger.error('Failed to fetch event details', {
        userId,
        eventId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = StandaloneMicrosoftService;


