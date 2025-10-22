/**
 * Microsoft Graph Webhook Service
 * 
 * Manages subscriptions to Microsoft Graph change notifications for:
 * - Meeting transcripts
 * - Meeting recordings
 * - Copilot notes
 * 
 * Based on: https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/meeting-transcripts/overview-transcripts
 */

const EventEmitter = require('events');
const winston = require('winston');
const crypto = require('crypto');

class MicrosoftGraphWebhookService extends EventEmitter {
  constructor({ microsoftService, supabaseAdapter, logger }) {
    super();
    
    this.microsoftService = microsoftService;
    this.supabaseAdapter = supabaseAdapter;
    this.logger = logger || this._createLogger();
    
    // Store active subscriptions in memory
    this.activeSubscriptions = new Map();
    
    // Subscription configuration
    this.subscriptionConfig = {
      // Transcripts for user's meetings (not tenant-wide, requires user context)
      userTranscripts: {
        resource: '/users/{userId}/onlineMeetings/getAllTranscripts',
        changeType: 'created',
        expirationMinutes: 55 // Less than 60 to avoid lifecycleNotificationUrl requirement
      },
      // Recordings for user's meetings (not tenant-wide, requires user context)
      userRecordings: {
        resource: '/users/{userId}/onlineMeetings/getAllRecordings',
        changeType: 'created',
        expirationMinutes: 55 // Less than 60 to avoid lifecycleNotificationUrl requirement
      }
    };
    
    // Client state secret for validation
    this.clientState = crypto.randomBytes(16).toString('hex');
    
    this.logger.info('Microsoft Graph Webhook Service initialized');
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
          filename: 'logs/graph-webhooks.log' 
        })
      ],
      defaultMeta: { service: 'graph-webhook-service' }
    });
  }

  /**
   * Clean up old subscriptions before creating new ones
   * @param {Object} client - Microsoft Graph client
   * @returns {Promise<number>} Number of subscriptions deleted
   */
  async _cleanupOldSubscriptions(client) {
    try {
      this.logger.info('Checking for old subscriptions to clean up');
      
      const response = await client.api('/subscriptions').get();
      const subscriptions = response.value || [];
      
      if (subscriptions.length === 0) {
        this.logger.info('No old subscriptions to clean up');
        return 0;
      }
      
      this.logger.info('Found existing subscriptions', { count: subscriptions.length });
      
      let deleted = 0;
      for (const sub of subscriptions) {
        try {
          await client.api(`/subscriptions/${sub.id}`).delete();
          deleted++;
          this.logger.info('Deleted old subscription', { 
            subscriptionId: sub.id,
            resource: sub.resource 
          });
        } catch (error) {
          this.logger.warn('Failed to delete subscription', {
            subscriptionId: sub.id,
            error: error.message
          });
        }
      }
      
      this.logger.info('Subscription cleanup complete', { deleted });
      return deleted;
      
    } catch (error) {
      this.logger.warn('Failed to clean up subscriptions', { error: error.message });
      return 0;
    }
  }

  /**
   * Create all subscriptions for a user
   * @param {string} userId - User ID
   * @param {string} notificationUrl - Public HTTPS URL for receiving notifications
   */
  async createSubscriptions(userId, notificationUrl) {
    try {
      this.logger.info('Creating Microsoft Graph subscriptions', { 
        userId, 
        notificationUrl 
      });

      const client = await this.microsoftService._getGraphClient(userId);
      
      // Clean up old subscriptions first to avoid hitting the 10 subscription limit
      await this._cleanupOldSubscriptions(client);
      
      // Get the Microsoft Graph user ID (not Supabase userId)
      const userProfile = await client.api('/me').select('id').get();
      const graphUserId = userProfile.id;
      
      this.logger.info('Fetched Microsoft Graph user ID', { 
        supabaseUserId: userId,
        graphUserId 
      });

      const subscriptions = [];

      // Create transcript subscription (replace {userId} placeholder with Graph ID)
      try {
        const transcriptConfig = {
          ...this.subscriptionConfig.userTranscripts,
          resource: this.subscriptionConfig.userTranscripts.resource.replace('{userId}', graphUserId)
        };
        const transcriptSub = await this._createSubscription(
          client,
          transcriptConfig,
          notificationUrl
        );
        subscriptions.push(transcriptSub);
        this.activeSubscriptions.set(transcriptSub.id, {
          ...transcriptSub,
          userId,
          type: 'transcript'
        });
        this.logger.info('Transcript subscription created', { 
          subscriptionId: transcriptSub.id,
          expiresAt: transcriptSub.expirationDateTime
        });
      } catch (error) {
        this.logger.error('Failed to create transcript subscription', {
          userId,
          error: error.message
        });
      }

      // Create recording subscription (replace {userId} placeholder with Graph ID)
      try {
        const recordingConfig = {
          ...this.subscriptionConfig.userRecordings,
          resource: this.subscriptionConfig.userRecordings.resource.replace('{userId}', graphUserId)
        };
        const recordingSub = await this._createSubscription(
          client,
          recordingConfig,
          notificationUrl
        );
        subscriptions.push(recordingSub);
        this.activeSubscriptions.set(recordingSub.id, {
          ...recordingSub,
          userId,
          type: 'recording'
        });
        this.logger.info('Recording subscription created', { 
          subscriptionId: recordingSub.id,
          expiresAt: recordingSub.expirationDateTime
        });
      } catch (error) {
        this.logger.error('Failed to create recording subscription', {
          userId,
          error: error.message
        });
      }

      // Schedule renewal for all subscriptions
      subscriptions.forEach(sub => this._scheduleRenewal(sub.id, userId));

      return {
        success: true,
        subscriptions: subscriptions.map(s => ({
          id: s.id,
          resource: s.resource,
          expiresAt: s.expirationDateTime
        }))
      };

    } catch (error) {
      this.logger.error('Failed to create subscriptions', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a single subscription
   * @private
   */
  async _createSubscription(client, config, notificationUrl) {
    const expirationDateTime = new Date();
    expirationDateTime.setMinutes(
      expirationDateTime.getMinutes() + config.expirationMinutes
    );

    const subscription = {
      changeType: config.changeType,
      notificationUrl: notificationUrl,
      resource: config.resource,
      expirationDateTime: expirationDateTime.toISOString(),
      clientState: this.clientState
    };

    this.logger.debug('Creating subscription', subscription);

    const response = await client
      .api('/subscriptions')
      .post(subscription);

    return response;
  }

  /**
   * Handle incoming webhook notification
   * @param {Object} notification - Notification from Microsoft Graph
   */
  async handleNotification(notification) {
    try {
      this.logger.info('Received webhook notification', {
        subscriptionId: notification.subscriptionId,
        resource: notification.resource,
        changeType: notification.changeType
      });

      // Validate client state (warning only - don't reject due to multiple subscription cycles)
      if (notification.clientState !== this.clientState) {
        this.logger.warn('Client state mismatch (continuing anyway - old subscription)', {
          expected: this.clientState,
          received: notification.clientState
        });
        // Continue processing - this happens when subscriptions are recreated
      }

      // Get subscription info
      const subscription = this.activeSubscriptions.get(notification.subscriptionId);
      if (!subscription) {
        this.logger.warn('Notification for unknown subscription', {
          subscriptionId: notification.subscriptionId
        });
        return;
      }

      // Parse the resource URL to extract IDs
      const resourceData = this._parseResourceUrl(notification.resource);

      if (subscription.type === 'transcript') {
        await this._handleTranscriptNotification(
          subscription.userId,
          resourceData,
          notification
        );
      } else if (subscription.type === 'recording') {
        await this._handleRecordingNotification(
          subscription.userId,
          resourceData,
          notification
        );
      }

    } catch (error) {
      this.logger.error('Failed to handle notification', {
        error: error.message,
        notification
      });
    }
  }

  /**
   * Handle transcript notification
   * @private
   */
  async _handleTranscriptNotification(userId, resourceData, notification) {
    try {
      this.logger.info('Processing transcript notification', {
        userId,
        meetingId: resourceData.meetingId,
        transcriptId: resourceData.transcriptId
      });

      // Emit event for AutomatedTranscriptService to handle
      this.emit('transcript-available', {
        userId,
        meetingId: resourceData.meetingId,
        transcriptId: resourceData.transcriptId,
        resourceUrl: notification.resource,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to process transcript notification', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * Handle recording notification
   * @private
   */
  async _handleRecordingNotification(userId, resourceData, notification) {
    try {
      this.logger.info('Processing recording notification', {
        userId,
        meetingId: resourceData.meetingId,
        recordingId: resourceData.recordingId
      });

      // Emit event for recording processing
      this.emit('recording-available', {
        userId,
        meetingId: resourceData.meetingId,
        recordingId: resourceData.recordingId,
        resourceUrl: notification.resource,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to process recording notification', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * Parse resource URL to extract meeting ID and resource ID
   * @private
   */
  _parseResourceUrl(resourceUrl) {
    // Example: /communications/onlineMeetings('meetingId')/transcripts('transcriptId')
    const meetingMatch = resourceUrl.match(/onlineMeetings\('([^']+)'\)/);
    const transcriptMatch = resourceUrl.match(/transcripts\('([^']+)'\)/);
    const recordingMatch = resourceUrl.match(/recordings\('([^']+)'\)/);

    return {
      meetingId: meetingMatch ? meetingMatch[1] : null,
      transcriptId: transcriptMatch ? transcriptMatch[1] : null,
      recordingId: recordingMatch ? recordingMatch[1] : null
    };
  }

  /**
   * Renew a subscription before it expires
   * @param {string} subscriptionId - Subscription ID
   * @param {string} userId - User ID
   */
  async renewSubscription(subscriptionId, userId) {
    try {
      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (!subscription) {
        this.logger.warn('Attempted to renew unknown subscription', { subscriptionId });
        return;
      }

      this.logger.info('Renewing subscription', { subscriptionId });

      const client = await this.microsoftService._getGraphClient(userId);

      // Calculate new expiration (add configured minutes)
      const config = subscription.type === 'transcript' 
        ? this.subscriptionConfig.userTranscripts 
        : this.subscriptionConfig.userRecordings;

      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(
        expirationDateTime.getMinutes() + config.expirationMinutes
      );

      const renewed = await client
        .api(`/subscriptions/${subscriptionId}`)
        .patch({
          expirationDateTime: expirationDateTime.toISOString()
        });

      // Update in memory
      subscription.expirationDateTime = renewed.expirationDateTime;
      this.activeSubscriptions.set(subscriptionId, subscription);

      this.logger.info('Subscription renewed', {
        subscriptionId,
        newExpiration: renewed.expirationDateTime
      });

      // Schedule next renewal
      this._scheduleRenewal(subscriptionId, userId);

      return renewed;

    } catch (error) {
      this.logger.error('Failed to renew subscription', {
        subscriptionId,
        error: error.message
      });
      
      // If renewal fails, try to create a new subscription
      this.logger.info('Attempting to create new subscription after renewal failure');
      // Emit event so the app can recreate subscriptions
      this.emit('subscription-expired', { subscriptionId, userId });
    }
  }

  /**
   * Schedule subscription renewal
   * @private
   */
  _scheduleRenewal(subscriptionId, userId) {
    const subscription = this.activeSubscriptions.get(subscriptionId);
    if (!subscription) return;

    const expiresAt = new Date(subscription.expirationDateTime);
    const now = new Date();
    
    // Renew 5 minutes before expiration
    const renewAt = new Date(expiresAt.getTime() - 5 * 60 * 1000);
    const delay = renewAt.getTime() - now.getTime();

    if (delay > 0) {
      setTimeout(() => {
        this.renewSubscription(subscriptionId, userId);
      }, delay);

      this.logger.debug('Scheduled subscription renewal', {
        subscriptionId,
        renewAt: renewAt.toISOString()
      });
    } else {
      // Already expired or about to expire, renew immediately
      this.renewSubscription(subscriptionId, userId);
    }
  }

  /**
   * Delete a subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {string} userId - User ID
   */
  async deleteSubscription(subscriptionId, userId) {
    try {
      const client = await this.microsoftService._getGraphClient(userId);
      
      await client
        .api(`/subscriptions/${subscriptionId}`)
        .delete();

      this.activeSubscriptions.delete(subscriptionId);

      this.logger.info('Subscription deleted', { subscriptionId });

    } catch (error) {
      this.logger.error('Failed to delete subscription', {
        subscriptionId,
        error: error.message
      });
    }
  }

  /**
   * Validate webhook subscription (during initial setup)
   * @param {string} validationToken - Token from Microsoft Graph
   * @returns {string} - The validation token to return
   */
  validateSubscription(validationToken) {
    this.logger.info('Validating webhook subscription', {
      token: validationToken ? 'present' : 'missing'
    });
    return validationToken;
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    return Array.from(this.activeSubscriptions.values());
  }
}

module.exports = MicrosoftGraphWebhookService;

