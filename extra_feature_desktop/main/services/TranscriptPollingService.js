/**
 * Transcript Polling Service
 * 
 * Simple, reliable polling for Teams meeting transcripts
 * - No webhooks required
 * - No ngrok/public URL needed
 * - No subscription limits
 * - Works offline and reconnects automatically
 * - Polls OneDrive every 2 minutes for new transcripts
 */

const winston = require('winston');
const path = require('path');

class TranscriptPollingService {
  constructor({ microsoftService, supabaseAdapter, logger }) {
    this.microsoftService = microsoftService;
    this.supabaseAdapter = supabaseAdapter;
    this.logger = logger || this._createLogger();
    this.pollingInterval = 2 * 60 * 1000; // 2 minutes
    this.pollingTimer = null;
    this.isPolling = false;
    
    this.logger.info('Transcript Polling Service initialized');
  }

  _createLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(__dirname, '../../logs/transcript-polling.log'),
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'transcript-polling' }
    });
  }

  /**
   * Start polling for transcripts
   */
  start() {
    if (this.isPolling) {
      this.logger.warn('Polling already started');
      return;
    }

    this.isPolling = true;
    this.logger.info('Starting transcript polling', { 
      interval: `${this.pollingInterval / 1000} seconds` 
    });

    // Initial poll
    this._poll();

    // Schedule recurring polls
    this.pollingTimer = setInterval(() => {
      this._poll();
    }, this.pollingInterval);
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
    this.logger.info('Stopped transcript polling');
  }

  /**
   * Poll for transcripts
   * @private
   */
  async _poll() {
    try {
      this.logger.info('Polling for new transcripts...');

      // Get all Microsoft integrations
      const { data: integrations } = await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .select('user_id')
        .eq('service_name', 'microsoft');

      if (!integrations || integrations.length === 0) {
        this.logger.info('No Microsoft integrations found');
        return;
      }

      for (const integration of integrations) {
        await this._pollUserTranscripts(integration.user_id);
      }

    } catch (error) {
      this.logger.error('Polling error', { error: error.message });
    }
  }

  /**
   * Poll transcripts for a specific user
   * @private
   */
  async _pollUserTranscripts(userId) {
    try {
      // Find recent meetings that might have transcripts
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: meetings, error } = await this.supabaseAdapter.supabase
        .from('team_meetings')
        .select('*')
        .eq('user_id', userId)
        .gte('end_time', twentyFourHoursAgo.toISOString())
        .lt('end_time', new Date().toISOString()) // Meeting must have ended
        .is('metadata->transcript', null); // No transcript yet

      if (error) {
        this.logger.error('Failed to fetch meetings', { error: error.message });
        return;
      }

      if (!meetings || meetings.length === 0) {
        this.logger.info('No meetings waiting for transcripts', { userId });
        return;
      }

      // Filter for Teams meetings only
      const teamsMeetings = meetings.filter(m => 
        m.metadata?.platform === 'microsoft' && 
        m.metadata?.online_meeting_id
      );

      if (teamsMeetings.length === 0) {
        this.logger.info('No Teams meetings waiting for transcripts', { userId });
        return;
      }

      this.logger.info('Checking for transcripts', { 
        userId,
        meetingCount: teamsMeetings.length
      });

      // Check each meeting for transcripts
      for (const meeting of teamsMeetings) {
        await this._checkMeetingTranscript(userId, meeting);
      }

    } catch (error) {
      this.logger.error('Failed to poll user transcripts', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * Check if a meeting has transcripts available
   * @private
   */
  async _checkMeetingTranscript(userId, meeting) {
    try {
      const onlineMeetingId = meeting.metadata?.online_meeting_id;
      
      if (!onlineMeetingId) {
        return;
      }

      this.logger.info('Checking meeting for transcript', {
        meetingId: meeting.meeting_id,
        title: meeting.title,
        onlineMeetingId
      });

      // Try to get transcript from OneDrive
      const transcript = await this._searchOneDriveForTranscript(
        userId,
        meeting.title,
        meeting.start_time
      );

      if (transcript) {
        // Save transcript to database
        await this._saveTranscript(meeting, transcript);
        
        this.logger.info('✅ Transcript found and saved!', {
          meetingId: meeting.meeting_id,
          title: meeting.title
        });
      } else {
        this.logger.debug('No transcript available yet', {
          meetingId: meeting.meeting_id,
          title: meeting.title
        });
      }

    } catch (error) {
      this.logger.error('Failed to check meeting transcript', {
        meetingId: meeting.meeting_id,
        error: error.message
      });
    }
  }

  /**
   * Search OneDrive for transcript file
   * @private
   */
  async _searchOneDriveForTranscript(userId, meetingTitle, meetingStartTime) {
    try {
      const client = await this.microsoftService._getGraphClient(userId);

      // Search for transcript files in OneDrive
      // Format: "Meeting-Title-YYYYMMDD.vtt" or "Meeting Transcript.docx"
      const searchQuery = `${meetingTitle.split(' ')[0]}`;
      
      const searchResult = await client
        .api('/me/drive/root/search(q=\'{query}\')')
        .expand('q=' + encodeURIComponent(searchQuery))
        .top(50)
        .get();

      if (!searchResult.value || searchResult.value.length === 0) {
        return null;
      }

      // Filter for transcript files created after the meeting
      const meetingDate = new Date(meetingStartTime);
      const transcriptFiles = searchResult.value.filter(file => {
        const fileName = file.name.toLowerCase();
        const fileDate = new Date(file.createdDateTime);
        
        // Must be a transcript file
        // Microsoft Teams stores transcripts as small MP4 files named "Meeting Transcript.mp4"
        const isTranscript = fileName.endsWith('.vtt') ||
                           fileName.endsWith('.docx') ||
                           fileName.endsWith('.txt') ||
                           fileName.endsWith('.srt') ||
                           (fileName.includes('meeting transcript') && fileName.endsWith('.mp4') && file.size < 100000); // Small MP4 = transcript
        
        // Must be created after meeting started
        const isAfterMeeting = fileDate >= meetingDate;
        
        return isTranscript && isAfterMeeting;
      });

      if (transcriptFiles.length === 0) {
        return null;
      }

      // Get the most recent transcript file
      const latestFile = transcriptFiles.sort((a, b) => 
        new Date(b.createdDateTime) - new Date(a.createdDateTime)
      )[0];

      this.logger.info('Found transcript file', {
        fileName: latestFile.name,
        fileId: latestFile.id,
        createdAt: latestFile.createdDateTime
      });

      // Download the transcript content
      const content = await client
        .api(`/me/drive/items/${latestFile.id}/content`)
        .get();

      return {
        content: content.toString(),
        fileName: latestFile.name,
        createdAt: latestFile.createdDateTime
      };

    } catch (error) {
      this.logger.warn('OneDrive search failed', {
        error: error.message,
        meetingTitle
      });
      return null;
    }
  }

  /**
   * Save transcript to database
   * @private
   */
  async _saveTranscript(meeting, transcript) {
    try {
      const updatedMetadata = {
        ...meeting.metadata,
        transcript: transcript.content,
        transcript_file_name: transcript.fileName,
        transcript_fetched_at: new Date().toISOString(),
        transcript_created_at: transcript.createdAt
      };

      const { error } = await this.supabaseAdapter.supabase
        .from('team_meetings')
        .update({ 
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('meeting_id', meeting.meeting_id);

      if (error) {
        throw error;
      }

      this.logger.info('Transcript saved to database', {
        meetingId: meeting.meeting_id
      });

    } catch (error) {
      this.logger.error('Failed to save transcript', {
        meetingId: meeting.meeting_id,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = TranscriptPollingService;

