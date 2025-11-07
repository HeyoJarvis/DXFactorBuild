/**
 * Email Vector Store
 *
 * Manages storage and retrieval of email embeddings in Supabase pgvector.
 * Provides semantic search capabilities over emails.
 *
 * Features:
 * 1. Store emails with embeddings
 * 2. Semantic similarity search
 * 3. User email indexing status tracking
 * 4. Batch insert operations
 * 5. Deduplication and caching
 */

const winston = require('winston');
const { createClient } = require('@supabase/supabase-js');

class EmailVectorStore {
  constructor(options = {}) {
    this.options = {
      logLevel: options.logLevel || 'info',
      batchSize: options.batchSize || 50,
      ...options
    };

    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/email-vector-store.log' })
      ],
      defaultMeta: { service: 'email-vector-store' }
    });

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    this.logger.info('Email Vector Store initialized');
  }

  /**
   * Store a single email with embedding
   * @param {Object} email - Email object with embedding
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Inserted email
   */
  async storeEmail(email, userId) {
    try {
      const { data, error } = await this.supabase
        .from('email_chunks')
        .upsert({
          user_id: userId,
          message_id: email.messageId,
          thread_id: email.threadId,
          provider: email.provider, // 'gmail', 'outlook', 'linkedin'
          provider_account: email.providerAccount,
          from_address: email.from,
          from_name: email.fromName || email.company,
          to_addresses: email.to ? (Array.isArray(email.to) ? email.to : [email.to]) : [],
          cc_addresses: email.cc || [],
          subject: email.subject,
          body_text: email.body || email.preview,
          body_html: email.bodyHtml,
          body_preview: email.preview,
          tags: email.tags || [],
          category: email.category,
          sent_at: email.timestamp || email.date || new Date().toISOString(),
          received_at: email.receivedAt || new Date().toISOString(),
          embedding: email.embedding,
          token_count: email.tokenCount,
          has_attachments: email.hasAttachments || false,
          attachment_names: email.attachmentNames || [],
          is_read: email.isRead || false,
          is_starred: email.isStarred || false,
          is_archived: email.isArchived || false,
          metadata: {
            source: email.source,
            indexedAt: new Date().toISOString(),
            ...email.metadata
          }
        }, {
          onConflict: 'user_id,provider,message_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;

      this.logger.debug('Stored email', {
        userId,
        messageId: email.messageId,
        subject: email.subject
      });

      return data;

    } catch (error) {
      this.logger.error('Failed to store email', {
        userId,
        messageId: email.messageId,
        error: error.message
      });
      throw new Error(`Failed to store email: ${error.message}`);
    }
  }

  /**
   * Store multiple emails in batches
   * @param {Array} emails - Array of email objects with embeddings
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result with success/failure counts
   */
  async storeEmails(emails, userId) {
    const batchSize = this.options.batchSize;
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    this.logger.info(`Storing ${emails.length} emails in batches of ${batchSize}`);

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      try {
        const records = batch.map(email => ({
          user_id: userId,
          message_id: email.messageId,
          thread_id: email.threadId,
          provider: email.provider,
          provider_account: email.providerAccount,
          from_address: email.from,
          from_name: email.fromName || email.company,
          to_addresses: email.to ? (Array.isArray(email.to) ? email.to : [email.to]) : [],
          cc_addresses: email.cc || [],
          subject: email.subject,
          body_text: email.body || email.preview,
          body_html: email.bodyHtml,
          body_preview: email.preview,
          tags: email.tags || [],
          category: email.category,
          sent_at: email.timestamp || email.date || new Date().toISOString(),
          received_at: email.receivedAt || new Date().toISOString(),
          embedding: email.embedding,
          token_count: email.tokenCount,
          has_attachments: email.hasAttachments || false,
          attachment_names: email.attachmentNames || [],
          is_read: email.isRead || false,
          is_starred: email.isStarred || false,
          is_archived: email.isArchived || false,
          metadata: {
            source: email.source,
            indexedAt: new Date().toISOString(),
            ...email.metadata
          }
        }));

        const { data, error } = await this.supabase
          .from('email_chunks')
          .upsert(records, {
            onConflict: 'user_id,provider,message_id',
            ignoreDuplicates: false
          });

        if (error) throw error;

        successCount += batch.length;
        this.logger.info(`Batch ${Math.floor(i / batchSize) + 1} stored successfully`, {
          count: batch.length,
          total: successCount
        });

      } catch (error) {
        failureCount += batch.length;
        errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.message
        });
        this.logger.error('Batch storage failed', {
          batch: Math.floor(i / batchSize) + 1,
          error: error.message
        });
      }
    }

    return {
      success: successCount,
      failed: failureCount,
      errors: errors
    };
  }

  /**
   * Search emails by semantic similarity
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {string} userId - User ID
   * @param {Object} filters - Search filters
   * @returns {Promise<Array>} Matching emails with similarity scores
   */
  async searchEmails(queryEmbedding, userId, filters = {}) {
    try {
      const { data, error } = await this.supabase
        .rpc('search_email_chunks', {
          query_embedding: queryEmbedding,
          search_user_id: userId,
          search_provider: filters.provider || null,
          search_category: filters.category || null,
          search_tags: filters.tags || null,
          date_from: filters.dateFrom || null,
          date_to: filters.dateTo || null,
          match_threshold: filters.threshold || 0.5,
          match_count: filters.limit || 10
        });

      if (error) throw error;

      this.logger.info('Email search completed', {
        userId,
        resultCount: data.length,
        filters
      });

      return data;

    } catch (error) {
      this.logger.error('Email search failed', {
        userId,
        error: error.message
      });
      throw new Error(`Email search failed: ${error.message}`);
    }
  }

  /**
   * Get email by message ID
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @returns {Promise<Object>} Email object
   */
  async getEmailByMessageId(messageId, userId, provider) {
    try {
      const { data, error } = await this.supabase
        .from('email_chunks')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('message_id', messageId)
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      this.logger.error('Failed to get email', {
        messageId,
        userId,
        error: error.message
      });
      throw new Error(`Failed to get email: ${error.message}`);
    }
  }

  /**
   * Check if email is already indexed
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>} True if indexed
   */
  async isEmailIndexed(messageId, userId, provider) {
    const email = await this.getEmailByMessageId(messageId, userId, provider);
    return email !== null;
  }

  /**
   * Get user email statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Email statistics
   */
  async getUserEmailStats(userId) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_email_stats', {
          search_user_id: userId
        });

      if (error) throw error;

      return data[0] || {
        total_emails: 0,
        indexed_emails: 0,
        providers: {},
        categories: {},
        date_range: {}
      };

    } catch (error) {
      this.logger.error('Failed to get email stats', {
        userId,
        error: error.message
      });
      throw new Error(`Failed to get email stats: ${error.message}`);
    }
  }

  /**
   * Initialize indexing status for a user/provider
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @param {string} providerAccount - Provider account
   * @returns {Promise<Object>} Status object
   */
  async initializeIndexingStatus(userId, provider, providerAccount = null) {
    try {
      const { data, error } = await this.supabase
        .from('email_indexing_status')
        .upsert({
          user_id: userId,
          provider: provider,
          provider_account: providerAccount,
          status: 'pending',
          total_emails: 0,
          indexed_emails: 0,
          progress_percentage: 0,
          metadata: {
            initializedAt: new Date().toISOString()
          }
        }, {
          onConflict: 'user_id,provider,provider_account',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      this.logger.error('Failed to initialize indexing status', {
        userId,
        provider,
        error: error.message
      });
      throw new Error(`Failed to initialize indexing status: ${error.message}`);
    }
  }

  /**
   * Update indexing status
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @param {Object} updates - Status updates
   * @returns {Promise<Object>} Updated status
   */
  async updateIndexingStatus(userId, provider, updates) {
    try {
      // Use upsert to handle both create and update cases
      const { data, error } = await this.supabase
        .from('email_indexing_status')
        .upsert({
          user_id: userId,
          provider: provider,
          provider_account: null, // Default for the unique constraint
          ...updates,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,provider,provider_account',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      this.logger.error('Failed to update indexing status', {
        userId,
        provider,
        error: error.message
      });
      throw new Error(`Failed to update indexing status: ${error.message}`);
    }
  }

  /**
   * Get indexing status for a user/provider
   * @param {string} userId - User ID
   * @param {string} provider - Provider name (optional)
   * @returns {Promise<Object|Array>} Status object(s)
   */
  async getIndexingStatus(userId, provider = null) {
    try {
      let query = this.supabase
        .from('email_indexing_status')
        .select('*')
        .eq('user_id', userId);

      if (provider) {
        query = query.eq('provider', provider);
        const { data, error } = await query.single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await query;
        if (error) throw error;
        return data;
      }

    } catch (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return provider ? null : [];
      }
      this.logger.error('Failed to get indexing status', {
        userId,
        provider,
        error: error.message
      });
      throw new Error(`Failed to get indexing status: ${error.message}`);
    }
  }

  /**
   * Delete all emails for a user (for re-indexing)
   * @param {string} userId - User ID
   * @param {string} provider - Provider name (optional)
   * @returns {Promise<number>} Number of deleted emails
   */
  async deleteUserEmails(userId, provider = null) {
    try {
      let query = this.supabase
        .from('email_chunks')
        .delete()
        .eq('user_id', userId);

      if (provider) {
        query = query.eq('provider', provider);
      }

      const { data, error } = await query;
      if (error) throw error;

      this.logger.info('Deleted user emails', {
        userId,
        provider,
        count: data?.length || 0
      });

      return data?.length || 0;

    } catch (error) {
      this.logger.error('Failed to delete user emails', {
        userId,
        provider,
        error: error.message
      });
      throw new Error(`Failed to delete user emails: ${error.message}`);
    }
  }
}

module.exports = EmailVectorStore;
