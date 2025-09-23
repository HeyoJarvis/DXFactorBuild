/**
 * Core Signal Schema - The fundamental data structure for competitive intelligence signals
 * 
 * A signal represents a piece of competitive intelligence that has been:
 * 1. Ingested from a source
 * 2. Enriched with context and metadata  
 * 3. Scored for relevance and trust
 * 4. Prepared for delivery to users
 */

const { z } = require('zod');

// Signal priority levels for routing and display
const SignalPriority = z.enum(['critical', 'high', 'medium', 'low', 'fyi']);

// Signal categories for organization and filtering
const SignalCategory = z.enum([
  'product_launch',
  'funding',
  'acquisition',
  'partnership',
  'leadership_change',
  'market_expansion',
  'technology_update',
  'pricing_change',
  'security_incident',
  'regulatory_change',
  'competitive_analysis',
  'industry_trend'
]);

// Trust levels based on source reliability
const TrustLevel = z.enum(['verified', 'official', 'reliable', 'unverified']);

// Processing status for pipeline tracking
const ProcessingStatus = z.enum([
  'raw',           // Just ingested
  'enriching',     // Adding context and metadata
  'scoring',       // Calculating relevance scores
  'ready',         // Ready for delivery
  'delivered',     // Sent to users
  'archived',      // Moved to long-term storage
  'error'          // Processing failed
]);

// Entity mentions within the signal
const EntityMention = z.object({
  type: z.enum(['company', 'product', 'person', 'technology', 'location']),
  name: z.string(),
  confidence: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  context: z.string().optional()
});

// Impact assessment for business relevance
const ImpactAssessment = z.object({
  competitive_threat: z.number().min(0).max(1),
  market_opportunity: z.number().min(0).max(1),
  strategic_importance: z.number().min(0).max(1),
  urgency: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional()
});

// Main Signal schema
const SignalSchema = z.object({
  // Core identification
  id: z.string().uuid(),
  source_id: z.string(),
  external_id: z.string().optional(), // Original ID from source
  
  // Content
  title: z.string().min(1).max(500),
  summary: z.string().max(2000),
  content: z.string().optional(), // Full content if available
  url: z.string().url(),
  
  // Metadata
  category: SignalCategory,
  priority: SignalPriority,
  trust_level: TrustLevel,
  language: z.string().default('en'),
  
  // Timing
  published_at: z.date(),
  discovered_at: z.date(),
  processed_at: z.date().optional(),
  
  // Processing
  status: ProcessingStatus.default('raw'),
  processing_errors: z.array(z.string()).default([]),
  
  // Enrichment data
  entities: z.array(EntityMention).default([]),
  keywords: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  sentiment: z.number().min(-1).max(1).optional(),
  
  // Relevance scoring
  relevance_score: z.number().min(0).max(1).optional(),
  impact_assessment: ImpactAssessment.optional(),
  
  // User interaction
  view_count: z.number().default(0),
  action_count: z.number().default(0),
  feedback_score: z.number().min(-1).max(1).optional(),
  
  // Delivery tracking
  delivered_to: z.array(z.object({
    user_id: z.string(),
    channel: z.enum(['slack', 'desktop', 'email', 'teams']),
    delivered_at: z.date(),
    read_at: z.date().optional(),
    acted_on: z.boolean().default(false)
  })).default([]),
  
  // Relationships
  related_signals: z.array(z.string().uuid()).default([]),
  duplicate_of: z.string().uuid().optional(),
  
  // System metadata
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
  version: z.number().default(1)
});

// Derived schemas for different use cases
const SignalSummarySchema = SignalSchema.pick({
  id: true,
  title: true,
  summary: true,
  category: true,
  priority: true,
  trust_level: true,
  published_at: true,
  relevance_score: true,
  url: true
});

const SignalCreateSchema = SignalSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  version: true,
  view_count: true,
  action_count: true,
  delivered_to: true
});

const SignalUpdateSchema = SignalCreateSchema.partial();

// Helper functions for signal manipulation
class SignalHelpers {
  static generateId() {
    return crypto.randomUUID();
  }
  
  static isExpired(signal, ttlHours = 168) { // Default 7 days
    const ageHours = (Date.now() - signal.published_at.getTime()) / (1000 * 60 * 60);
    return ageHours > ttlHours;
  }
  
  static calculateUrgency(signal) {
    const ageHours = (Date.now() - signal.published_at.getTime()) / (1000 * 60 * 60);
    const priorityMultiplier = {
      critical: 1.0,
      high: 0.8,
      medium: 0.6,
      low: 0.4,
      fyi: 0.2
    };
    
    // Urgency decreases over time
    const timeFactor = Math.max(0, 1 - (ageHours / 24)); // Decreases over 24 hours
    const priorityFactor = priorityMultiplier[signal.priority];
    
    return Math.min(1, (signal.relevance_score || 0.5) * priorityFactor * timeFactor);
  }
  
  static shouldDeliverToChannel(signal, channel, userPreferences) {
    const urgency = this.calculateUrgency(signal);
    
    switch (channel) {
      case 'slack':
        return urgency > userPreferences.slack_threshold || signal.priority === 'critical';
      case 'desktop':
        return urgency > userPreferences.desktop_threshold;
      case 'email':
        return signal.priority === 'critical' && userPreferences.email_enabled;
      default:
        return false;
    }
  }
  
  static formatForDisplay(signal, format = 'summary') {
    const baseInfo = {
      id: signal.id,
      title: signal.title,
      summary: signal.summary,
      category: signal.category,
      priority: signal.priority,
      trust_level: signal.trust_level,
      published_at: signal.published_at,
      url: signal.url
    };
    
    if (format === 'full') {
      return {
        ...baseInfo,
        content: signal.content,
        entities: signal.entities,
        impact_assessment: signal.impact_assessment,
        related_signals: signal.related_signals
      };
    }
    
    return baseInfo;
  }
}

module.exports = {
  SignalSchema,
  SignalSummarySchema,
  SignalCreateSchema,
  SignalUpdateSchema,
  SignalPriority,
  SignalCategory,
  TrustLevel,
  ProcessingStatus,
  EntityMention,
  ImpactAssessment,
  SignalHelpers
};
