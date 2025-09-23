/**
 * Feedback Schema - User feedback on signals for continuous learning and improvement
 * 
 * This schema captures:
 * 1. Explicit user feedback (thumbs up/down, relevance ratings)
 * 2. Implicit feedback (views, actions, time spent)
 * 3. Contextual information for learning
 * 4. Aggregated feedback metrics
 */

const { z } = require('zod');

// Types of feedback actions
const FeedbackType = z.enum([
  'explicit_rating',    // Direct thumbs up/down
  'relevance_score',    // 1-5 star rating
  'view',              // Signal was viewed
  'click',             // User clicked on signal
  'action',            // User took action (flag, assign, etc.)
  'dismiss',           // User dismissed signal
  'snooze',            // User snoozed signal
  'flag',              // User flagged as important
  'share',             // User shared signal
  'create_task',       // User created task from signal
  'mute_source',       // User muted the source
  'mute_category',     // User muted the category
  'time_spent'         // Time user spent viewing signal
]);

// Feedback context for learning
const FeedbackContext = z.object({
  // Where the feedback occurred
  channel: z.enum(['slack', 'desktop', 'email', 'teams']),
  device: z.enum(['mobile', 'desktop', 'tablet']).optional(),
  
  // When the feedback occurred
  time_of_day: z.number().min(0).max(23), // Hour of day
  day_of_week: z.number().min(0).max(6),  // 0 = Sunday
  
  // Signal context at time of feedback
  signal_age_hours: z.number().min(0),    // How old was signal when feedback given
  signal_position: z.number().min(0).optional(), // Position in feed/list
  related_signals_count: z.number().min(0).default(0),
  
  // User context
  user_session_duration: z.number().min(0).optional(), // Minutes in current session
  signals_viewed_today: z.number().min(0).default(0),
  recent_activity_level: z.enum(['low', 'medium', 'high']).default('medium')
});

// Main Feedback schema
const FeedbackSchema = z.object({
  // Core identification
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  signal_id: z.string().uuid(),
  
  // Feedback details
  type: FeedbackType,
  value: z.union([
    z.boolean(),           // For explicit_rating (helpful/not helpful)
    z.number().min(1).max(5), // For relevance_score
    z.number().min(0),     // For time_spent (seconds), view count, etc.
    z.string()             // For text feedback
  ]),
  
  // Optional text feedback
  comment: z.string().max(500).optional(),
  
  // Context for learning
  context: FeedbackContext,
  
  // Signal metadata at time of feedback (for learning)
  signal_metadata: z.object({
    category: z.string(),
    priority: z.string(),
    source_id: z.string(),
    trust_level: z.string(),
    relevance_score: z.number().min(0).max(1).optional(),
    keywords: z.array(z.string()).default([]),
    entities: z.array(z.string()).default([])
  }),
  
  // User metadata at time of feedback
  user_metadata: z.object({
    role: z.string(),
    department: z.string().optional(),
    seniority: z.string(),
    company_size: z.string().optional(),
    industry: z.string().optional()
  }),
  
  // Processing status
  processed: z.boolean().default(false),
  used_for_training: z.boolean().default(false),
  
  // System metadata
  created_at: z.date().default(() => new Date()),
  ip_address: z.string().optional(), // For analytics, respecting privacy
  user_agent: z.string().optional()
});

// Aggregated feedback metrics schema
const FeedbackMetricsSchema = z.object({
  // Scope of metrics
  scope_type: z.enum(['user', 'team', 'company', 'global']),
  scope_id: z.string(),
  
  // Time period
  period_start: z.date(),
  period_end: z.date(),
  
  // Overall metrics
  total_feedback_count: z.number().default(0),
  positive_feedback_count: z.number().default(0),
  negative_feedback_count: z.number().default(0),
  feedback_rate: z.number().min(0).max(1).default(0), // % of signals that get feedback
  
  // Engagement metrics
  avg_time_per_signal: z.number().default(0), // seconds
  total_actions_taken: z.number().default(0),
  action_rate: z.number().min(0).max(1).default(0), // % of signals that drive actions
  
  // Quality metrics by category
  category_metrics: z.record(z.string(), z.object({
    feedback_count: z.number().default(0),
    positive_rate: z.number().min(0).max(1).default(0),
    avg_relevance: z.number().min(0).max(1).default(0),
    action_rate: z.number().min(0).max(1).default(0)
  })).default({}),
  
  // Quality metrics by source
  source_metrics: z.record(z.string(), z.object({
    feedback_count: z.number().default(0),
    positive_rate: z.number().min(0).max(1).default(0),
    avg_trust_adjustment: z.number().min(-1).max(1).default(0),
    mute_count: z.number().default(0)
  })).default({}),
  
  // Channel performance
  channel_metrics: z.record(z.string(), z.object({
    delivery_count: z.number().default(0),
    view_count: z.number().default(0),
    view_rate: z.number().min(0).max(1).default(0),
    action_count: z.number().default(0),
    action_rate: z.number().min(0).max(1).default(0)
  })).default({}),
  
  // Learning effectiveness
  model_performance: z.object({
    accuracy: z.number().min(0).max(1).default(0.5),
    precision: z.number().min(0).max(1).default(0.5),
    recall: z.number().min(0).max(1).default(0.5),
    f1_score: z.number().min(0).max(1).default(0.5)
  }),
  
  // System metadata
  calculated_at: z.date().default(() => new Date()),
  version: z.string().default('1.0')
});

