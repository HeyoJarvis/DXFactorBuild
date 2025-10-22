/**
 * Background Sync Service
 * 
 * Automatically syncs data from integrations to database in background
 * - Fetches meetings from Outlook every 15 minutes
 * - Preserves manual flags (like is_important)
 * - Runs silently without UI interaction
 */

const winston = require('winston');
const EventEmitter = require('events');

class BackgroundSyncService extends EventEmitter {
  constructor({ meetingIntelligenceService, transcriptPollingService, taskIntelligenceService, logger }) {
    super(); // Initialize EventEmitter
    this.meetingIntelligenceService = meetingIntelligenceService;
    this.transcriptPollingService = transcriptPollingService; // Polling service (runs independently)
    this.taskIntelligenceService = taskIntelligenceService;
    this.logger = logger || this._createLogger();
    
    this.syncInterval = 2 * 60 * 1000; // 2 minutes - frequent sync for responsive updates
    this.intervalId = null;
    this.currentUserId = null;
    
    this.logger.info('Background Sync Service initialized', {
      hasTranscriptPolling: !!this.transcriptPollingService,
      hasTaskService: !!this.taskIntelligenceService
    });
  }

  _createLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/background-sync.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'background-sync' }
    });
  }

  /**
   * Start background sync for a user
   * @param {string} userId - User ID
   */
  start(userId) {
    if (this.intervalId) {
      this.stop();
    }

    this.currentUserId = userId;
    
    // Do initial sync immediately
    this._syncMeetings();
    
    // Then sync every 15 minutes
    this.intervalId = setInterval(() => {
      this._syncMeetings();
    }, this.syncInterval);

    this.logger.info('Background sync started', { 
      userId, 
      interval: `${this.syncInterval / 60000} minutes` 
    });
  }

  /**
   * Stop background sync
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Background sync stopped', { userId: this.currentUserId });
    }
  }

  /**
   * Sync meetings and updates from Outlook/JIRA/GitHub to database
   */
  async _syncMeetings() {
    if (!this.currentUserId) return;

    try {
      this.logger.info('Background sync: Syncing meetings and updates', { 
        userId: this.currentUserId 
      });

      // Fetch upcoming meetings from Outlook (next 30 days)
      await this.meetingIntelligenceService.getUpcomingMeetings(
        this.currentUserId, 
        { 
          days: 30,
          saveToDatabase: true 
        }
      );

      // Transcript polling service handles transcript fetching automatically
      // No need to manually fetch transcripts here

      // Sync JIRA and GitHub updates (NEW!)
      if (this.taskIntelligenceService) {
        try {
          await this.taskIntelligenceService.fetchAllUpdates(
            this.currentUserId,
            { days: 7 }
          );
          this.logger.info('Background sync: JIRA/GitHub updates synced', {
            userId: this.currentUserId
          });
        } catch (updateError) {
          this.logger.warn('Background sync: Failed to sync updates', {
            userId: this.currentUserId,
            error: updateError.message
          });
          // Don't throw - let meetings sync succeed even if updates fail
        }
      }

      this.logger.info('Background sync: All data synced successfully', { 
        userId: this.currentUserId 
      });

      // Notify frontend that sync completed (for real-time updates)
      this.emit('sync-completed', {
        userId: this.currentUserId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Background sync: Failed to sync', {
        userId: this.currentUserId,
        error: error.message
      });
    }
  }

  /**
   * Check for ALL meetings that have ended and fetch transcripts
   * Now fetches transcripts for ALL Teams meetings, not just important ones
   */
  async _fetchCopilotForEndedMeetings() {
    // DEPRECATED: Now handled by TranscriptPollingService
    this.logger.debug('Transcript fetching handled by polling service');
    return;
    
    /* OLD CODE - DISABLED
    if (!this.currentUserId) return;

    try {
      this.logger.info('Background sync: Checking for meetings needing transcripts', {
        userId: this.currentUserId
      });

      // Get ALL meetings that:
      // 1. Have ended (end_time < now)
      // 2. Have an online meeting ID (Teams meetings with transcript capability)
      // 3. Don't have transcript yet
      // 4. Ended within last 7 days (transcripts may take time to generate)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      const { data: meetings, error} = await this.meetingIntelligenceService.supabaseAdapter.supabase
        .from('team_meetings')
        .select('meeting_id, title, end_time, start_time, metadata')
        .eq('user_id', this.currentUserId)
        .lt('end_time', now)  // Meeting has ended
        .gte('end_time', sevenDaysAgo);  // Ended within last 7 days

      if (error) {
        this.logger.warn('Failed to query meetings for transcript sync', {
          error: error.message
        });
        return;
      }

      if (!meetings || meetings.length === 0) {
        this.logger.debug('No meetings found for transcript sync');
        return;
      }

      // Filter for:
      // 1. Teams meetings (platform = 'microsoft') with online_meeting_id (needed for API access)
      // 2. Don't already have transcript
      const teamsMeetings = meetings.filter(m =>
        m.metadata?.platform === 'microsoft' &&
        m.metadata?.online_meeting_id &&
        !m.metadata?.transcript
      );

      this.logger.info('Found meetings needing transcripts', {
        count: teamsMeetings.length,
        meetings: teamsMeetings.map(m => ({
          title: m.title,
          ended: m.end_time,
          hasOnlineMeetingId: !!m.metadata?.online_meeting_id
        }))
      });

      // Fetch transcripts for each meeting using automated service
      for (const meeting of teamsMeetings) {
        try {
          this.logger.info('Fetching transcript for meeting', {
            meeting_id: meeting.meeting_id,
            title: meeting.title,
            onlineMeetingId: meeting.metadata?.online_meeting_id
          });

          // Calculate how long ago the meeting ended
          const meetingEndTime = new Date(meeting.end_time);
          const now = new Date();
          const minutesSinceEnd = Math.floor((now - meetingEndTime) / (60 * 1000));

          // Try to fetch transcript
          const result = await this.automatedTranscriptService.fetchTranscriptForMeeting(
            this.currentUserId,
            meeting
          );

          if (result.success && result.transcript) {
            this.logger.info('Transcript found, saving to database', {
              meeting_id: meeting.meeting_id,
              title: meeting.title,
              transcriptLength: result.transcript.length,
              hasCopilotNotes: !!result.copilotNotes,
              source: result.metadata?.source
            });

            // Save to database
            await this._saveTranscriptToDatabase(meeting.meeting_id, result);

            this.logger.info('Transcript processed successfully', {
              meeting_id: meeting.meeting_id,
              title: meeting.title
            });
          } else {
            this.logger.debug('No transcript available yet', {
              meeting_id: meeting.meeting_id,
              title: meeting.title,
              minutesSinceEnd,
              reason: result.error
            });

            // For recently ended meetings, we'll retry on next sync cycle (15 min)
            if (minutesSinceEnd < 120) {  // Within 2 hours
              this.logger.info('Meeting ended recently, will retry on next sync', {
                meeting_id: meeting.meeting_id,
                minutesSinceEnd
              });
            }
          }

        } catch (error) {
          this.logger.warn('Failed to fetch transcript for meeting', {
            meeting_id: meeting.meeting_id,
            error: error.message
          });
          // Continue with next meeting
        }
      }

    } catch (error) {
      this.logger.error('Background sync: Failed to fetch Copilot transcripts', {
        error: error.message
      });
    }
    */
  }

  /**
   * Save transcript to database
   * @private
   */
  async _saveTranscriptToDatabase(meetingId, result) {
    try {
      const updateData = {};

      // Store raw transcript in metadata
      if (result.transcript) {
        updateData['metadata->transcript'] = result.transcript;
        if (result.metadata?.transcriptId) {
          updateData['metadata->transcript_id'] = result.metadata.transcriptId;
        }
        if (result.metadata?.createdDateTime) {
          updateData['metadata->transcript_created_at'] = result.metadata.createdDateTime;
        }
      }

      // Store Copilot notes in dedicated field
      if (result.copilotNotes) {
        updateData.copilot_notes = result.copilotNotes;
      }

      const { error } = await this.meetingIntelligenceService.supabaseAdapter.supabase
        .from('team_meetings')
        .update(updateData)
        .eq('user_id', this.currentUserId)
        .eq('meeting_id', meetingId);

      if (error) throw error;

      // Generate AI summary from transcript if Copilot notes not available
      if (result.transcript && !result.copilotNotes) {
        this.logger.info('Generating AI summary from transcript', { meetingId });
        await this.meetingIntelligenceService.generateSummaryFromTranscript(
          this.currentUserId,
          meetingId,
          result.transcript
        );
      }

      this.logger.info('Transcript saved to database', {
        meetingId,
        hasTranscript: !!result.transcript,
        hasCopilotNotes: !!result.copilotNotes
      });

    } catch (error) {
      this.logger.error('Failed to save transcript to database', {
        meetingId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start aggressive retry for recently ended meeting using automated service
   * @private
   */
  _startAggressiveRetryAutomated(meeting) {
    if (!this.currentUserId) return;

    // Track ongoing retries to avoid duplicates
    if (!this.activeRetries) {
      this.activeRetries = new Set();
    }

    if (this.activeRetries.has(meeting.meeting_id)) {
      this.logger.debug('Aggressive retry already running for meeting', { 
        meetingId: meeting.meeting_id 
      });
      return;
    }

    this.activeRetries.add(meeting.meeting_id);

    this.logger.info('Starting automated aggressive retry in background', {
      meetingId: meeting.meeting_id,
      title: meeting.title
    });

    // Run fetchWithRetry in background
    this.automatedTranscriptService.fetchWithRetry(
      this.currentUserId,
      meeting,
      {
        maxRetries: 10,
        initialDelay: 2 * 60 * 1000, // 2 minutes
        maxDelay: 30 * 60 * 1000, // 30 minutes
        backoffMultiplier: 1.5
      }
    ).then(async (result) => {
      this.activeRetries.delete(meeting.meeting_id);
      
      if (result.success && result.transcript) {
        this.logger.info('Automated aggressive retry succeeded', {
          meetingId: meeting.meeting_id,
          title: meeting.title
        });

        // Save to database
        await this._saveTranscriptToDatabase(meeting.meeting_id, result);
      } else {
        this.logger.warn('Automated aggressive retry exhausted all attempts', {
          meetingId: meeting.meeting_id,
          title: meeting.title,
          error: result.error
        });
      }
    }).catch((error) => {
      this.activeRetries.delete(meeting.meeting_id);
      this.logger.error('Automated aggressive retry failed', {
        meetingId: meeting.meeting_id,
        error: error.message
      });
    });
  }

  /**
   * Start aggressive retry for a meeting that just ended (legacy method)
   * Runs in background with exponential backoff
   * @param {string} meetingId - Meeting ID
   * @param {string} title - Meeting title
   * @deprecated Use _startAggressiveRetryAutomated instead
   */
  _startAggressiveRetry(meetingId, title) {
    if (!this.currentUserId) return;

    // Track ongoing retries to avoid duplicates
    if (!this.activeRetries) {
      this.activeRetries = new Set();
    }

    if (this.activeRetries.has(meetingId)) {
      this.logger.debug('Aggressive retry already running for meeting', { meetingId });
      return;
    }

    this.activeRetries.add(meetingId);

    this.logger.info('Starting aggressive retry in background', {
      meetingId,
      title
    });

    // Run fetchCopilotNotesWithRetry in background
    this.meetingIntelligenceService.fetchCopilotNotesWithRetry(
      this.currentUserId,
      meetingId,
      {
        maxRetries: 10,
        initialDelay: 2 * 60 * 1000, // 2 minutes
        maxDelay: 30 * 60 * 1000, // 30 minutes
        backoffMultiplier: 1.5
      }
    ).then((result) => {
      this.activeRetries.delete(meetingId);
      
      if (result.success) {
        this.logger.info('Aggressive retry succeeded', {
          meetingId,
          title
        });
      } else {
        this.logger.warn('Aggressive retry exhausted all attempts', {
          meetingId,
          title
        });
      }
    }).catch((error) => {
      this.activeRetries.delete(meetingId);
      this.logger.error('Aggressive retry failed', {
        meetingId,
        error: error.message
      });
    });
  }

  /**
   * Force immediate sync
   */
  async syncNow() {
    await this._syncMeetings();
  }
}

module.exports = BackgroundSyncService;

