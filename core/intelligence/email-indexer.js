/**
 * Email Indexer
 *
 * Indexes email messages into vector database for semantic search.
 * Similar to code-indexer but specialized for email content.
 *
 * Features:
 * 1. Index emails from Gmail, Outlook, LinkedIn
 * 2. Generate embeddings for email content
 * 3. Store in Supabase pgvector
 * 4. Track indexing progress
 * 5. Handle incremental updates
 */

const EventEmitter = require('events');
const EmailVectorStore = require('../../data/storage/email-vector-store');
const EmbeddingService = require('./embedding-service');

class EmailIndexer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      batchSize: options.batchSize || 20,
      maxConcurrent: options.maxConcurrent || 3,
      ...options
    };

    this.vectorStore = new EmailVectorStore({
      batchSize: this.options.batchSize
    });

    this.embeddingService = new EmbeddingService({
      batchSize: this.options.batchSize
    });

    this.isIndexing = false;
  }

  /**
   * Index emails for a user
   * @param {Array} emails - Array of email objects
   * @param {string} userId - User ID
   * @param {string} provider - Provider name ('gmail', 'outlook', 'linkedin')
   * @returns {Promise<Object>} Indexing result
   */
  async indexEmails(emails, userId, provider) {
    if (this.isIndexing) {
      throw new Error('Indexing already in progress');
    }

    this.isIndexing = true;
    const startTime = Date.now();

    try {
      this.emit('start', {
        totalEmails: emails.length,
        userId,
        provider
      });

      // Step 1: Initialize status
      await this.vectorStore.initializeIndexingStatus(userId, provider);
      this.emit('statusUpdate', {
        status: 'initialized',
        message: 'Starting email indexing...'
      });

      // Step 2: Filter out already-indexed emails
      const { newEmails, skippedCount } = await this.filterNewEmails(emails, userId, provider);

      if (newEmails.length === 0) {
        this.emit('complete', {
          message: 'All emails already indexed',
          skipped: skippedCount,
          duration: Date.now() - startTime
        });
        return {
          success: true,
          indexed: 0,
          skipped: skippedCount,
          failed: 0
        };
      }

      this.emit('statusUpdate', {
        status: 'filtering',
        message: `${newEmails.length} new emails to index, ${skippedCount} already indexed`
      });

      // Step 3: Prepare email content for embedding
      const emailTexts = newEmails.map(email => this.prepareEmailText(email));

      this.emit('statusUpdate', {
        status: 'embedding',
        message: `Generating embeddings for ${emailTexts.length} emails...`
      });

      // Step 4: Generate embeddings in batches
      const embeddings = await this.embeddingService.embedBatch(emailTexts);

      this.emit('progress', {
        phase: 'embedding',
        completed: embeddings.length,
        total: emailTexts.length
      });

      // Step 5: Attach embeddings to emails
      const emailsWithEmbeddings = newEmails.map((email, index) => ({
        ...email,
        embedding: embeddings[index],
        tokenCount: this.estimateTokenCount(emailTexts[index])
      }));

      this.emit('statusUpdate', {
        status: 'storing',
        message: `Storing ${emailsWithEmbeddings.length} emails in vector database...`
      });

      // Step 6: Store in vector database
      const result = await this.vectorStore.storeEmails(emailsWithEmbeddings, userId);

      // Step 7: Update indexing status
      await this.vectorStore.updateIndexingStatus(userId, provider, {
        status: 'completed',
        total_emails: emails.length,
        indexed_emails: result.success,
        failed_emails: result.failed,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });

      this.emit('complete', {
        indexed: result.success,
        skipped: skippedCount,
        failed: result.failed,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        indexed: result.success,
        skipped: skippedCount,
        failed: result.failed,
        errors: result.errors
      };

    } catch (error) {
      await this.vectorStore.updateIndexingStatus(userId, provider, {
        status: 'failed',
        error_message: error.message,
        error_count: 1
      });

      this.emit('error', {
        message: error.message,
        stack: error.stack
      });

      throw error;

    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Filter out emails that are already indexed
   * @param {Array} emails - Array of email objects
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @returns {Promise<Object>} New emails and skipped count
   */
  async filterNewEmails(emails, userId, provider) {
    const newEmails = [];
    let skippedCount = 0;

    for (const email of emails) {
      const messageId = email.id || email.messageId;
      if (!messageId) {
        console.warn('Email missing message ID, skipping:', email.subject);
        continue;
      }

      const isIndexed = await this.vectorStore.isEmailIndexed(messageId, userId, provider);
      if (isIndexed) {
        skippedCount++;
      } else {
        newEmails.push({
          ...email,
          messageId: messageId,
          provider: provider
        });
      }
    }

    return { newEmails, skippedCount };
  }

  /**
   * Prepare email text for embedding
   * Combines subject, body, and metadata into searchable text
   * @param {Object} email - Email object
   * @returns {string} Prepared text
   */
  prepareEmailText(email) {
    const parts = [];

    // Add from info
    if (email.company || email.fromName) {
      parts.push(`From: ${email.company || email.fromName}`);
    }
    if (email.from) {
      parts.push(`Email: ${email.from}`);
    }

    // Add subject
    if (email.subject) {
      parts.push(`Subject: ${email.subject}`);
    }

    // Add body/preview
    if (email.body) {
      parts.push(`Content: ${email.body}`);
    } else if (email.preview) {
      parts.push(`Content: ${email.preview}`);
    }

    // Add tags
    if (email.tags && email.tags.length > 0) {
      parts.push(`Tags: ${email.tags.join(', ')}`);
    }

    // Add category
    if (email.category) {
      parts.push(`Category: ${email.category}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Estimate token count for text
   * Rough estimation: ~4 characters per token
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Index a single email immediately
   * Useful for real-time indexing of new emails
   * @param {Object} email - Email object
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @returns {Promise<Object>} Result
   */
  async indexSingleEmail(email, userId, provider) {
    try {
      // Check if already indexed
      const messageId = email.id || email.messageId;
      if (await this.vectorStore.isEmailIndexed(messageId, userId, provider)) {
        return { success: true, indexed: false, reason: 'already_indexed' };
      }

      // Prepare and embed
      const text = this.prepareEmailText(email);
      const embedding = await this.embeddingService.embed(text);

      // Store
      const emailWithEmbedding = {
        ...email,
        messageId: messageId,
        provider: provider,
        embedding: embedding,
        tokenCount: this.estimateTokenCount(text)
      };

      await this.vectorStore.storeEmail(emailWithEmbedding, userId);

      return { success: true, indexed: true };

    } catch (error) {
      console.error('Failed to index single email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Re-index all emails for a user (clears existing and re-indexes)
   * @param {Array} emails - Array of email objects
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @returns {Promise<Object>} Result
   */
  async reindexEmails(emails, userId, provider) {
    // Delete existing emails
    await this.vectorStore.deleteUserEmails(userId, provider);

    // Index all emails (will skip filtering step)
    return this.indexEmails(emails, userId, provider);
  }

  /**
   * Get indexing statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getStats(userId) {
    const stats = await this.vectorStore.getUserEmailStats(userId);
    const statuses = await this.vectorStore.getIndexingStatus(userId);

    return {
      ...stats,
      providers: statuses
    };
  }
}

module.exports = EmailIndexer;