// Derived schemas
const FeedbackCreateSchema = FeedbackSchema.omit({
  id: true,
  created_at: true,
  processed: true,
  used_for_training: true
});

const FeedbackSummarySchema = FeedbackSchema.pick({
  id: true,
  user_id: true,
  signal_id: true,
  type: true,
  value: true,
  created_at: true
});

// Helper functions
class FeedbackHelpers {
  static generateId() {
    return crypto.randomUUID();
  }
  
  static createImplicitFeedback(userId, signalId, type, value, context = {}) {
    return {
      user_id: userId,
      signal_id: signalId,
      type,
      value,
      context: {
        channel: context.channel || 'desktop',
        time_of_day: new Date().getHours(),
        day_of_week: new Date().getDay(),
        signal_age_hours: context.signal_age_hours || 0,
        ...context
      }
    };
  }
  
  static isPositiveFeedback(feedback) {
    switch (feedback.type) {
      case 'explicit_rating':
        return feedback.value === true;
      case 'relevance_score':
        return feedback.value >= 4;
      case 'action':
      case 'flag':
      case 'share':
      case 'create_task':
        return true;
      case 'dismiss':
      case 'mute_source':
      case 'mute_category':
        return false;
      case 'view':
      case 'click':
        return feedback.context?.time_spent > 30; // Spent more than 30 seconds
      default:
        return null; // Neutral
    }
  }
  
  static calculateFeedbackWeight(feedback) {
    // Weight feedback based on type and context
    const baseWeights = {
      explicit_rating: 1.0,
      relevance_score: 0.9,
      action: 0.8,
      flag: 0.7,
      create_task: 0.8,
      share: 0.6,
      dismiss: 0.5,
      mute_source: 0.9,
      mute_category: 0.7,
      view: 0.2,
      click: 0.3,
      time_spent: 0.4
    };
    
    let weight = baseWeights[feedback.type] || 0.5;
    
    // Adjust based on user expertise/seniority
    const seniorityMultiplier = {
      junior: 0.8,
      mid: 1.0,
      senior: 1.2,
      executive: 1.3
    };
    
    weight *= seniorityMultiplier[feedback.user_metadata?.seniority] || 1.0;
    
    // Adjust based on feedback recency (more recent = higher weight)
    const ageHours = (Date.now() - feedback.created_at.getTime()) / (1000 * 60 * 60);
    const recencyMultiplier = Math.max(0.5, 1 - (ageHours / (24 * 7))); // Decay over a week
    weight *= recencyMultiplier;
    
    return Math.max(0, Math.min(2, weight));
  }
  
  static aggregateFeedbackForSignal(feedbackList) {
    if (!feedbackList.length) return null;
    
    let totalWeight = 0;
    let weightedScore = 0;
    let actionCount = 0;
    let viewCount = 0;
    
    feedbackList.forEach(feedback => {
      const weight = this.calculateFeedbackWeight(feedback);
      const isPositive = this.isPositiveFeedback(feedback);
      
      if (isPositive !== null) {
        totalWeight += weight;
        weightedScore += (isPositive ? 1 : 0) * weight;
      }
      
      if (['action', 'flag', 'create_task', 'share'].includes(feedback.type)) {
        actionCount++;
      }
      
      if (feedback.type === 'view') {
        viewCount++;
      }
    });
    
    return {
      overall_score: totalWeight > 0 ? weightedScore / totalWeight : 0.5,
      total_feedback: feedbackList.length,
      action_count: actionCount,
      view_count: viewCount,
      engagement_rate: feedbackList.length > 0 ? actionCount / feedbackList.length : 0
    };
  }
  
  static generateLearningFeatures(feedback) {
    // Extract features for machine learning
    return {
      // User features
      user_role: feedback.user_metadata.role,
      user_seniority: feedback.user_metadata.seniority,
      user_department: feedback.user_metadata.department,
      
      // Signal features
      signal_category: feedback.signal_metadata.category,
      signal_priority: feedback.signal_metadata.priority,
      signal_trust_level: feedback.signal_metadata.trust_level,
      signal_source: feedback.signal_metadata.source_id,
      signal_keywords: feedback.signal_metadata.keywords,
      
      // Context features
      time_of_day: feedback.context.time_of_day,
      day_of_week: feedback.context.day_of_week,
      channel: feedback.context.channel,
      signal_age: feedback.context.signal_age_hours,
      signal_position: feedback.context.signal_position,
      
      // Target
      is_positive: this.isPositiveFeedback(feedback),
      feedback_weight: this.calculateFeedbackWeight(feedback)
    };
  }
}

module.exports = {
  FeedbackSchema,
  FeedbackCreateSchema,
  FeedbackSummarySchema,
  FeedbackMetricsSchema,
  FeedbackType,
  FeedbackContext,
  FeedbackHelpers
};
