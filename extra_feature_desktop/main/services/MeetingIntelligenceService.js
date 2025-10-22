/**
 * Meeting Intelligence Service
 * 
 * Manages meeting detection, summarization, and intelligence:
 * - Fetches calendar events from Microsoft Graph
 * - Smart meeting detection (importance scoring)
 * - Microsoft Copilot integration for notes
 * - Manual notes upload support
 * - AI-powered summary generation
 * - Stores meeting data in Supabase
 */

const winston = require('winston');
const EventEmitter = require('events');
const fetch = require('node-fetch');

class MeetingIntelligenceService extends EventEmitter {
  constructor({ microsoftService, supabaseAdapter, logger }) {
    super();
    
    this.microsoftService = microsoftService;
    this.supabaseAdapter = supabaseAdapter;
    this.logger = logger || this._createLogger();
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    
    this.logger.info('Meeting Intelligence Service initialized');
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
          filename: 'logs/meeting-intelligence.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'meeting-intelligence' }
    });
  }

  /**
   * Fetch upcoming meetings from Microsoft Calendar
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   */
  async getUpcomingMeetings(userId, options = {}) {
    try {
      const { days = 14, saveToDatabase = true } = options;

      this.logger.info('Fetching upcoming meetings', { userId, days });

      // Use the standalone Microsoft service
      const events = await this.microsoftService.getUpcomingEvents(userId, { days });

      this.logger.info('Raw events from Microsoft', {
        count: events.length,
        sample: events.slice(0, 2).map(e => ({
          subject: e.subject,
          isOnlineMeeting: e.isOnlineMeeting,
          hasOnlineMeeting: !!e.onlineMeeting,
          hasOnlineMeetingUrl: !!e.onlineMeetingUrl,
          onlineMeetingJoinUrl: e.onlineMeeting?.joinUrl,
          onlineMeetingUrl: e.onlineMeetingUrl
        }))
      });

      // Transform and score meetings
      const meetings = events.map(event => this._transformMeeting(event));

      // Save ALL meetings to database automatically (not just important ones)
      if (saveToDatabase) {
        const meetingsToSave = meetings; // Save ALL meetings, not just important
        for (const meeting of meetingsToSave) {
          try {
            // Check if meeting already exists to preserve manual importance flag
            const { data: existing } = await this.supabaseAdapter.supabase
              .from('team_meetings')
              .select('is_important')
              .eq('user_id', userId)
              .eq('meeting_id', meeting.meeting_id)
              .single();
            
            // Preserve manual importance flag if it was set, otherwise use auto-calculated
            const isImportant = existing?.is_important ?? (meeting.importance_score >= 70);
            
            const meetingToSave = {
              user_id: userId,
              meeting_id: meeting.meeting_id,
              title: meeting.title,
              start_time: meeting.start_time,
              end_time: meeting.end_time,
              attendees: meeting.attendees,
              is_important: isImportant,
              metadata: {
                importance_score: meeting.importance_score,
                platform: meeting.online_meeting_url ? 'microsoft' : null,  // Moved to metadata
                online_meeting_url: meeting.online_meeting_url,
                online_meeting_id: meeting.online_meeting_id,  // CRITICAL for transcript access
                location: meeting.location,
                organizer: meeting.organizer
              }
            };

            this.logger.info('Upserting meeting', {
              title: meeting.title,
              meeting_id: meeting.meeting_id,
              has_online_url: !!meeting.online_meeting_url,
              online_url: meeting.online_meeting_url
            });
            
            // Use update instead of upsert for existing meetings to ensure all fields are updated
            const { data: updateResult, error: updateError } = await this.supabaseAdapter.supabase
              .from('team_meetings')
              .update(meetingToSave)
              .eq('user_id', userId)
              .eq('meeting_id', meeting.meeting_id)
              .select();

            if (updateError) {
              this.logger.warn('Update failed, trying insert', {
                error: updateError.message
              });
            }

            // If no rows updated, it's a new meeting, so insert it
            if (!updateError && (!updateResult || updateResult.length === 0)) {
              const { error: insertError } = await this.supabaseAdapter.supabase
                .from('team_meetings')
                .insert(meetingToSave);

              if (insertError) {
                this.logger.warn('Insert also failed', {
                  error: insertError.message
                });
              }
            }
          } catch (dbError) {
            this.logger.warn('Failed to save meeting to database', {
              meetingId: meeting.meeting_id,
              error: dbError.message
            });
          }
        }
        
        this.logger.info('Saved meetings to database', {
          userId,
          saved: meetingsToSave.length
        });
      }

      this.logger.info('Meetings fetched and scored', {
        userId,
        total: meetings.length,
        important: meetings.filter(m => m.importance_score >= 70).length
      });

      return {
        success: true,
        meetings
      };

    } catch (error) {
      this.logger.error('Failed to fetch meetings', {
        userId,
        error: error.message
      });
      return {
        success: false,
        error: error.message,
        meetings: []
      };
    }
  }

  /**
   * Transform and score meeting importance
   */
  _transformMeeting(event) {
    // Handle both old and new API field names for Teams meeting URL
    const onlineMeetingUrl = event.onlineMeeting?.joinUrl || event.onlineMeetingUrl || null;

    // Extract online meeting ID from join URL for transcript access
    // Format: https://teams.microsoft.com/l/meetup-join/19%3ameeting_XXX%40thread.v2/...
    let onlineMeetingId = event.onlineMeeting?.id || null;

    if (!onlineMeetingId && onlineMeetingUrl) {
      // Extract from URL encoded format
      let match = onlineMeetingUrl.match(/19%3ameeting_([^%]+)%40thread\.v2/);
      if (match) {
        onlineMeetingId = `19:meeting_${match[1]}@thread.v2`;
      } else {
        // Try non-encoded format
        match = onlineMeetingUrl.match(/19:meeting_([^@]+)@thread\.v2/);
        if (match) {
          onlineMeetingId = `19:meeting_${match[1]}@thread.v2`;
        }
      }
    }

    // Debug logging to see what we're getting
    if (event.isOnlineMeeting && !onlineMeetingUrl) {
      this.logger.warn('Meeting marked as online but no URL found', {
        subject: event.subject,
        isOnlineMeeting: event.isOnlineMeeting,
        hasOnlineMeeting: !!event.onlineMeeting,
        hasOnlineMeetingUrl: !!event.onlineMeetingUrl
      });
    }

    if (onlineMeetingUrl) {
      this.logger.info('Teams meeting detected', {
        subject: event.subject,
        hasUrl: true,
        extractedId: !!onlineMeetingId,
        onlineMeetingId: onlineMeetingId
      });
    }
    
    // Database uses "timestamp without timezone" - just store the raw time from Microsoft
    // Microsoft already returns times in UTC, database will store literally
    // Frontend will add 'Z' suffix when parsing
    const normalizedStartTime = event.start?.dateTime;
    const normalizedEndTime = event.end?.dateTime;
    const startTimezone = event.start?.timeZone || 'UTC';
    const endTimezone = event.end?.timeZone || 'UTC';
    
    const meeting = {
      meeting_id: event.id,
      title: event.subject,
      start_time: normalizedStartTime,
      end_time: normalizedEndTime,
      start_timezone: startTimezone,
      end_timezone: endTimezone,
      attendees: event.attendees?.map(a => ({
        name: a.emailAddress?.name,
        email: a.emailAddress?.address,
        response: a.status?.response
      })) || [],
      location: event.location?.displayName,
      online_meeting_url: onlineMeetingUrl,
      online_meeting_id: onlineMeetingId,  // Store this for automated transcript access
      organizer: event.organizer?.emailAddress?.name,
      is_recurring: event.recurrence !== null,
      body: event.body?.content,
      importance_score: this.calculateMeetingImportance(event)
    };

    return meeting;
  }

  /**
   * Calculate meeting importance score (0-100)
   */
  calculateMeetingImportance(meeting) {
    let score = 50; // Base score
    
    const title = (meeting.subject || '').toLowerCase();
    const body = (meeting.body?.content || '').toLowerCase();
    
    // High priority keywords
    const highPriorityKeywords = [
      'standup', 'stand-up', 'sprint', 'planning', 'review', 
      'demo', 'all-hands', 'all hands', 'retrospective', 'retro',
      'sync', 'alignment', 'strategy', 'roadmap', 'quarterly'
    ];
    
    // Low priority keywords
    const lowPriorityKeywords = [
      '1:1', 'one-on-one', 'coffee', 'social', 'lunch', 
      'happy hour', 'birthday', 'celebration'
    ];
    
    // Check high priority keywords
    if (highPriorityKeywords.some(k => title.includes(k) || body.includes(k))) {
      score += 30;
    }
    
    // Check low priority keywords
    if (lowPriorityKeywords.some(k => title.includes(k) || body.includes(k))) {
      score -= 20;
    }
    
    // Participant count boost
    const attendeeCount = meeting.attendees?.length || 0;
    if (attendeeCount >= 5) score += 20;
    if (attendeeCount >= 10) score += 10;
    if (attendeeCount >= 20) score += 5;
    
    // Recurring meetings get slight boost (likely important if scheduled regularly)
    if (meeting.recurrence) score += 10;
    
    // Online meeting presence suggests importance
    if (meeting.onlineMeeting?.joinUrl) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Save or update meeting in database
   */
  async saveMeeting(userId, meetingData, options = {}) {
    try {
      const {
        is_important = meetingData.importance_score >= 70,
        copilot_notes = null,
        manual_notes = null,
        fetchCopilot = true
      } = options;

      this.logger.info('Saving meeting', {
        meeting_id: meetingData.meeting_id,
        is_important
      });

      const result = await this.supabaseAdapter.saveMeeting({
        user_id: userId,
        meeting_id: meetingData.meeting_id,
        title: meetingData.title,
        start_time: meetingData.start_time,
        end_time: meetingData.end_time,
        attendees: meetingData.attendees,
        is_important,
        copilot_notes,
        manual_notes,
        metadata: {
          location: meetingData.location,
          organizer: meetingData.organizer,
          online_meeting_url: meetingData.online_meeting_url,
          online_meeting_id: meetingData.online_meeting_id,  // CRITICAL: Store for automated transcript access
          importance_score: meetingData.importance_score
        }
      });

      // Note: Copilot transcripts will be automatically fetched by background sync
      // after the meeting ends (see BackgroundSyncService)

      return result;

    } catch (error) {
      this.logger.error('Failed to save meeting', {
        meeting_id: meetingData.meeting_id,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch Copilot transcript in background
   */
  async _fetchCopilotInBackground(userId, meetingId) {
    try {
      // Wait a bit for meeting to end and transcript to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const copilotResult = await this.fetchCopilotNotes(userId, meetingId);
      
      if (copilotResult.success && copilotResult.notes) {
        this.logger.info('Copilot transcript fetched, generating summary', {
          meeting_id: meetingId
        });
        
        // Upload notes and generate summary
        await this.uploadManualNotes(userId, meetingId, copilotResult.notes);
        await this.generateSummary(userId, meetingId);
        
        this.logger.info('Copilot transcript processed successfully', {
          meeting_id: meetingId
        });
      }
    } catch (error) {
      // Silent fail - don't block the main flow
      this.logger.warn('Background Copilot processing failed', {
        meeting_id: meetingId,
        error: error.message
      });
    }
  }

  /**
   * Upload manual notes for a meeting
   */
  async uploadManualNotes(userId, meetingId, notes) {
    try {
      this.logger.info('Uploading manual notes', { meetingId });

      const result = await this.supabaseAdapter.updateMeetingNotes(
        meetingId,
        { manual_notes: notes }
      );

      if (result.success) {
        // Trigger AI summary generation
        await this.generateSummary(userId, meetingId);
      }

      return result;

    } catch (error) {
      this.logger.error('Failed to upload manual notes', {
        meetingId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if meeting is configured for Copilot transcript
   * @param {string} userId - User ID
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object>} Configuration check results
   */
  async checkMeetingCopilotReadiness(userId, meetingId) {
    try {
      this.logger.info('Checking meeting Copilot readiness', { userId, meetingId });

      // Get meeting from database first
      const meetingData = await this.supabaseAdapter.getMeeting(meetingId);
      
      if (!meetingData.success) {
        return {
          success: false,
          error: 'Meeting not found in database'
        };
      }

      const meeting = meetingData.meeting;
      const metadata = meeting.metadata || {};
      const isTeamsMeeting = !!metadata.online_meeting_url;

      const checks = {
        meetingId: meetingId,
        title: meeting.title,
        isTeamsMeeting: isTeamsMeeting,
        hasOnlineMeetingUrl: isTeamsMeeting,
        checks: {
          isOnlineMeeting: {
            status: isTeamsMeeting ? 'pass' : 'fail',
            message: isTeamsMeeting 
              ? '✅ This is a Teams meeting' 
              : '❌ Not a Teams meeting - Copilot not available'
          },
          recordingPolicy: {
            status: 'unknown',
            message: '⚠️ Cannot verify recording settings via API. Ensure recording is enabled in Teams.'
          },
          copilotLicense: {
            status: 'unknown',
            message: '⚠️ Cannot verify Copilot license via API. Ensure you have Microsoft 365 Copilot license.'
          }
        },
        recommendations: []
      };

      // Generate recommendations
      if (!isTeamsMeeting) {
        checks.recommendations.push(
          'Convert this to a Teams meeting to enable Copilot transcripts'
        );
      } else {
        checks.recommendations.push(
          'Start recording when the meeting begins',
          'Ensure Copilot is enabled in your Teams settings',
          'Verify you have Microsoft 365 Copilot license'
        );
      }

      // Overall assessment
      checks.copilotLikely = isTeamsMeeting;
      checks.summary = isTeamsMeeting
        ? '✅ Meeting is configured as Teams meeting. Copilot transcripts should be available if recording is enabled.'
        : '❌ This is not a Teams meeting. Copilot transcripts will not be available.';

      this.logger.info('Meeting Copilot readiness check complete', {
        meetingId,
        isTeamsMeeting,
        copilotLikely: checks.copilotLikely
      });

      return {
        success: true,
        ...checks
      };

    } catch (error) {
      this.logger.error('Failed to check meeting Copilot readiness', {
        userId,
        meetingId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Attempt to fetch Copilot notes and transcript from Microsoft
   * @param {string} userId - User ID
   * @param {string} meetingId - Meeting ID
   */
  async fetchCopilotNotes(userId, meetingId) {
    try {
      this.logger.info('Attempting to fetch Copilot notes and transcript', { userId, meetingId });

      // Use the standalone Microsoft service to get both transcript and Copilot notes
      const result = await this.microsoftService.getMeetingTranscript(userId, meetingId);

      if (result && result.transcript) {
        this.logger.info('Meeting content fetched successfully', { 
          userId, 
          meetingId,
          hasTranscript: !!result.transcript,
          hasCopilotNotes: !!result.copilotNotes,
          transcriptId: result.metadata?.transcriptId
        });

        // Save both transcript and Copilot notes to database
        await this._saveMeetingContent(userId, meetingId, result);

        return {
          success: true,
          transcript: result.transcript,
          copilotNotes: result.copilotNotes,
          metadata: result.metadata
        };
      } else {
        this.logger.info('No meeting content available', { userId, meetingId });
        
        return {
          success: false,
          error: 'No meeting content available. This may be because:\n- The meeting hasn\'t started yet\n- Recording/transcription wasn\'t enabled\n- You don\'t have Microsoft 365 Copilot license',
          transcript: null,
          copilotNotes: null
        };
      }

    } catch (error) {
      this.logger.error('Failed to fetch meeting content', {
        userId,
        meetingId,
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
   * Save meeting transcript and Copilot notes to database
   * @private
   */
  async _saveMeetingContent(userId, meetingId, content) {
    try {
      const updateData = {};

      // Store raw transcript in metadata
      if (content.transcript) {
        updateData['metadata->transcript'] = content.transcript;
        updateData['metadata->transcript_id'] = content.metadata?.transcriptId;
        updateData['metadata->transcript_created_at'] = content.metadata?.createdDateTime;
      }

      // Store Copilot notes in dedicated field
      if (content.copilotNotes) {
        updateData.copilot_notes = content.copilotNotes;
      }

      const { error } = await this.supabaseAdapter.supabase
        .from('team_meetings')
        .update(updateData)
        .eq('user_id', userId)
        .eq('meeting_id', meetingId);

      if (error) throw error;

      this.logger.info('Meeting content saved to database', {
        userId,
        meetingId,
        hasTranscript: !!content.transcript,
        hasCopilotNotes: !!content.copilotNotes
      });

    } catch (error) {
      this.logger.error('Failed to save meeting content', {
        userId,
        meetingId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Fetch meeting content (transcript + Copilot notes) with aggressive retry logic
   * @param {string} userId - User ID
   * @param {string} meetingId - Meeting ID
   * @param {Object} options - Retry options
   */
  async fetchCopilotNotesWithRetry(userId, meetingId, options = {}) {
    const {
      maxRetries = 10,
      initialDelay = 2 * 60 * 1000, // 2 minutes
      maxDelay = 30 * 60 * 1000, // 30 minutes
      backoffMultiplier = 1.5
    } = options;

    let delay = initialDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.logger.info('Attempting to fetch meeting content with retry', {
        userId,
        meetingId,
        attempt,
        maxRetries
      });

      const result = await this.fetchCopilotNotes(userId, meetingId);
      
      // Success if we got at least the transcript
      if (result.success && result.transcript) {
        this.logger.info('Meeting content fetched successfully', {
          userId,
          meetingId,
          attempt,
          totalRetries: attempt - 1,
          hasTranscript: !!result.transcript,
          hasCopilotNotes: !!result.copilotNotes
        });

        // Generate AI summary from transcript if Copilot notes not available
        if (!result.copilotNotes && result.transcript) {
          this.logger.info('Generating AI summary from transcript', { userId, meetingId });
          const summaryResult = await this.generateSummaryFromTranscript(
            userId, 
            meetingId, 
            result.transcript
          );
          
          if (summaryResult.success) {
            this.logger.info('AI summary generated from transcript', { userId, meetingId });
          }
        }

        // Emit event for UI notification
        this.emit('copilot_fetched', {
          userId,
          meetingId,
          attempt,
          hasTranscript: !!result.transcript,
          hasCopilotNotes: !!result.copilotNotes
        });

        return result;
      }

      if (attempt < maxRetries) {
        this.logger.info('Meeting content not ready, will retry', {
          userId,
          meetingId,
          attempt,
          retryIn: `${Math.round(delay / 60000)} minutes`
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    this.logger.warn('Meeting content not available after all retries', {
      userId,
      meetingId,
      attempts: maxRetries
    });

    return {
      success: false,
      error: 'Meeting content not available after multiple attempts. It may not have been recorded.',
      transcript: null,
      copilotNotes: null
    };
  }

  /**
   * Generate AI summary from raw transcript
   * @private
   */
  async generateSummaryFromTranscript(userId, meetingId, transcript) {
    try {
      this.logger.info('Generating AI summary from transcript', { userId, meetingId });

      // Use Claude to generate summary
      const summary = await this._generateAISummary(transcript);

      if (summary) {
        // Save summary to database
        const { error } = await this.supabaseAdapter.supabase
          .from('team_meetings')
          .update({ ai_summary: summary })
          .eq('user_id', userId)
          .eq('meeting_id', meetingId);

        if (error) throw error;

        return { success: true, summary };
      }

      return { success: false, error: 'Failed to generate summary' };

    } catch (error) {
      this.logger.error('Failed to generate AI summary', {
        userId,
        meetingId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate AI summary from meeting notes
   */
  async generateSummary(userId, meetingId) {
    try {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }

      this.logger.info('Generating AI summary', { meetingId });

      // Get meeting data
      const meetingData = await this.supabaseAdapter.getMeeting(meetingId);
      if (!meetingData.success) {
        throw new Error('Meeting not found');
      }

      const meeting = meetingData.meeting;
      const notes = meeting.copilot_notes || meeting.manual_notes;

      if (!notes) {
        throw new Error('No notes available for summarization');
      }

      // Call Claude API for summarization
      const systemPrompt = `You are an AI assistant that summarizes meeting notes.

Your task is to analyze meeting notes and extract:
1. Key Decisions - Important decisions that were made
2. Action Items - Tasks that need to be done (with owners if mentioned)
3. Updates - Status updates and progress shared
4. Topics Discussed - Main topics covered

Format your response as JSON with these keys:
{
  "summary": "Brief 2-3 sentence overview",
  "key_decisions": ["decision 1", "decision 2"],
  "action_items": [{"task": "...", "owner": "..."}],
  "updates": ["update 1", "update 2"],
  "topics": ["topic 1", "topic 2"]
}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Meeting: ${meeting.title}\nDate: ${meeting.start_time}\n\nNotes:\n${notes}`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      const summaryText = data.content[0].text;

      // Parse JSON response
      let parsedSummary;
      try {
        parsedSummary = JSON.parse(summaryText);
      } catch (e) {
        // If not valid JSON, create structured response
        parsedSummary = {
          summary: summaryText,
          key_decisions: [],
          action_items: [],
          updates: [],
          topics: []
        };
      }

      // Save summary to database
      const updateResult = await this.supabaseAdapter.updateMeetingSummary(meetingId, {
        ai_summary: parsedSummary.summary,
        key_decisions: parsedSummary.key_decisions,
        action_items: parsedSummary.action_items,
        topics: parsedSummary.topics
      });

      this.logger.info('AI summary generated and saved', {
        meetingId,
        decisions: parsedSummary.key_decisions?.length,
        actionItems: parsedSummary.action_items?.length
      });

      return {
        success: true,
        summary: parsedSummary
      };

    } catch (error) {
      this.logger.error('Failed to generate AI summary', {
        meetingId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get meeting summaries for a date range
   */
  async getMeetingSummaries(userId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        importantOnly = false
      } = options;

      // Handle both Date objects and ISO strings (IPC serializes Dates to strings)
      const startDateISO = typeof startDate === 'string' ? startDate : startDate.toISOString();
      const endDateISO = typeof endDate === 'string' ? endDate : endDate.toISOString();

      this.logger.info('Fetching meeting summaries', {
        userId,
        startDate: startDateISO,
        endDate: endDateISO,
        importantOnly
      });

      const result = await this.supabaseAdapter.getMeetings(userId, {
        start_date: startDateISO,
        end_date: endDateISO,
        important_only: importantOnly
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to fetch meeting summaries', {
        userId,
        error: error.message
      });
      return {
        success: false,
        error: error.message,
        meetings: []
      };
    }
  }
}

module.exports = MeetingIntelligenceService;

