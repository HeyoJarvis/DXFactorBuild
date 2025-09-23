/**
 * Base Adapter - Foundation class for all signal ingestion adapters
 * 
 * Provides common functionality for:
 * 1. Source polling and scheduling
 * 2. Error handling and retry logic
 * 3. Rate limiting and throttling
 * 4. Content extraction and normalization
 * 5. Quality assessment and filtering
 */

const EventEmitter = require('events');
const axios = require('axios');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

class BaseAdapter extends EventEmitter {
  constructor(source, options = {}) {
    super();
    
    this.source = source;
    this.options = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 5000,
      userAgent: 'HeyJarvis/1.0 (Competitive Intelligence Bot)',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'signal-adapter',
        source_id: source.id,
        source_name: source.name
      }
    });
    
    this.isPolling = false;
    this.pollCount = 0;
    this.lastPollTime = null;
    this.consecutiveErrors = 0;
  }
  
  /**
   * Main polling method - to be implemented by specific adapters
   */
  async poll() {
    throw new Error('poll() method must be implemented by subclass');
  }
  
  /**
   * Start continuous polling based on source configuration
   */
  async startPolling() {
    if (this.isPolling) {
      this.logger.warn('Polling already started');
      return;
    }
    
    this.isPolling = true;
    this.logger.info('Starting polling', {
      interval_minutes: this.source.polling_config.interval_minutes,
      url: this.source.url
    });
    
    // Initial poll
    await this.executePoll();
    
    // Schedule recurring polls
    this.pollInterval = setInterval(async () => {
      if (this.shouldPoll()) {
        await this.executePoll();
      }
    }, this.source.polling_config.interval_minutes * 60 * 1000);
    
    this.emit('polling_started', { source_id: this.source.id });
  }
  
  /**
   * Stop polling
   */
  stopPolling() {
    if (!this.isPolling) return;
    
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    this.logger.info('Polling stopped');
    this.emit('polling_stopped', { source_id: this.source.id });
  }
  
  /**
   * Execute a single poll with error handling and metrics
   */
  async executePoll() {
    const startTime = Date.now();
    const pollId = uuidv4();
    
    this.logger.info('Starting poll', { poll_id: pollId });
    
    try {
      // Check rate limits
      await this.checkRateLimit();
      
      // Execute the poll
      const result = await this.poll();
      
      // Process and validate results
      const processedResult = await this.processResult(result, pollId);
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateSuccessMetrics(processedResult, processingTime);
      
      // Emit success event
      this.emit('poll_success', {
        source_id: this.source.id,
        poll_id: pollId,
        items_found: processedResult.items?.length || 0,
        processing_time_ms: processingTime
      });
      
      this.logger.info('Poll completed successfully', {
        poll_id: pollId,
        items_found: processedResult.items?.length || 0,
        processing_time_ms: processingTime
      });
      
      return processedResult;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.handlePollError(error, pollId, processingTime);
      throw error;
    }
  }
  
  /**
   * Check if we should poll now based on configuration
   */
  shouldPoll() {
    const config = this.source.polling_config;
    const now = new Date();
    
    // Check active hours
    if (config.active_hours) {
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const [startHour, startMin] = config.active_hours.start.split(':').map(Number);
      const [endHour, endMin] = config.active_hours.end.split(':').map(Number);
      const startTime = startHour * 100 + startMin;
      const endTime = endHour * 100 + endMin;
      
      if (currentTime < startTime || currentTime > endTime) {
        return false;
      }
    }
    
    // Check weekend skip
    if (config.skip_weekends) {
      const dayOfWeek = now.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
      }
    }
    
    // Check if we're in error backoff
    if (this.consecutiveErrors > 0) {
      const backoffTime = config.retry_backoff_minutes * 60 * 1000;
      const timeSinceLastError = Date.now() - (this.lastErrorTime || 0);
      if (timeSinceLastError < backoffTime) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Rate limiting check
   */
  async checkRateLimit() {
    const config = this.source.polling_config;
    const now = Date.now();
    
    // Simple rate limiting implementation
    if (!this.rateLimitWindow) {
      this.rateLimitWindow = {
        start: now,
        requests: 0
      };
    }
    
    // Reset window if minute has passed
    if (now - this.rateLimitWindow.start > 60000) {
      this.rateLimitWindow = {
        start: now,
        requests: 0
      };
    }
    
    // Check if we've exceeded rate limit
    if (this.rateLimitWindow.requests >= config.requests_per_minute) {
      const waitTime = 60000 - (now - this.rateLimitWindow.start);
      this.logger.warn('Rate limit reached, waiting', { wait_ms: waitTime });
      await this.sleep(waitTime);
      
      // Reset window
      this.rateLimitWindow = {
        start: Date.now(),
        requests: 0
      };
    }
    
    this.rateLimitWindow.requests++;
  }
  
  /**
   * Process and validate poll results
   */
  async processResult(result, pollId) {
    if (!result || !result.items || !Array.isArray(result.items)) {
      throw new Error('Invalid result format: must contain items array');
    }
    
    const config = this.source.extraction_config;
    const processedItems = [];
    
    for (const item of result.items) {
      try {
        // Validate required fields
        if (!item.title || !item.url) {
          this.logger.warn('Skipping item missing required fields', { 
            poll_id: pollId,
            item_partial: { title: item.title, url: item.url }
          });
          continue;
        }
        
        // Content length validation
        if (item.content && item.content.length < config.min_content_length) {
          this.logger.debug('Skipping item with insufficient content', {
            poll_id: pollId,
            content_length: item.content?.length,
            min_required: config.min_content_length
          });
          continue;
        }
        
        if (item.content && item.content.length > config.max_content_length) {
          item.content = item.content.substring(0, config.max_content_length) + '...';
        }
        
        // Normalize the item
        const normalizedItem = this.normalizeItem(item);
        
        // Add metadata
        normalizedItem.source_id = this.source.id;
        normalizedItem.discovered_at = new Date();
        normalizedItem.poll_id = pollId;
        
        processedItems.push(normalizedItem);
        
      } catch (error) {
        this.logger.warn('Error processing item', {
          poll_id: pollId,
          error: error.message,
          item_url: item.url
        });
      }
    }
    
    return {
      ...result,
      items: processedItems,
      valid_items: processedItems.length,
      total_items: result.items.length
    };
  }
  
  /**
   * Normalize item data to standard format
   */
  normalizeItem(item) {
    return {
      id: uuidv4(),
      title: this.cleanText(item.title),
      summary: this.cleanText(item.summary || item.description || ''),
      content: this.cleanText(item.content || ''),
      url: item.url,
      published_at: this.parseDate(item.published_at || item.pubDate || item.date),
      author: this.cleanText(item.author || ''),
      category: this.inferCategory(item),
      priority: 'medium', // Will be updated by relevance engine
      trust_level: this.source.trust_score > 0.7 ? 'reliable' : 'unverified',
      status: 'raw',
      keywords: this.extractKeywords(item.title + ' ' + (item.summary || '')),
      language: item.language || this.source.extraction_config.expected_language || 'en'
    };
  }
  
  /**
   * Clean and normalize text content
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/[\r\n]+/g, ' ')  // Remove line breaks
      .trim()
      .substring(0, 10000);  // Reasonable length limit
  }
  
  /**
   * Parse various date formats
   */
  parseDate(dateString) {
    if (!dateString) return new Date();
    
    if (dateString instanceof Date) return dateString;
    
    // Try parsing common formats
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) return parsed;
    
    // Fallback to current time
    this.logger.warn('Could not parse date, using current time', { 
      date_string: dateString 
    });
    return new Date();
  }
  
  /**
   * Infer signal category from content
   */
  inferCategory(item) {
    const text = (item.title + ' ' + (item.summary || '')).toLowerCase();
    
    const categoryKeywords = {
      'product_launch': ['launch', 'release', 'announce', 'unveil', 'introduce'],
      'funding': ['funding', 'investment', 'raised', 'series', 'venture'],
      'acquisition': ['acquire', 'merger', 'bought', 'purchase', 'deal'],
      'partnership': ['partner', 'collaboration', 'alliance', 'joint'],
      'leadership_change': ['ceo', 'cto', 'founder', 'executive', 'appoint'],
      'pricing_change': ['price', 'pricing', 'cost', 'subscription', 'plan']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }
    
    return 'competitive_analysis'; // Default category
  }
  
  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    if (!text) return [];
    
    // Simple keyword extraction - can be enhanced with NLP
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
    
    // Return unique words, limited to top 10
    return [...new Set(words)].slice(0, 10);
  }
  
  /**
   * Check if word is a stop word
   */
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'is', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'they', 'them', 'their', 'there', 'then', 'than'
    ]);
    
    return stopWords.has(word);
  }
  
  /**
   * Update success metrics
   */
  updateSuccessMetrics(result, processingTime) {
    this.pollCount++;
    this.lastPollTime = new Date();
    this.consecutiveErrors = 0;
    
    // Emit metrics for external tracking
    this.emit('metrics_update', {
      source_id: this.source.id,
      success: true,
      items_found: result.items?.length || 0,
      valid_items: result.valid_items || 0,
      processing_time_ms: processingTime
    });
  }
  
  /**
   * Handle poll errors
   */
  handlePollError(error, pollId, processingTime) {
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();
    
    const errorInfo = {
      source_id: this.source.id,
      poll_id: pollId,
      error_type: error.name || 'UnknownError',
      error_message: error.message,
      consecutive_errors: this.consecutiveErrors,
      processing_time_ms: processingTime
    };
    
    // Add HTTP status if available
    if (error.response?.status) {
      errorInfo.http_status = error.response.status;
    }
    
    this.logger.error('Poll failed', errorInfo);
    
    // Emit error event
    this.emit('poll_error', errorInfo);
    
    // Emit metrics update
    this.emit('metrics_update', {
      source_id: this.source.id,
      success: false,
      error: errorInfo
    });
  }
  
  /**
   * Create HTTP client with source configuration
   */
  createHttpClient() {
    const config = {
      timeout: this.source.polling_config.timeout_seconds * 1000,
      headers: {
        'User-Agent': this.options.userAgent
      }
    };
    
    // Add authentication headers
    const auth = this.source.auth_config;
    if (auth.type === 'api_key' && auth.api_key) {
      config.headers[auth.api_key_header] = auth.api_key;
    } else if (auth.type === 'bearer' && auth.bearer_token) {
      config.headers['Authorization'] = `Bearer ${auth.bearer_token}`;
    } else if (auth.type === 'basic' && auth.username && auth.password) {
      config.auth = {
        username: auth.username,
        password: auth.password
      };
    }
    
    // Add custom headers
    Object.assign(config.headers, auth.custom_headers || {});
    
    return axios.create(config);
  }
  
  /**
   * Utility method to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get adapter status
   */
  getStatus() {
    return {
      is_polling: this.isPolling,
      poll_count: this.pollCount,
      last_poll_time: this.lastPollTime,
      consecutive_errors: this.consecutiveErrors,
      source_id: this.source.id,
      source_status: this.source.status
    };
  }
}

module.exports = BaseAdapter;
