/**
 * Supabase Client - Database connection and operations using Supabase
 * 
 * Features:
 * 1. Real-time database operations
 * 2. Built-in authentication
 * 3. Row Level Security (RLS)
 * 4. Real-time subscriptions
 * 5. Automatic API generation
 */

const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

class SupabaseClient {
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
      defaultMeta: { service: 'supabase-client' }
    });
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    
    this.logger.info('Supabase client initialized', {
      url: supabaseUrl,
      hasKey: Boolean(supabaseKey && supabaseKey !== 'your-anon-key')
    });
  }
  
  /**
   * Get Supabase client instance
   */
  getClient() {
    return this.supabase;
  }
  
  // Signal Operations
  
  /**
   * Create a new signal
   */
  async createSignal(signalData) {
    try {
      const { data, error } = await this.supabase
        .from('signals')
        .insert(signalData)
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('Signal created', { signal_id: data.id });
      return data;
      
    } catch (error) {
      this.logger.error('Failed to create signal', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get signals with filtering and pagination
   */
  async getSignals(filters = {}, options = {}) {
    try {
      let query = this.supabase
        .from('signals')
        .select('*');
      
      // Apply filters
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.source_id) {
        query = query.eq('source_id', filters.source_id);
      }
      
      if (filters.min_relevance_score) {
        query = query.gte('relevance_score', filters.min_relevance_score);
      }
      
      if (filters.from_date) {
        query = query.gte('published_at', filters.from_date);
      }
      
      if (filters.to_date) {
        query = query.lte('published_at', filters.to_date);
      }
      
      // Apply sorting
      const orderBy = options.orderBy || 'published_at';
      const ascending = options.ascending || false;
      query = query.order(orderBy, { ascending });
      
      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return {
        signals: data || [],
        total: count,
        hasMore: data && options.limit ? data.length === options.limit : false
      };
      
    } catch (error) {
      this.logger.error('Failed to get signals', { error: error.message, filters });
      throw error;
    }
  }
  
  /**
   * Update signal
   */
  async updateSignal(signalId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('signals')
        .update({ ...updates, updated_at: new Date() })
        .eq('id', signalId)
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('Signal updated', { signal_id: signalId });
      return data;
      
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
  async deleteSignal(signalId) {
    try {
      const { error } = await this.supabase
        .from('signals')
        .delete()
        .eq('id', signalId);
      
      if (error) throw error;
      
      this.logger.info('Signal deleted', { signal_id: signalId });
      
    } catch (error) {
      this.logger.error('Failed to delete signal', { 
        signal_id: signalId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  // User Operations
  
  /**
   * Create or update user
   */
  async upsertUser(userData) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .upsert(userData, { onConflict: 'email' })
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('User upserted', { user_id: data.id });
      return data;
      
    } catch (error) {
      this.logger.error('Failed to upsert user', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get user by ID
   */
  async getUser(userId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      this.logger.error('Failed to get user', { user_id: userId, error: error.message });
      throw error;
    }
  }
  
  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      this.logger.error('Failed to get user by email', { email, error: error.message });
      throw error;
    }
  }
  
  // Feedback Operations
  
  /**
   * Record user feedback
   */
  async createFeedback(feedbackData) {
    try {
      const { data, error } = await this.supabase
        .from('feedback')
        .insert(feedbackData)
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('Feedback recorded', { 
        feedback_id: data.id,
        signal_id: data.signal_id,
        type: data.type
      });
      
      return data;
      
    } catch (error) {
      this.logger.error('Failed to create feedback', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get feedback for signal
   */
  async getSignalFeedback(signalId) {
    try {
      const { data, error } = await this.supabase
        .from('feedback')
        .select('*')
        .eq('signal_id', signalId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      this.logger.error('Failed to get signal feedback', { 
        signal_id: signalId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Get user feedback history
   */
  async getUserFeedback(userId, limit = 100) {
    try {
      const { data, error } = await this.supabase
        .from('feedback')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      this.logger.error('Failed to get user feedback', { 
        user_id: userId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  // Source Operations
  
  /**
   * Create source
   */
  async createSource(sourceData) {
    try {
      const { data, error } = await this.supabase
        .from('sources')
        .insert(sourceData)
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('Source created', { source_id: data.id });
      return data;
      
    } catch (error) {
      this.logger.error('Failed to create source', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get active sources
   */
  async getActiveSources() {
    try {
      const { data, error } = await this.supabase
        .from('sources')
        .select('*')
        .eq('status', 'active')
        .order('priority', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      this.logger.error('Failed to get active sources', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Update source status
   */
  async updateSourceStatus(sourceId, status, errorInfo = null) {
    try {
      const updates = { 
        status, 
        updated_at: new Date(),
        last_poll_at: new Date()
      };
      
      if (errorInfo) {
        updates.last_error = errorInfo;
      }
      
      const { data, error } = await this.supabase
        .from('sources')
        .update(updates)
        .eq('id', sourceId)
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('Source status updated', { source_id: sourceId, status });
      return data;
      
    } catch (error) {
      this.logger.error('Failed to update source status', { 
        source_id: sourceId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  // Team Operations
  
  /**
   * Create team
   */
  async createTeam(teamData) {
    try {
      const { data, error } = await this.supabase
        .from('teams')
        .insert(teamData)
        .select()
        .single();
      
      if (error) throw error;
      
      this.logger.info('Team created', { team_id: data.id });
      return data;
      
    } catch (error) {
      this.logger.error('Failed to create team', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Get team with members
   */
  async getTeam(teamId) {
    try {
      const { data, error } = await this.supabase
        .from('teams')
        .select(`
          *,
          team_members (
            user_id,
            role,
            joined_at,
            is_active,
            users (
              id,
              name,
              email,
              avatar_url
            )
          )
        `)
        .eq('id', teamId)
        .single();
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      this.logger.error('Failed to get team', { team_id: teamId, error: error.message });
      throw error;
    }
  }
  
  // Real-time Subscriptions
  
  /**
   * Subscribe to signal changes
   */
  subscribeToSignals(userId, callback) {
    const subscription = this.supabase
      .channel('signals')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'signals',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
    
    this.logger.info('Subscribed to signal changes', { user_id: userId });
    
    return subscription;
  }
  
  /**
   * Subscribe to team activity
   */
  subscribeToTeamActivity(teamId, callback) {
    const subscription = this.supabase
      .channel('team_activity')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feedback',
        filter: `team_id=eq.${teamId}`
      }, callback)
      .subscribe();
    
    this.logger.info('Subscribed to team activity', { team_id: teamId });
    
    return subscription;
  }
  
  /**
   * Unsubscribe from channel
   */
  async unsubscribe(subscription) {
    if (subscription) {
      await this.supabase.removeChannel(subscription);
      this.logger.info('Unsubscribed from channel');
    }
  }
  
  // Analytics Operations
  
  /**
   * Get user analytics
   */
  async getUserAnalytics(userId, timeframe = '30 days') {
    try {
      // Get signal counts
      const { data: signalCounts, error: signalError } = await this.supabase
        .rpc('get_user_signal_counts', {
          user_id: userId,
          timeframe: timeframe
        });
      
      if (signalError) throw signalError;
      
      // Get feedback metrics
      const { data: feedbackMetrics, error: feedbackError } = await this.supabase
        .rpc('get_user_feedback_metrics', {
          user_id: userId,
          timeframe: timeframe
        });
      
      if (feedbackError) throw feedbackError;
      
      return {
        signals: signalCounts || {},
        feedback: feedbackMetrics || {},
        timeframe
      };
      
    } catch (error) {
      this.logger.error('Failed to get user analytics', { 
        user_id: userId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * Get team analytics
   */
  async getTeamAnalytics(teamId, timeframe = '30 days') {
    try {
      const { data, error } = await this.supabase
        .rpc('get_team_analytics', {
          team_id: teamId,
          timeframe: timeframe
        });
      
      if (error) throw error;
      
      return data || {};
      
    } catch (error) {
      this.logger.error('Failed to get team analytics', { 
        team_id: teamId, 
        error: error.message 
      });
      throw error;
    }
  }
  
  // Utility Operations
  
  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      this.logger.info('Database connection successful');
      return true;
      
    } catch (error) {
      this.logger.error('Database connection failed', { error: error.message });
      return false;
    }
  }
  
  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const stats = {};
      
      // Count signals
      const { count: signalCount, error: signalError } = await this.supabase
        .from('signals')
        .select('*', { count: 'exact', head: true });
      
      if (!signalError) stats.signals = signalCount;
      
      // Count users
      const { count: userCount, error: userError } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (!userError) stats.users = userCount;
      
      // Count teams
      const { count: teamCount, error: teamError } = await this.supabase
        .from('teams')
        .select('*', { count: 'exact', head: true });
      
      if (!teamError) stats.teams = teamCount;
      
      return stats;
      
    } catch (error) {
      this.logger.error('Failed to get database stats', { error: error.message });
      return {};
    }
  }
}

module.exports = SupabaseClient;
