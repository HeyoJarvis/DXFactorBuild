/**
 * Supabase Adapter for Slack Bot
 * 
 * Connects Slack bot to Supabase for:
 * 1. User management and preferences
 * 2. Signal delivery tracking
 * 3. Feedback collection and storage
 * 4. Conversation capture
 */

const SupabaseClient = require('../../data/storage/supabase-client');

class SlackSupabaseAdapter {
  constructor(options = {}) {
    // Use service role key for admin operations in background services
    const supabaseOptions = {
      useServiceRole: true, // Bypass RLS for background operations
      ...options
    };
    this.supabase = new SupabaseClient(supabaseOptions);
    this.logger = options.logger || console;
  }

  /**
   * Get or create user from Slack user info
   */
  async getOrCreateUser(slackUserInfo) {
    try {
      const { 
        id: slackUserId, 
        real_name: name, 
        profile 
      } = slackUserInfo;

      // Try to find existing user by Slack auth ID
      let user = await this.supabase.getUserByEmail(profile.email).catch(() => null);

      if (!user) {
        // Create new user
        user = await this.supabase.upsertUser({
          email: profile.email.toLowerCase(),
          name: name || profile.display_name || 'Slack User',
          avatar_url: profile.image_192 || profile.image_512,
          auth_provider: 'slack',
          auth_id: slackUserId,
          integrations: {
            slack: {
              user_id: slackUserId,
              team_id: profile.team,
              tz: slackUserInfo.tz,
              tz_offset: slackUserInfo.tz_offset
            }
          }
        });

        this.logger.info('Created new user from Slack', { 
          user_id: user.id, 
          slack_id: slackUserId 
        });
      }

      return user;

    } catch (error) {
      this.logger.error('Failed to get or create user', { error: error.message });
      throw error;
    }
  }

  /**
   * Track signal delivery to Slack
   */
  async trackDelivery(params) {
    const {
      signal_id,
      user_id,
      channel,
      message_ts,
      urgency,
      metadata = {}
    } = params;

    try {
      const delivery = await this.supabase.getClient()
        .from('signal_deliveries')
        .insert({
          signal_id,
          user_id,
          channel: 'slack',
          destination: channel,
          message_id: message_ts,
          delivery_metadata: {
            urgency,
            slack_channel: channel,
            ...metadata
          }
        })
        .select()
        .single();

      this.logger.info('Tracked signal delivery', { 
        signal_id, 
        user_id,
        delivery_id: delivery.data.id
      });

      return delivery.data;

    } catch (error) {
      this.logger.error('Failed to track delivery', { 
        signal_id,
        error: error.message 
      });
      // Don't throw - tracking failure shouldn't break delivery
      return null;
    }
  }

  /**
   * Record user feedback on a signal
   */
  async recordFeedback(params) {
    const {
      user_id,
      signal_id,
      feedback_type,
      value,
      comment = null,
      context = {}
    } = params;

    try {
      const feedback = await this.supabase.createFeedback({
        user_id,
        signal_id,
        type: feedback_type,
        value: { helpful: value },
        comment,
        context: {
          source: 'slack',
          ...context
        }
      });

      this.logger.info('Recorded feedback', { 
        feedback_id: feedback.id,
        signal_id,
        type: feedback_type
      });

      return feedback;

    } catch (error) {
      this.logger.error('Failed to record feedback', { 
        signal_id,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Mark signal as read
   */
  async markSignalRead(signal_id, user_id) {
    try {
      await this.supabase.getClient()
        .from('signal_deliveries')
        .update({ read_at: new Date() })
        .eq('signal_id', signal_id)
        .eq('user_id', user_id)
        .is('read_at', null);

      this.logger.info('Marked signal as read', { signal_id, user_id });

    } catch (error) {
      this.logger.error('Failed to mark signal as read', { 
        signal_id,
        error: error.message 
      });
    }
  }

  /**
   * Store Slack conversation for intelligence gathering
   */
  async storeConversation(conversationData) {
    try {
      const stored = await this.supabase.storeSlackConversation(conversationData);
      
      this.logger.info('Stored Slack conversation', { 
        conversation_id: stored.id,
        relevance_score: stored.relevance_score
      });

      return stored;

    } catch (error) {
      this.logger.error('Failed to store conversation', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get unread signals for a user
   */
  async getUnreadSignals(user_id, limit = 10) {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('signal_deliveries')
        .select(`
          *,
          signals (*)
        `)
        .eq('user_id', user_id)
        .eq('channel', 'slack')
        .is('read_at', null)
        .order('delivered_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map(d => d.signals);

    } catch (error) {
      this.logger.error('Failed to get unread signals', { 
        user_id,
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Get user preferences for signal delivery
   */
  async getUserPreferences(user_id) {
    try {
      const user = await this.supabase.getUser(user_id);
      
      return {
        notifications: user.notifications || {},
        work_schedule: user.work_schedule || {},
        preferred_channel: user.integrations?.slack?.preferred_channel,
        digest_enabled: user.notifications?.digest_enabled !== false,
        urgency_threshold: user.notifications?.urgency_threshold || 'medium'
      };

    } catch (error) {
      this.logger.error('Failed to get user preferences', { 
        user_id,
        error: error.message 
      });
      return {};
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(user_id, preferences) {
    try {
      const user = await this.supabase.getUser(user_id);
      
      const updates = {
        notifications: { ...user.notifications, ...preferences.notifications },
        work_schedule: { ...user.work_schedule, ...preferences.work_schedule }
      };

      await this.supabase.getClient()
        .from('users')
        .update(updates)
        .eq('id', user_id);

      this.logger.info('Updated user preferences', { user_id });

      return updates;

    } catch (error) {
      this.logger.error('Failed to update preferences', { 
        user_id,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get recent signals for digest
   */
  async getSignalsForDigest(user_id, hours = 24) {
    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      const { data, error } = await this.supabase.getClient()
        .from('signal_deliveries')
        .select(`
          *,
          signals (*)
        `)
        .eq('user_id', user_id)
        .eq('channel', 'slack')
        .gte('delivered_at', since.toISOString())
        .order('delivered_at', { ascending: false });

      if (error) throw error;

      return data.map(d => d.signals);

    } catch (error) {
      this.logger.error('Failed to get signals for digest', { 
        user_id,
        error: error.message 
      });
      return [];
    }
  }
}

module.exports = SlackSupabaseAdapter;

