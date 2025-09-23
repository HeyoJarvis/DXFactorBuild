/**
 * Source Schema - Configuration and management of competitive intelligence sources
 * 
 * This schema manages:
 * 1. Source definitions and configurations
 * 2. Polling schedules and health monitoring
 * 3. Content extraction and processing rules
 * 4. Quality metrics and trust scoring
 */

const { z } = require('zod');

// Source types for different ingestion methods
const SourceType = z.enum([
  'rss',           // RSS/Atom feeds
  'api',           // REST APIs
  'webhook',       // Webhook endpoints
  'scraper',       // Web scraping
  'email',         // Email monitoring
  'social',        // Social media APIs
  'news',          // News aggregation APIs
  'financial',     // Financial data APIs
  'patent',        // Patent databases
  'github'         // GitHub repositories
]);

// Source categories for organization
const SourceCategory = z.enum([
  'official',      // Company press releases, blogs
  'product',       // Product updates, changelogs
  'industry',      // Industry reports, analyst insights
  'technical',     // Technical documentation, code
  'news',          // News publications
  'social',        // Social media, forums
  'financial',     // Financial reports, funding
  'regulatory',    // Regulatory filings, compliance
  'patents',       // Patent filings, IP
  'academic'       // Research papers, whitepapers
]);

// Source status for monitoring
const SourceStatus = z.enum([
  'active',        // Currently monitoring
  'paused',        // Temporarily disabled
  'error',         // Experiencing errors
  'rate_limited',  // Rate limited by source
  'unauthorized',  // Authentication failed
  'not_found',     // Source no longer exists
  'disabled'       // Permanently disabled
]);

// Polling configuration
const PollingConfig = z.object({
  interval_minutes: z.number().min(5).max(1440).default(60), // 5 min to 24 hours
  timeout_seconds: z.number().min(10).max(300).default(30),
  max_retries: z.number().min(0).max(10).default(3),
  retry_backoff_minutes: z.number().min(1).max(60).default(5),
  
  // Rate limiting
  requests_per_minute: z.number().min(1).max(60).default(10),
  concurrent_requests: z.number().min(1).max(5).default(1),
  
  // Content limits
  max_items_per_poll: z.number().min(1).max(1000).default(100),
  max_content_length: z.number().min(1000).max(100000).default(50000),
  
  // Scheduling
  active_hours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/).default('00:00'),
    end: z.string().regex(/^\d{2}:\d{2}$/).default('23:59'),
    timezone: z.string().default('UTC')
  }).default({}),
  
  skip_weekends: z.boolean().default(false)
});

// Content extraction rules
const ExtractionConfig = z.object({
  // CSS selectors for web scraping
  title_selector: z.string().optional(),
  content_selector: z.string().optional(),
  summary_selector: z.string().optional(),
  date_selector: z.string().optional(),
  author_selector: z.string().optional(),
  
  // Content processing
  remove_selectors: z.array(z.string()).default([]), // Elements to remove
  required_selectors: z.array(z.string()).default([]), // Must be present
  
  // Text processing
  min_content_length: z.number().min(10).max(10000).default(100),
  max_content_length: z.number().min(100).max(100000).default(10000),
  
  // Language detection
  expected_language: z.string().default('en'),
  auto_translate: z.boolean().default(false),
  
  // Deduplication
  dedup_window_hours: z.number().min(1).max(168).default(24), // 1 hour to 1 week
  similarity_threshold: z.number().min(0.1).max(1.0).default(0.8)
});

// Quality metrics tracking
const QualityMetrics = z.object({
  // Success rates
  total_polls: z.number().default(0),
  successful_polls: z.number().default(0),
  failed_polls: z.number().default(0),
  success_rate: z.number().min(0).max(1).default(0),
  
  // Content quality
  total_items_found: z.number().default(0),
  valid_items_extracted: z.number().default(0),
  duplicate_items: z.number().default(0),
  low_quality_items: z.number().default(0),
  
  // Processing metrics
  avg_processing_time_ms: z.number().default(0),
  avg_items_per_poll: z.number().default(0),
  
  // Error tracking
  recent_errors: z.array(z.object({
    timestamp: z.date(),
    error_type: z.string(),
    error_message: z.string(),
    http_status: z.number().optional()
  })).default([]),
  
  // Performance over time
  last_successful_poll: z.date().optional(),
  consecutive_failures: z.number().default(0),
  uptime_percentage: z.number().min(0).max(1).default(1),
  
  // Content metrics
  avg_relevance_score: z.number().min(0).max(1).default(0.5),
  user_feedback_score: z.number().min(0).max(1).default(0.5),
  
  // Last updated
  last_calculated: z.date().default(() => new Date())
});

