/**
 * Embedding Service
 * 
 * Generates vector embeddings for code chunks using OpenAI's embedding API.
 * Handles batching, caching, and rate limiting.
 * 
 * Features:
 * 1. Generate embeddings using text-embedding-3-small
 * 2. Batch processing for efficiency
 * 3. Rate limiting and retry logic
 * 4. Cost tracking
 * 5. Cache support
 */

const winston = require('winston');
const crypto = require('crypto');

class EmbeddingService {
  constructor(options = {}) {
    this.options = {
      openaiApiKey: options.openaiApiKey || process.env.OPENAI_API_KEY,
      model: options.model || 'text-embedding-3-small',
      dimensions: options.dimensions || 1536,
      batchSize: options.batchSize || 20, // OpenAI allows up to 2048 per batch
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      logLevel: options.logLevel || 'info',
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
        new winston.transports.File({ filename: 'logs/embedding-service.log' })
      ],
      defaultMeta: { service: 'embedding-service' }
    });

    this.embeddingCache = new Map(); // Simple in-memory cache
    this.stats = {
      totalEmbeddings: 0,
      totalTokens: 0,
      cacheHits: 0,
      apiCalls: 0,
      estimatedCost: 0
    };

    if (!this.options.openaiApiKey) {
      throw new Error('OpenAI API key is required for embedding service');
    }

    this.logger.info('Embedding Service initialized', {
      model: this.options.model,
      dimensions: this.options.dimensions
    });
  }

  /**
   * Generate cache key for content
   * @private
   */
  _getCacheKey(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Call OpenAI API to generate embeddings
   * @private
   */
  async _callOpenAI(texts, attempt = 1) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.options.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.options.model,
          input: texts,
          dimensions: this.options.dimensions
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
      }

      const data = await response.json();
      
      // Update stats
      this.stats.apiCalls++;
      this.stats.totalTokens += data.usage.total_tokens;
      this.stats.estimatedCost += (data.usage.total_tokens / 1000000) * 0.02; // $0.02 per 1M tokens

      return data;

    } catch (error) {
      if (attempt < this.options.maxRetries) {
        this.logger.warn('OpenAI API call failed, retrying', {
          attempt,
          maxRetries: this.options.maxRetries,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempt));
        return this._callOpenAI(texts, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} Embedding vector
   */
  async generateEmbedding(text) {
    const cacheKey = this._getCacheKey(text);
    
    // Check cache
    if (this.embeddingCache.has(cacheKey)) {
      this.stats.cacheHits++;
      this.logger.debug('Cache hit for embedding');
      return this.embeddingCache.get(cacheKey);
    }

    try {
      this.logger.debug('Generating embedding', {
        textLength: text.length
      });

      const data = await this._callOpenAI([text]);
      const embedding = data.data[0].embedding;

      // Cache the result
      this.embeddingCache.set(cacheKey, embedding);
      this.stats.totalEmbeddings++;

      return embedding;

    } catch (error) {
      this.logger.error('Failed to generate embedding', {
        error: error.message,
        textLength: text.length
      });
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Promise<Array>} Array of embedding vectors
   */
  /**
   * Truncate text to stay within token limit
   * @private
   */
  _truncateText(text, maxTokens = 2000) {
    // Rough estimate: 4 chars per token (conservative)
    // Use a lower limit to account for batch processing overhead
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }

    this.logger.warn('Text exceeds token limit, truncating', {
      originalLength: text.length,
      truncatedLength: maxChars,
      estimatedOriginalTokens: Math.ceil(text.length / 4),
      maxTokens
    });

    return text.substring(0, maxChars);
  }

  async generateEmbeddings(texts) {
    this.logger.info('Generating embeddings in batches', {
      totalTexts: texts.length,
      batchSize: this.options.batchSize
    });

    const embeddings = [];
    const startTime = Date.now();

    // Check cache first and truncate texts that are too long
    const uncachedTexts = [];
    const uncachedIndices = [];

    for (let i = 0; i < texts.length; i++) {
      // Truncate text if it's too long (safety check)
      const truncatedText = this._truncateText(texts[i]);
      const cacheKey = this._getCacheKey(truncatedText);
      
      if (this.embeddingCache.has(cacheKey)) {
        embeddings[i] = this.embeddingCache.get(cacheKey);
        this.stats.cacheHits++;
      } else {
        uncachedTexts.push(truncatedText);
        uncachedIndices.push(i);
      }
    }

    this.logger.debug('Cache check complete', {
      cached: texts.length - uncachedTexts.length,
      uncached: uncachedTexts.length
    });

    // Process uncached texts in batches
    for (let i = 0; i < uncachedTexts.length; i += this.options.batchSize) {
      const batch = uncachedTexts.slice(i, i + this.options.batchSize);
      const batchIndices = uncachedIndices.slice(i, i + this.options.batchSize);
      
      this.logger.debug('Processing batch', {
        batchNumber: Math.floor(i / this.options.batchSize) + 1,
        batchSize: batch.length
      });

      try {
        const data = await this._callOpenAI(batch);
        
        // Store embeddings in correct positions
        for (let j = 0; j < data.data.length; j++) {
          const embedding = data.data[j].embedding;
          const originalIndex = batchIndices[j];
          embeddings[originalIndex] = embedding;
          
          // Cache the result
          const cacheKey = this._getCacheKey(batch[j]);
          this.embeddingCache.set(cacheKey, embedding);
          this.stats.totalEmbeddings++;
        }

        // Small delay between batches to respect rate limits
        if (i + this.options.batchSize < uncachedTexts.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        this.logger.error('Batch embedding failed', {
          batchNumber: Math.floor(i / this.options.batchSize) + 1,
          error: error.message
        });
        
        // Fill with null for failed embeddings
        for (const index of batchIndices) {
          embeddings[index] = null;
        }
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.info('Embeddings generated', {
      total: texts.length,
      successful: embeddings.filter(e => e !== null).length,
      failed: embeddings.filter(e => e === null).length,
      processingTimeMs: processingTime
    });

    return embeddings;
  }

  /**
   * Generate embeddings for code chunks
   * @param {Array<Object>} chunks - Array of chunk objects with 'content' field
   * @returns {Promise<Array>} Chunks with embeddings added
   */
  async embedChunks(chunks) {
    this.logger.info('Embedding code chunks', { chunkCount: chunks.length });

    const texts = chunks.map(chunk => chunk.content);
    const embeddings = await this.generateEmbeddings(texts);

    const embeddedChunks = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index]
    })).filter(chunk => chunk.embedding !== null); // Filter out failed embeddings

    this.logger.info('Chunks embedded', {
      total: chunks.length,
      successful: embeddedChunks.length,
      failed: chunks.length - embeddedChunks.length
    });

    return embeddedChunks;
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.embeddingCache.size,
      cacheHitRate: this.stats.totalEmbeddings > 0 
        ? (this.stats.cacheHits / (this.stats.totalEmbeddings + this.stats.cacheHits) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache() {
    const previousSize = this.embeddingCache.size;
    this.embeddingCache.clear();
    this.logger.info('Cache cleared', { previousSize });
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalEmbeddings: 0,
      totalTokens: 0,
      cacheHits: 0,
      apiCalls: 0,
      estimatedCost: 0
    };
    this.logger.info('Statistics reset');
  }

  /**
   * Alias for generateEmbedding (for convenience)
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} Embedding vector
   */
  async embed(text) {
    return this.generateEmbedding(text);
  }

  /**
   * Alias for generateEmbeddings (for convenience)
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Promise<Array>} Array of embedding vectors
   */
  async embedBatch(texts) {
    return this.generateEmbeddings(texts);
  }
}

module.exports = EmbeddingService;

