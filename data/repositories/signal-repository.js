/**
 * Signal Repository - Data access layer for signals using Supabase
 * 
 * Features:
 * 1. CRUD operations for signals
 * 2. Advanced filtering and search
 * 3. Real-time subscriptions
 * 4. Batch operations
 * 5. Analytics queries
 */

const SupabaseClient = require('../storage/supabase-client');
const { SignalSchema, SignalHelpers } = require('../models/signal.schema');
const winston = require('winston');

class SignalRepository {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'signal-repository' }
    });
    
    this.supabase = new SupabaseClient(options);
  }
  
  /**
   * Create a new signal
   */
  async create(signalData) {
    try {
      // Validate signal data
      const validatedSignal = SignalSchema.parse({
        ...signalData,
        id: signalData.id || SignalHelpers.generateId(),
        created_at: new Date(),
        updated_at: new Date()
      });
      
      const signal = await this.supabase.createSignal(validatedSignal);
      
      this.logger.info('Signal created', {
        signal_id: signal.id,
        category: signal.category,
        priority: signal.priority
      });
      
      return signal;
      
    } catch (error) {
      this.logger.error('Failed to create signal', {
        error: error.message,
        signal_title: signalData.title
      });
      throw error;
    }
  }
  
  /**
   * Get signal by ID
   */
  async getById(signalId) {
    try {
      const { signals } = await this.supabase.getSignals({ id: signalId }, { limit: 1 });
      
      if (signals.length === 0) {
        throw new Error(`Signal not found: ${signalId}`);
      }
      
      return signals[0];
      
    } catch (error) {
      this.logger.error('Failed to get signal by ID', {
        signal_id: signalId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get signals for user with filtering
   */
  async getForUser(userId, filters = {}, options = {}) {
    try {
      const queryFilters = {
        user_id: userId,
        ...filters
      };
      
      const result = await this.supabase.getSignals(queryFilters, {
        orderBy: 'published_at',
        ascending: false,
        limit: options.limit || 50,
        offset: options.offset || 0
      });
      
      this.logger.debug('Retrieved signals for user', {
        user_id: userId,
        count: result.signals.length,
        filters
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Failed to get signals for user', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get unread signals for user
   */
  async getUnreadForUser(userId, limit = 50) {
    try {
      // Query signals that have been delivered but not read
      const { data, error } = await this.supabase.getClient()
        .from('signals')
        .select(`
          *,
          signal_deliveries!inner (
            delivered_at,
            read_at,
            user_id
          )
        `)
        .eq('signal_deliveries.user_id', userId)
        .is('signal_deliveries.read_at', null)
        .order('published_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      this.logger.debug('Retrieved unread signals', {
        user_id: userId,
        count: data?.length || 0
      });
      
      return data || [];
      
    } catch (error) {
      this.logger.error('Failed to get unread signals', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Mark signal as read
   */
  async markAsRead(signalId, userId) {
    try {
      const { error } = await this.supabase.getClient()
        .from('signal_deliveries')
        .update({ read_at: new Date() })
        .eq('signal_id', signalId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      this.logger.info('Signal marked as read', {
        signal_id: signalId,
        user_id: userId
      });
      
    } catch (error) {
      this.logger.error('Failed to mark signal as read', {
        signal_id: signalId,
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Update signal
   */
  async update(signalId, updates) {
    try {
      const signal = await this.supabase.updateSignal(signalId, {
        ...updates,
        updated_at: new Date()
      });
      
      this.logger.info('Signal updated', {
        signal_id: signalId,
        fields_updated: Object.keys(updates)
      });
      
      return signal;
      
    } catch (error) {
      this.logger.error('Failed to update signal', {
        signal_id: signalId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Delete signal
   */
  async delete(signalId) {
    try {
      await this.supabase.deleteSignal(signalId);
      
      this.logger.info('Signal deleted', { signal_id: signalId });
      
    } catch (error) {
      this.logger.error('Failed to delete signal', {
        signal_id: signalId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Search signals by text
   */
  async search(query, userId, options = {}) {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('signals')
        .select(`
          *,
          signal_deliveries!inner (user_id)
        `)
        .eq('signal_deliveries.user_id', userId)
        .textSearch('title,summary', query, {
          type: 'websearch',
          config: 'english'
        })
        .order('published_at', { ascending: false })
        .limit(options.limit || 50);
      
      if (error) throw error;
      
      this.logger.debug('Signal search completed', {
        query,
        user_id: userId,
        results: data?.length || 0
      });
      
      return data || [];
      
    } catch (error) {
      this.logger.error('Signal search failed', {
        query,
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get signals by category for user
   */
  async getByCategory(category, userId, options = {}) {
    return this.getForUser(userId, { category }, options);
  }
  
  /**
   * Get signals by priority for user
   */
  async getByPriority(priority, userId, options = {}) {
    return this.getForUser(userId, { priority }, options);
  }
  
  /**
   * Get signals by source
   */
  async getBySource(sourceId, userId, options = {}) {
    return this.getForUser(userId, { source_id: sourceId }, options);
  }
  
  /**
   * Get signals in date range
   */
  async getByDateRange(fromDate, toDate, userId, options = {}) {
    return this.getForUser(userId, {
      from_date: fromDate,
      to_date: toDate
    }, options);
  }
  
  /**
   * Get high relevance signals
   */
  async getHighRelevance(userId, threshold = 0.7, options = {}) {
    return this.getForUser(userId, {
      min_relevance_score: threshold
    }, options);
  }
  
  /**
   * Batch create signals
   */
  async batchCreate(signalsData) {
    try {
      const results = [];
      
      for (const signalData of signalsData) {
        try {
          const signal = await this.create(signalData);
          results.push({ success: true, signal });
        } catch (error) {
          results.push({ 
            success: false, 
            error: error.message,
            signal_data: signalData 
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      this.logger.info('Batch signal creation completed', {
        total: signalsData.length,
        success: successCount,
        failed: failureCount
      });
      
      return results;
      
    } catch (error) {
      this.logger.error('Batch signal creation failed', {
        error: error.message,
        count: signalsData.length
      });
      throw error;
    }
  }
  
  /**
   * Get signal statistics for user
   */
  async getStatsForUser(userId, timeframe = '30 days') {
    try {
      const stats = await this.supabase.getUserAnalytics(userId, timeframe);
      
      this.logger.debug('Retrieved signal stats for user', {
        user_id: userId,
        timeframe
      });
      
      return stats;
      
    } catch (error) {
      this.logger.error('Failed to get signal stats', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get trending signals
   */
  async getTrending(userId, hours = 24, limit = 20) {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('signals')
        .select(`
          *,
          signal_deliveries!inner (user_id),
          feedback (type, value)
        `)
        .eq('signal_deliveries.user_id', userId)
        .gte('published_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('view_count', { ascending: false })
        .order('action_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      this.logger.debug('Retrieved trending signals', {
        user_id: userId,
        hours,
        count: data?.length || 0
      });
      
      return data || [];
      
    } catch (error) {
      this.logger.error('Failed to get trending signals', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Subscribe to real-time signal updates for user
   */
  subscribeToUserSignals(userId, callback) {
    try {
      const subscription = this.supabase.subscribeToSignals(userId, (payload) => {
        this.logger.debug('Real-time signal update', {
          user_id: userId,
          event: payload.eventType,
          signal_id: payload.new?.id || payload.old?.id
        });
        
        callback(payload);
      });
      
      this.logger.info('Subscribed to user signals', { user_id: userId });
      
      return subscription;
      
    } catch (error) {
      this.logger.error('Failed to subscribe to user signals', {
        user_id: userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Unsubscribe from real-time updates
   */
  async unsubscribe(subscription) {
    try {
      await this.supabase.unsubscribe(subscription);
      this.logger.info('Unsubscribed from real-time updates');
    } catch (error) {
      this.logger.error('Failed to unsubscribe', { error: error.message });
    }
  }
  
  /**
   * Archive old signals
   */
  async archiveOldSignals(olderThanDays = 90) {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      
      const { count, error } = await this.supabase.getClient()
        .from('signals')
        .update({ status: 'archived' })
        .lt('published_at', cutoffDate.toISOString())
        .neq('status', 'archived');
      
      if (error) throw error;
      
      this.logger.info('Archived old signals', {
        count,
        cutoff_date: cutoffDate,
        older_than_days: olderThanDays
      });
      
      return count;
      
    } catch (error) {
      this.logger.error('Failed to archive old signals', {
        error: error.message,
        older_than_days: olderThanDays
      });
      throw error;
    }
  }
}

module.exports = SignalRepository;