// Authentication configuration
const AuthConfig = z.object({
  type: z.enum(['none', 'api_key', 'oauth', 'basic', 'bearer']).default('none'),
  
  // API key authentication
  api_key: z.string().optional(),
  api_key_header: z.string().default('X-API-Key'),
  
  // OAuth configuration
  oauth_provider: z.string().optional(),
  oauth_token: z.string().optional(),
  oauth_refresh_token: z.string().optional(),
  oauth_expires_at: z.date().optional(),
  
  // Basic authentication
  username: z.string().optional(),
  password: z.string().optional(),
  
  // Bearer token
  bearer_token: z.string().optional(),
  
  // Additional headers
  custom_headers: z.record(z.string(), z.string()).default({})
});

// Main Source schema
const SourceSchema = z.object({
  // Core identification
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  
  // Source details
  type: SourceType,
  category: SourceCategory,
  url: z.string().url(),
  homepage: z.string().url().optional(),
  
  // Configuration
  polling_config: PollingConfig.default({}),
  extraction_config: ExtractionConfig.default({}),
  auth_config: AuthConfig.default({}),
  
  // Targeting and filtering
  target_companies: z.array(z.string()).default([]), // Companies to monitor
  target_keywords: z.array(z.string()).default([]),  // Keywords to look for
  exclude_keywords: z.array(z.string()).default([]), // Keywords to ignore
  
  // Trust and quality
  trust_score: z.number().min(0).max(1).default(0.5),
  quality_metrics: QualityMetrics.default({}),
  
  // Access control
  is_public: z.boolean().default(true),      // Available to all teams
  allowed_teams: z.array(z.string().uuid()).default([]), // Specific team access
  created_by_team: z.string().uuid().optional(),
  
  // Status and monitoring
  status: SourceStatus.default('active'),
  last_poll_at: z.date().optional(),
  next_poll_at: z.date().optional(),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  
  // System metadata
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
  created_by: z.string().uuid()
});

// Source template for common source types
const SourceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: SourceType,
  category: SourceCategory,
  
  // Template configuration
  url_template: z.string(), // e.g., "https://blog.{company}.com/feed"
  default_config: z.object({
    polling: PollingConfig.partial(),
    extraction: ExtractionConfig.partial()
  }),
  
  // Setup instructions
  setup_instructions: z.string().optional(),
  required_params: z.array(z.string()).default([]), // e.g., ['company', 'api_key']
  
  // Metadata
  is_premium: z.boolean().default(false),
  provider: z.string().optional(),
  logo_url: z.string().url().optional()
});

// Derived schemas
const SourceSummarySchema = SourceSchema.pick({
  id: true,
  name: true,
  description: true,
  type: true,
  category: true,
  status: true,
  trust_score: true,
  last_poll_at: true,
  created_at: true
});

const SourceCreateSchema = SourceSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  quality_metrics: true,
  last_poll_at: true,
  next_poll_at: true
});

const SourceUpdateSchema = SourceCreateSchema.partial();

// Helper functions
class SourceHelpers {
  static generateId() {
    return crypto.randomUUID();
  }
  
  static calculateNextPollTime(source) {
    const now = new Date();
    const config = source.polling_config;
    
    // Add interval to current time
    const nextPoll = new Date(now.getTime() + config.interval_minutes * 60 * 1000);
    
    // Respect active hours if configured
    if (config.active_hours && (config.active_hours.start !== '00:00' || config.active_hours.end !== '23:59')) {
      const [startHour, startMin] = config.active_hours.start.split(':').map(Number);
      const [endHour, endMin] = config.active_hours.end.split(':').map(Number);
      
      const hour = nextPoll.getHours();
      const minute = nextPoll.getMinutes();
      const currentTime = hour * 100 + minute;
      const startTime = startHour * 100 + startMin;
      const endTime = endHour * 100 + endMin;
      
      if (currentTime < startTime || currentTime > endTime) {
        // Schedule for next start time
        const tomorrow = new Date(nextPoll);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(startHour, startMin, 0, 0);
        return tomorrow;
      }
    }
    
    // Skip weekends if configured
    if (config.skip_weekends) {
      const dayOfWeek = nextPoll.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        const daysToAdd = dayOfWeek === 0 ? 1 : 2; // Monday
        nextPoll.setDate(nextPoll.getDate() + daysToAdd);
        nextPoll.setHours(9, 0, 0, 0); // Start Monday at 9 AM
      }
    }
    
