/**
 * Signal Ingestion Scheduler - Orchestrates polling of all active sources
 * 
 * Features:
 * 1. Manages polling schedules for all sources
 * 2. Load balancing and resource management
 * 3. Error handling and retry logic
 * 4. Health monitoring and alerting
 * 5. Graceful shutdown and recovery
 */

const EventEmitter = require('events');
const cron = require('cron');
const winston = require('winston');
const RSSAdapter = require('./adapters/rss-adapter');
const { SourceHelpers } = require('@heyjarvis/data');

class IngestionScheduler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxConcurrentSources: 10,
      healthCheckInterval: 300000, // 5 minutes
      retryFailedSourcesInterval: 1800000, // 30 minutes
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'ingestion-scheduler' }
    });
    
    this.sources = new Map(); // sourceId -> source config
    this.adapters = new Map(); // sourceId -> adapter instance
    this.schedules = new Map(); // sourceId -> cron job
    this.isRunning = false;
    
    // Statistics
    this.stats = {
      total_sources: 0,
      active_sources: 0,
      failed_sources: 0,
      total_polls: 0,
      successful_polls: 0,
      failed_polls: 0,
      items_ingested: 0,
      last_reset: new Date()
    };
    
    // Health monitoring
    this.healthCheckJob = null;
    this.retryJob = null;
  }
  
  /**
   * Start the scheduler
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Scheduler already running');
      return;
    }
    
    this.isRunning = true;
    this.logger.info('Starting ingestion scheduler', {
      max_concurrent: this.options.maxConcurrentSources
    });
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Start retry job for failed sources
    this.startRetryJob();
    
    this.emit('scheduler_started');
  }
  
  /**
   * Stop the scheduler
   */
  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.logger.info('Stopping ingestion scheduler');
    
    // Stop all adapters
    for (const [sourceId, adapter] of this.adapters) {
      try {
        await this.stopSource(sourceId);
      } catch (error) {
        this.logger.error('Error stopping source', { sourceId, error: error.message });
      }
    }
    
    // Stop monitoring jobs
    if (this.healthCheckJob) {
      this.healthCheckJob.destroy();
      this.healthCheckJob = null;
    }
    
    if (this.retryJob) {
      this.retryJob.destroy();
      this.retryJob = null;
    }
    
    this.emit('scheduler_stopped');
  }
  
  /**
   * Add a source to the scheduler
   */
  async addSource(source) {
    if (this.sources.has(source.id)) {
      this.logger.warn('Source already exists', { source_id: source.id });
      return;
    }
    
    try {
      // Validate source configuration
      this.validateSource(source);
      
      // Create adapter for source type
      const adapter = this.createAdapter(source);
      
      // Store source and adapter
      this.sources.set(source.id, source);
      this.adapters.set(source.id, adapter);
      
      // Set up event listeners
      this.setupAdapterListeners(adapter, source);
      
      // Schedule the source if it's active
      if (source.status === 'active' && this.isRunning) {
        await this.scheduleSource(source);
      }
      
      this.stats.total_sources++;
      if (source.status === 'active') {
        this.stats.active_sources++;
      }
      
      this.logger.info('Source added', {
        source_id: source.id,
        source_name: source.name,
        source_type: source.type,
        status: source.status
      });
      
      this.emit('source_added', { source_id: source.id, source });
      
    } catch (error) {
      this.logger.error('Failed to add source', {
        source_id: source.id,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Remove a source from the scheduler
   */
  async removeSource(sourceId) {
    if (!this.sources.has(sourceId)) {
      this.logger.warn('Source not found', { source_id: sourceId });
      return;
    }
    
    try {
      // Stop the source
      await this.stopSource(sourceId);
      
      // Remove from maps
      const source = this.sources.get(sourceId);
      this.sources.delete(sourceId);
      this.adapters.delete(sourceId);
      
      this.stats.total_sources--;
      if (source.status === 'active') {
        this.stats.active_sources--;
      }
      
      this.logger.info('Source removed', { source_id: sourceId });
      this.emit('source_removed', { source_id: sourceId });
      
    } catch (error) {
      this.logger.error('Failed to remove source', {
        source_id: sourceId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Update a source configuration
   */
  async updateSource(sourceId, updates) {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }
    
    try {
      // Update source configuration
      const updatedSource = { ...source, ...updates, updated_at: new Date() };
      this.validateSource(updatedSource);
      
      // Stop current scheduling
      await this.stopSource(sourceId);
      
      // Update stored source
      this.sources.set(sourceId, updatedSource);
      
      // Recreate adapter if type changed
      if (updates.type && updates.type !== source.type) {
        const oldAdapter = this.adapters.get(sourceId);
        if (oldAdapter) {
          oldAdapter.removeAllListeners();
        }
        
        const newAdapter = this.createAdapter(updatedSource);
        this.adapters.set(sourceId, newAdapter);
        this.setupAdapterListeners(newAdapter, updatedSource);
      }
      
      // Reschedule if active
      if (updatedSource.status === 'active' && this.isRunning) {
        await this.scheduleSource(updatedSource);
      }
      
      // Update stats
      if (source.status !== updatedSource.status) {
        if (source.status === 'active') this.stats.active_sources--;
        if (updatedSource.status === 'active') this.stats.active_sources++;
      }
      
      this.logger.info('Source updated', {
        source_id: sourceId,
        changes: Object.keys(updates)
      });
      
      this.emit('source_updated', { source_id: sourceId, source: updatedSource });
      
    } catch (error) {
      this.logger.error('Failed to update source', {
        source_id: sourceId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Schedule a source for polling
   */
  async scheduleSource(source) {
    if (this.schedules.has(source.id)) {
      // Stop existing schedule
      const existingJob = this.schedules.get(source.id);
      existingJob.destroy();
    }
    
    // Calculate cron pattern from interval
    const intervalMinutes = source.polling_config.interval_minutes;
    const cronPattern = this.intervalToCron(intervalMinutes);
    
    // Create cron job
    const job = new cron.CronJob(cronPattern, async () => {
      await this.pollSource(source.id);
    }, null, false, 'UTC');
    
    // Start the job
    job.start();
    this.schedules.set(source.id, job);
    
    // Calculate next poll time
    const nextPollTime = SourceHelpers.calculateNextPollTime(source);
    
    this.logger.info('Source scheduled', {
      source_id: source.id,
      cron_pattern: cronPattern,
      next_poll: nextPollTime
    });
  }
  
  /**
   * Stop scheduling for a source
   */
  async stopSource(sourceId) {
    // Stop cron job
    if (this.schedules.has(sourceId)) {
      const job = this.schedules.get(sourceId);
      job.destroy();
      this.schedules.delete(sourceId);
    }
    
    // Stop adapter polling
    const adapter = this.adapters.get(sourceId);
    if (adapter && adapter.isPolling) {
      adapter.stopPolling();
    }
    
    this.logger.debug('Source stopped', { source_id: sourceId });
  }
  
  /**
   * Poll a specific source
   */
  async pollSource(sourceId) {
    const source = this.sources.get(sourceId);
    const adapter = this.adapters.get(sourceId);
    
    if (!source || !adapter) {
      this.logger.error('Source or adapter not found for polling', { source_id: sourceId });
      return;
    }
    
    if (source.status !== 'active') {
      this.logger.debug('Skipping inactive source', { source_id: sourceId, status: source.status });
      return;
    }
    
    // Check if we should poll now
    if (!SourceHelpers.shouldPollNow(source)) {
      this.logger.debug('Skipping source poll - not time yet', { source_id: sourceId });
      return;
    }
    
    try {
      this.stats.total_polls++;
      
      this.logger.info('Polling source', {
        source_id: sourceId,
        source_name: source.name,
        source_type: source.type
      });
      
      // Execute poll
      const result = await adapter.executePoll();
      
      // Update source with next poll time
      source.last_poll_at = new Date();
      source.next_poll_at = SourceHelpers.calculateNextPollTime(source);
      
      this.stats.successful_polls++;
      this.stats.items_ingested += result.items?.length || 0;
      
      // Emit items for processing
      if (result.items && result.items.length > 0) {
        this.emit('items_ingested', {
          source_id: sourceId,
          items: result.items,
          metadata: result.feed_info || {}
        });
      }
      
    } catch (error) {
      this.stats.failed_polls++;
      
      // Update source status if consecutive failures
      const adapter = this.adapters.get(sourceId);
      if (adapter && adapter.consecutiveErrors >= source.polling_config.max_retries) {
        source.status = 'error';
        this.stats.active_sources--;
        this.stats.failed_sources++;
        
        this.logger.error('Source marked as failed due to consecutive errors', {
          source_id: sourceId,
          consecutive_errors: adapter.consecutiveErrors,
          max_retries: source.polling_config.max_retries
        });
        
        this.emit('source_failed', { source_id: sourceId, error: error.message });
      }
    }
  }
  
  /**
   * Create adapter for source type
   */
  createAdapter(source) {
    switch (source.type) {
      case 'rss':
        return new RSSAdapter(source, { logLevel: this.options.logLevel });
      
      // TODO: Add other adapter types
      // case 'api':
      //   return new APIAdapter(source);
      // case 'scraper':
      //   return new ScraperAdapter(source);
      
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }
  
  /**
   * Set up event listeners for adapter
   */
  setupAdapterListeners(adapter, source) {
    adapter.on('poll_success', (data) => {
      this.emit('poll_success', { ...data, source });
    });
    
    adapter.on('poll_error', (data) => {
      this.emit('poll_error', { ...data, source });
    });
    
    adapter.on('metrics_update', (data) => {
      this.emit('metrics_update', data);
    });
  }
  
  /**
   * Validate source configuration
   */
  validateSource(source) {
    if (!source.id || !source.name || !source.url || !source.type) {
      throw new Error('Source missing required fields: id, name, url, type');
    }
    
    if (!source.polling_config) {
      throw new Error('Source missing polling configuration');
    }
    
    const interval = source.polling_config.interval_minutes;
    if (!interval || interval < 5 || interval > 1440) {
      throw new Error('Polling interval must be between 5 and 1440 minutes');
    }
  }
  
  /**
   * Convert interval minutes to cron pattern
   */
  intervalToCron(minutes) {
    if (minutes >= 60 && minutes % 60 === 0) {
      // Hourly intervals
      const hours = minutes / 60;
      if (hours === 1) return '0 * * * *'; // Every hour
      if (hours <= 24 && 24 % hours === 0) return `0 */${hours} * * *`;
    }
    
    if (minutes <= 59) {
      // Minute intervals
      if (minutes === 1) return '* * * * *'; // Every minute
      if (60 % minutes === 0) return `*/${minutes} * * * *`;
    }
    
    // Default to hourly for complex intervals
    return '0 * * * *';
  }
  
  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckJob = new cron.CronJob(
      `*/${this.options.healthCheckInterval / 60000} * * * *`, // Convert ms to minutes
      () => this.performHealthCheck(),
      null, true, 'UTC'
    );
  }
  
  /**
   * Start retry job for failed sources
   */
  startRetryJob() {
    this.retryJob = new cron.CronJob(
      `*/${this.options.retryFailedSourcesInterval / 60000} * * * *`,
      () => this.retryFailedSources(),
      null, true, 'UTC'
    );
  }
  
  /**
   * Perform health check on all sources
   */
  async performHealthCheck() {
    this.logger.debug('Performing health check');
    
    const healthReport = {
      timestamp: new Date(),
      total_sources: this.sources.size,
      active_sources: 0,
      healthy_sources: 0,
      unhealthy_sources: 0,
      sources: []
    };
    
    for (const [sourceId, source] of this.sources) {
      const adapter = this.adapters.get(sourceId);
      const health = SourceHelpers.getSourceHealth(source);
      
      const sourceHealth = {
        source_id: sourceId,
        source_name: source.name,
        status: source.status,
        health_score: health.score,
        consecutive_failures: health.consecutive_failures,
        last_success: health.last_success,
        uptime: health.uptime
      };
      
      if (source.status === 'active') {
        healthReport.active_sources++;
        
        if (health.score > 0.7) {
          healthReport.healthy_sources++;
        } else {
          healthReport.unhealthy_sources++;
        }
      }
      
      healthReport.sources.push(sourceHealth);
    }
    
    this.emit('health_check', healthReport);
    
    // Log warnings for unhealthy sources
    if (healthReport.unhealthy_sources > 0) {
      this.logger.warn('Unhealthy sources detected', {
        unhealthy_count: healthReport.unhealthy_sources,
        total_active: healthReport.active_sources
      });
    }
  }
  
  /**
   * Retry failed sources
   */
  async retryFailedSources() {
    const failedSources = Array.from(this.sources.values())
      .filter(source => source.status === 'error');
    
    if (failedSources.length === 0) return;
    
    this.logger.info('Retrying failed sources', { count: failedSources.length });
    
    for (const source of failedSources) {
      try {
        // Reset status and try polling
        source.status = 'active';
        const adapter = this.adapters.get(source.id);
        if (adapter) {
          adapter.consecutiveErrors = 0;
        }
        
        // Reschedule
        await this.scheduleSource(source);
        
        this.stats.failed_sources--;
        this.stats.active_sources++;
        
        this.logger.info('Source retry scheduled', {
          source_id: source.id,
          source_name: source.name
        });
        
      } catch (error) {
        this.logger.error('Failed to retry source', {
          source_id: source.id,
          error: error.message
        });
      }
    }
  }
  
  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      ...this.stats,
      is_running: this.isRunning,
      uptime_seconds: Math.floor((Date.now() - this.stats.last_reset) / 1000),
      success_rate: this.stats.total_polls > 0 
        ? this.stats.successful_polls / this.stats.total_polls 
        : 0,
      avg_items_per_poll: this.stats.successful_polls > 0 
        ? this.stats.items_ingested / this.stats.successful_polls 
        : 0
    };
  }
  
  /**
   * Get status of all sources
   */
  getSourceStatuses() {
    const statuses = [];
    
    for (const [sourceId, source] of this.sources) {
      const adapter = this.adapters.get(sourceId);
      const health = SourceHelpers.getSourceHealth(source);
      
      statuses.push({
        source_id: sourceId,
        name: source.name,
        type: source.type,
        status: source.status,
        health_score: health.score,
        last_poll: source.last_poll_at,
        next_poll: source.next_poll_at,
        consecutive_errors: adapter?.consecutiveErrors || 0,
        is_polling: adapter?.isPolling || false
      });
    }
    
    return statuses;
  }
}

module.exports = IngestionScheduler;
