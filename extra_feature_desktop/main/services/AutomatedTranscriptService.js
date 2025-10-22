/**
 * Automated Transcript Service
 * 
 * Automatically fetches Teams meeting transcripts using Microsoft Graph API:
 * - Uses onlineMeeting ID (not calendar event ID)
 * - Fetches both raw transcript (VTT) and Copilot notes
 * - Handles multiple transcript formats
 * - Implements retry logic for transcript availability
 * - Falls back to OneDrive search if direct API fails
 */

const winston = require('winston');

class AutomatedTranscriptService {
  constructor({ microsoftService, supabaseAdapter, webhookService, logger }) {
    this.microsoftService = microsoftService;
    this.supabaseAdapter = supabaseAdapter;
    this.webhookService = webhookService;
    this.logger = logger || this._createLogger();
    
    // Listen for webhook notifications if webhook service is provided
    if (this.webhookService) {
      this.webhookService.on('transcript-available', (data) => {
        this._handleTranscriptNotification(data);
      });
      this.logger.info('Listening for transcript webhook notifications');
    }
    
    this.logger.info('Automated Transcript Service initialized');
  }

  _createLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/transcript-service.log' 
        })
      ],
      defaultMeta: { service: 'automated-transcript-service' }
    });
  }

  /**
   * Handle transcript notification from webhook
   * @private
   */
  async _handleTranscriptNotification(data) {
    try {
      this.logger.info('Processing transcript webhook notification', data);

      const { userId, meetingId, transcriptId } = data;

      // Find the meeting in our database
      const { data: meetings, error } = await this.supabaseAdapter.supabase
        .from('team_meetings')
        .select('*')
        .eq('user_id', userId)
        .eq('metadata->>online_meeting_id', meetingId)
        .single();

      if (error || !meetings) {
        this.logger.warn('Meeting not found for transcript notification', {
          userId,
          meetingId,
          error: error?.message
        });
        return;
      }

      // Fetch the transcript using the provided IDs
      const result = await this.fetchTranscriptById(userId, meetingId, transcriptId);

      if (result.success) {
        // Save transcript to database
        await this._saveTranscriptToDatabase(meetings, result);
        
        this.logger.info('Transcript saved from webhook notification', {
          meetingId: meetings.meeting_id,
          transcriptId
        });
      }

    } catch (error) {
      this.logger.error('Failed to handle transcript notification', {
        error: error.message,
        data
      });
    }
  }

  /**
   * Fetch transcript by ID (called from webhook notification)
   * @param {string} userId - User ID
   * @param {string} onlineMeetingId - Online meeting ID
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<Object>} Result with transcript content
   */
  async fetchTranscriptById(userId, onlineMeetingId, transcriptId) {
    try {
      this.logger.info('Fetching transcript by ID', {
        userId,
        onlineMeetingId,
        transcriptId
      });

      const client = await this.microsoftService._getGraphClient(userId);

      // Fetch transcript content
      const transcriptContent = await this._fetchTranscriptContent(
        client,
        onlineMeetingId,
        transcriptId
      );

      // Try to fetch Copilot notes
      const copilotNotes = await this._fetchCopilotNotes(
        client,
        onlineMeetingId,
        transcriptId
      );

      return {
        success: true,
        transcript: transcriptContent,
        copilotNotes,
        metadata: {
          transcriptId,
          onlineMeetingId,
          createdDateTime: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Failed to fetch transcript by ID', {
        onlineMeetingId,
        transcriptId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        transcript: null,
        copilotNotes: null
      };
    }
  }

  /**
   * Fetch transcript and Copilot notes for a meeting
   * @param {string} userId - User ID
   * @param {Object} meeting - Meeting object from database
   * @returns {Promise<Object>} Result with transcript and notes
   */
  async fetchTranscriptForMeeting(userId, meeting) {
    try {
      const onlineMeetingId = meeting.metadata?.online_meeting_id;
      
      if (!onlineMeetingId) {
        this.logger.warn('No online meeting ID available for transcript fetch', {
          meetingId: meeting.meeting_id,
          title: meeting.title
        });
        
        return {
          success: false,
          error: 'No online meeting ID',
          transcript: null,
          copilotNotes: null
        };
      }

      this.logger.info('Fetching transcript with online meeting ID', {
        meetingId: meeting.meeting_id,
        onlineMeetingId,
        title: meeting.title
      });

      // Get Microsoft Graph client
      const client = await this.microsoftService._getGraphClient(userId);

      // Step 1: List available transcripts
      const transcripts = await this._listTranscripts(client, onlineMeetingId);

      if (!transcripts || transcripts.length === 0) {
        this.logger.info('No transcripts available via API yet', {
          onlineMeetingId
        });
        
        return {
          success: false,
          error: 'No transcripts available yet',
          transcript: null,
          copilotNotes: null
        };
      }

      // Step 2: Get the latest transcript
      const latestTranscript = transcripts[0];
      this.logger.info('Found transcript', {
        transcriptId: latestTranscript.id,
        createdDateTime: latestTranscript.createdDateTime
      });

      // Step 3: Fetch using the transcript ID
      const result = await this.fetchTranscriptById(
        userId,
        onlineMeetingId,
        latestTranscript.id
      );

      if (result.success) {
        // Save to database
        await this._saveTranscriptToDatabase(meeting, result);
      }

      return result;

    } catch (error) {
      this.logger.error('Failed to fetch transcript', {
        meetingId: meeting.meeting_id,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        transcript: null,
        copilotNotes: null
      };
    }
  }

  /**
   * Save transcript to database
   * @private
   */
  async _saveTranscriptToDatabase(meeting, transcriptResult) {
    try {
      const updatedMetadata = {
        ...meeting.metadata,
        transcript: transcriptResult.transcript,
        transcript_id: transcriptResult.metadata.transcriptId,
        copilot_notes: transcriptResult.copilotNotes,
        transcript_fetched_at: new Date().toISOString()
      };

      const { error } = await this.supabaseAdapter.supabase
        .from('team_meetings')
        .update({ metadata: updatedMetadata })
        .eq('meeting_id', meeting.meeting_id);

      if (error) throw error;

      this.logger.info('Transcript saved to database', {
        meetingId: meeting.meeting_id,
        hasTranscript: !!transcriptResult.transcript,
        hasCopilotNotes: !!transcriptResult.copilotNotes
      });

    } catch (error) {
      this.logger.error('Failed to save transcript to database', {
        meetingId: meeting.meeting_id,
        error: error.message
      });
    }
  }

  /**
   * List transcripts for an online meeting
   * @private
   */
  async _listTranscripts(client, onlineMeetingId) {
    try {
      this.logger.info('Listing transcripts', { onlineMeetingId });
      
      const response = await client
        .api(`/communications/onlineMeetings/${onlineMeetingId}/transcripts`)
        .get();

      this.logger.info('Transcripts listed', {
        count: response.value?.length || 0
      });

      return response.value || [];
    } catch (error) {
      this.logger.warn('Failed to list transcripts', {
        onlineMeetingId,
        error: error.message,
        statusCode: error.statusCode
      });
      return [];
    }
  }

  /**
   * Fetch transcript content
   * @private
   */
  async _fetchTranscriptContent(client, onlineMeetingId, transcriptId) {
    try {
      this.logger.info('Fetching transcript content', { 
        onlineMeetingId,
        transcriptId 
      });

      // Try VTT format first (includes timestamps and speaker names)
      try {
        const vttContent = await client
          .api(`/communications/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content`)
          .query({ $format: 'text/vtt' })
          .get();

        if (vttContent) {
          this.logger.info('VTT transcript fetched', {
            size: vttContent.length
          });
          return vttContent;
        }
      } catch (vttError) {
        this.logger.debug('VTT format not available, trying plain text', {
          error: vttError.message
        });
      }

      // Fall back to plain text
      const textContent = await client
        .api(`/communications/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content`)
        .get();

      this.logger.info('Text transcript fetched', {
        size: textContent?.length || 0
      });

      return textContent;

    } catch (error) {
      this.logger.error('Failed to fetch transcript content', {
        onlineMeetingId,
        transcriptId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Try to fetch Copilot notes/recap
   * @private
   */
  async _fetchCopilotNotes(client, onlineMeetingId, transcriptId) {
    try {
      this.logger.info('Fetching Copilot notes', {
        onlineMeetingId,
        transcriptId
      });

      // Get transcript metadata which may include Copilot insights
      const transcriptMeta = await client
        .api(`/communications/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}`)
        .get();

      // Check for various Copilot fields
      const copilotData = transcriptMeta.meetingOrganizer?.insights ||
                          transcriptMeta.copilotInsights ||
                          transcriptMeta.recap ||
                          transcriptMeta.summary ||
                          null;

      if (copilotData) {
        this.logger.info('Copilot notes found', {
          hasInsights: true
        });
        return JSON.stringify(copilotData, null, 2);
      }

      this.logger.debug('No Copilot notes in transcript metadata');
      return null;

    } catch (error) {
      this.logger.warn('Could not fetch Copilot notes', {
        onlineMeetingId,
        transcriptId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Fall back to searching OneDrive for transcript files
   * @private
   */
  async _fetchFromOneDrive(userId, meeting) {
    try {
      this.logger.info('Searching OneDrive for transcript', {
        meetingId: meeting.meeting_id,
        title: meeting.title
      });

      const client = await this.microsoftService._getGraphClient(userId);

      // First, try searching in the Recordings folder specifically
      let searchResult;
      try {
        searchResult = await client
          .api('/me/drive/root:/Recordings:/children')
          .select('id,name,createdDateTime,file')
          .get();
        
        this.logger.info('Checked Recordings folder', {
          filesFound: searchResult.value?.length || 0
        });
      } catch (error) {
        this.logger.debug('No Recordings folder or access denied, trying global search');
      }

      // If Recordings folder doesn't exist or is empty, do global search
      if (!searchResult || !searchResult.value || searchResult.value.length === 0) {
        const searchQuery = `${meeting.title} transcript`;
        searchResult = await client
          .api(`/me/drive/root/search(q='${encodeURIComponent(searchQuery)}')`)
          .top(20)
          .get();
      }

      if (!searchResult.value || searchResult.value.length === 0) {
        this.logger.info('No transcript files found in OneDrive');
        return {
          success: false,
          error: 'No transcript available',
          transcript: null,
          copilotNotes: null
        };
      }

      // Filter for ACTUAL TEXT transcript files (VTT, DOCX, TXT)
      // NOTE: MP4 files named "Meeting Transcript.mp4" are video files, not transcripts
      const transcriptFiles = searchResult.value.filter(f => {
        const name = f.name.toLowerCase();
        
        // Only include text-based transcript formats
        return name.endsWith('.vtt') ||  // WebVTT transcript format
               name.endsWith('.docx') ||  // Word document transcripts
               name.endsWith('.txt') ||   // Plain text transcripts
               name.endsWith('.srt');     // SubRip subtitle format
      });

      if (transcriptFiles.length === 0) {
        this.logger.info('No transcript files in search results');
        return {
          success: false,
          error: 'No transcript available',
          transcript: null,
          copilotNotes: null
        };
      }

      // Sort by creation date (newest first)
      transcriptFiles.sort((a, b) => 
        new Date(b.createdDateTime) - new Date(a.createdDateTime)
      );

      const transcriptFile = transcriptFiles[0];
      this.logger.info('Found transcript file in OneDrive', {
        fileName: transcriptFile.name,
        fileId: transcriptFile.id
      });

      // Download file content
      const response = await client
        .api(`/me/drive/items/${transcriptFile.id}/content`)
        .getStream();

      // Convert stream to string
      const chunks = [];
      for await (const chunk of response) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString('utf-8');

      this.logger.info('Transcript downloaded from OneDrive', {
        size: content.length
      });

      return {
        success: true,
        transcript: content,
        copilotNotes: null,
        metadata: {
          source: 'onedrive',
          fileName: transcriptFile.name,
          fileId: transcriptFile.id,
          createdDateTime: transcriptFile.createdDateTime
        }
      };

    } catch (error) {
      this.logger.error('Failed to fetch from OneDrive', {
        meetingId: meeting.meeting_id,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        transcript: null,
        copilotNotes: null
      };
    }
  }

  /**
   * Fetch transcript with retry logic
   * Useful for meetings that just ended - transcript may not be ready yet
   * @param {string} userId - User ID
   * @param {Object} meeting - Meeting object
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} Result
   */
  async fetchWithRetry(userId, meeting, options = {}) {
    const {
      maxRetries = 5,
      initialDelay = 2 * 60 * 1000,  // 2 minutes
      maxDelay = 15 * 60 * 1000,  // 15 minutes
      backoffMultiplier = 1.5
    } = options;

    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.logger.info('Attempting to fetch transcript', {
        meetingId: meeting.meeting_id,
        attempt,
        maxRetries
      });

      const result = await this.fetchTranscriptForMeeting(userId, meeting);

      if (result.success && result.transcript) {
        this.logger.info('Transcript fetched successfully', {
          meetingId: meeting.meeting_id,
          attempt,
          hasTranscript: !!result.transcript,
          hasCopilotNotes: !!result.copilotNotes
        });
        return result;
      }

      if (attempt < maxRetries) {
        this.logger.info('Transcript not ready, will retry', {
          meetingId: meeting.meeting_id,
          attempt,
          retryIn: `${Math.round(delay / 60000)} minutes`
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    this.logger.warn('Transcript not available after all retries', {
      meetingId: meeting.meeting_id,
      maxRetries
    });

    return {
      success: false,
      error: 'Transcript not available after multiple attempts',
      transcript: null,
      copilotNotes: null
    };
  }
}

module.exports = AutomatedTranscriptService;