    return nextPoll;
  }
  
  static shouldPollNow(source) {
    if (source.status !== 'active') return false;
    if (!source.next_poll_at) return true; // Never polled
    
    const now = new Date();
    return now >= source.next_poll_at;
  }
  
  static updateQualityMetrics(source, pollResult) {
    const metrics = source.quality_metrics;
    
    metrics.total_polls++;
    
    if (pollResult.success) {
      metrics.successful_polls++;
      metrics.last_successful_poll = new Date();
      metrics.consecutive_failures = 0;
      
      if (pollResult.items) {
        metrics.total_items_found += pollResult.items.length;
        metrics.valid_items_extracted += pollResult.valid_items || 0;
        metrics.duplicate_items += pollResult.duplicates || 0;
        metrics.low_quality_items += pollResult.low_quality || 0;
      }
      
      if (pollResult.processing_time_ms) {
        const totalTime = metrics.avg_processing_time_ms * (metrics.successful_polls - 1);
        metrics.avg_processing_time_ms = (totalTime + pollResult.processing_time_ms) / metrics.successful_polls;
      }
    } else {
      metrics.failed_polls++;
      metrics.consecutive_failures++;
      
      // Track recent errors (keep last 10)
      if (pollResult.error) {
        metrics.recent_errors.unshift({
          timestamp: new Date(),
          error_type: pollResult.error.type || 'unknown',
          error_message: pollResult.error.message || 'Unknown error',
          http_status: pollResult.error.status
        });
        
        if (metrics.recent_errors.length > 10) {
          metrics.recent_errors = metrics.recent_errors.slice(0, 10);
        }
      }
    }
    
    // Update calculated metrics
    metrics.success_rate = metrics.successful_polls / metrics.total_polls;
    metrics.avg_items_per_poll = metrics.successful_polls > 0 
      ? metrics.total_items_found / metrics.successful_polls 
      : 0;
    
    // Calculate uptime (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentErrors = metrics.recent_errors.filter(e => e.timestamp >= thirtyDaysAgo);
    const expectedPolls = Math.ceil((30 * 24 * 60) / source.polling_config.interval_minutes);
    metrics.uptime_percentage = Math.max(0, 1 - (recentErrors.length / expectedPolls));
    
    metrics.last_calculated = new Date();
    source.quality_metrics = metrics;
    
    return source;
  }
  
  static adjustTrustScore(source, feedback) {
    const currentScore = source.trust_score;
    const adjustment = feedback.is_positive ? 0.05 : -0.05;
    
    // Weight adjustment by user seniority
    const seniorityMultiplier = {
      junior: 0.5,
      mid: 1.0,
      senior: 1.5,
      executive: 2.0
    };
    
    const weightedAdjustment = adjustment * (seniorityMultiplier[feedback.user_seniority] || 1.0);
    const newScore = Math.max(0, Math.min(1, currentScore + weightedAdjustment));
    
    source.trust_score = newScore;
    return source;
  }
  
  static getSourceHealth(source) {
    const metrics = source.quality_metrics;
    const now = new Date();
    
    // Calculate health score (0-1)
    let health = 0;
    
    // Success rate (40% weight)
    health += metrics.success_rate * 0.4;
    
    // Recency (30% weight) - how recently we got data
    if (metrics.last_successful_poll) {
      const hoursSinceSuccess = (now - metrics.last_successful_poll) / (1000 * 60 * 60);
      const expectedInterval = source.polling_config.interval_minutes / 60;
      const recencyScore = Math.max(0, 1 - (hoursSinceSuccess / (expectedInterval * 3)));
      health += recencyScore * 0.3;
    }
    
    // Content quality (20% weight)
    const contentQuality = metrics.total_items_found > 0 
      ? (metrics.valid_items_extracted / metrics.total_items_found)
      : 0.5;
    health += contentQuality * 0.2;
    
    // User satisfaction (10% weight)
    health += metrics.user_feedback_score * 0.1;
    
    return {
      score: Math.max(0, Math.min(1, health)),
      status: source.status,
      consecutive_failures: metrics.consecutive_failures,
      last_success: metrics.last_successful_poll,
      uptime: metrics.uptime_percentage
    };
  }
  
  static createFromTemplate(template, params) {
    let url = template.url_template;
    
    // Replace template parameters
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, value);
    });
    
    return {
      name: template.name.replace(/{(\w+)}/g, (match, key) => params[key] || match),
      description: template.description,
      type: template.type,
      category: template.category,
      url,
      polling_config: { ...template.default_config.polling },
      extraction_config: { ...template.default_config.extraction },
      tags: [template.provider].filter(Boolean)
    };
  }
}

// Common source templates
const CommonSourceTemplates = [
  {
    id: 'company-blog-rss',
    name: '{company} Blog',
    description: 'RSS feed from company blog',
    type: 'rss',
    category: 'official',
    url_template: 'https://blog.{company}.com/feed',
    default_config: {
      polling: { interval_minutes: 120 },
      extraction: { min_content_length: 200 }
    },
    required_params: ['company']
  },
  {
    id: 'github-releases',
    name: '{company} GitHub Releases',
    description: 'GitHub releases and announcements',
    type: 'api',
    category: 'technical',
    url_template: 'https://api.github.com/repos/{company}/{repo}/releases',
    default_config: {
      polling: { interval_minutes: 360 },
      extraction: { min_content_length: 50 }
    },
    required_params: ['company', 'repo']
  }
];

module.exports = {
  SourceSchema,
  SourceTemplateSchema,
  SourceSummarySchema,
  SourceCreateSchema,
  SourceUpdateSchema,
  SourceType,
  SourceCategory,
  SourceStatus,
  PollingConfig,
  ExtractionConfig,
  QualityMetrics,
  AuthConfig,
  SourceHelpers,
  CommonSourceTemplates
};
