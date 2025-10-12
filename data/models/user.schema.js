/**
 * User Schema - User profiles, preferences, and context for personalized signal delivery
 * 
 * This schema manages:
 * 1. User identity and authentication
 * 2. Role-based context and permissions
 * 3. Signal delivery preferences
 * 4. Learning and feedback history
 * 5. Team and company associations
 */

const { z } = require('zod');

// User roles for context and permissions
const UserRole = z.enum([
  'executive',
  'product_manager', 
  'marketing_manager',
  'sales_manager',
  'engineer',
  'analyst',
  'consultant',
  'founder',
  'investor'
]);

// Notification preferences for different channels
const NotificationPreferences = z.object({
  slack: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().min(0).max(1).default(0.7), // Minimum relevance score
    work_hours_only: z.boolean().default(true),
    batch_digest: z.boolean().default(false),
    channels: z.array(z.string()).default([]) // Specific Slack channels
  }),
  
  desktop: z.object({
    enabled: z.boolean().default(true),
    threshold: z.number().min(0).max(1).default(0.5),
    notifications: z.boolean().default(true),
    sound: z.boolean().default(false),
    auto_launch: z.boolean().default(true)
  }),
  
  email: z.object({
    enabled: z.boolean().default(false),
    threshold: z.number().min(0).max(1).default(0.9), // Only critical
    digest_frequency: z.enum(['daily', 'weekly', 'never']).default('weekly')
  }),
  
  teams: z.object({
    enabled: z.boolean().default(false),
    threshold: z.number().min(0).max(1).default(0.7),
    channels: z.array(z.string()).default([])
  })
});

// Work schedule for respecting work hours
const WorkSchedule = z.object({
  timezone: z.string().default('America/New_York'),
  work_days: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]), // Mon-Fri
  start_time: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  respect_schedule: z.boolean().default(true)
});

// User context for relevance scoring
const UserContext = z.object({
  // Professional context
  role: UserRole,
  seniority: z.enum(['junior', 'mid', 'senior', 'executive']).default('mid'),
  department: z.string().optional(),
  focus_areas: z.array(z.string()).default([]), // e.g., ['mobile', 'enterprise', 'security']
  
  // Company context
  company_size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  industry: z.string().optional(),
  
  // Competitive landscape
  primary_competitors: z.array(z.string()).default([]),
  secondary_competitors: z.array(z.string()).default([]),
  partner_companies: z.array(z.string()).default([]),
  
  // Product context
  products_owned: z.array(z.string()).default([]),
  technologies_used: z.array(z.string()).default([]),
  markets_served: z.array(z.string()).default([])
});

// Learning profile from user feedback
const LearningProfile = z.object({
  total_feedback_count: z.number().default(0),
  positive_feedback_count: z.number().default(0),
  feedback_accuracy: z.number().min(0).max(1).default(0.5),
  
  // Category preferences learned from feedback
  category_preferences: z.record(z.string(), z.number().min(-1).max(1)).default({}),
  
  // Source trust adjustments
  source_adjustments: z.record(z.string(), z.number().min(-1).max(1)).default({}),
  
  // Keyword importance
  keyword_weights: z.record(z.string(), z.number().min(0).max(2)).default({}),
  
  // Last model update
  last_training: z.date().optional(),
  model_version: z.string().default('1.0')
});

// Integration settings
const IntegrationSettings = z.object({
  slack: z.object({
    workspace_id: z.string().optional(),
    user_id: z.string().optional(),
    access_token: z.string().optional(),
    bot_token: z.string().optional(),
    connected: z.boolean().default(false)
  }),
  
  teams: z.object({
    tenant_id: z.string().optional(),
    user_id: z.string().optional(),
    access_token: z.string().optional(),
    connected: z.boolean().default(false)
  }),
  
  jira: z.object({
    cloud_id: z.string().optional(),
    site_url: z.string().optional(),
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    token_expiry: z.number().optional(),
    scopes: z.array(z.string()).optional(),
    project_key: z.string().optional(),
    connected: z.boolean().default(false)
  }),
  
  notion: z.object({
    access_token: z.string().optional(),
    database_id: z.string().optional(),
    connected: z.boolean().default(false)
  })
});

// Main User schema
const UserSchema = z.object({
  // Identity
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  avatar_url: z.string().url().optional(),
  
  // Authentication
  auth_provider: z.enum(['email', 'google', 'microsoft', 'sso']).default('email'),
  auth_id: z.string(), // ID from auth provider
  email_verified: z.boolean().default(false),
  
  // Organization
  team_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  
  // Profile and preferences
  context: UserContext,
  notifications: NotificationPreferences.default({}),
  work_schedule: WorkSchedule.default({}),
  learning_profile: LearningProfile.default({}),
  
  // Integrations
  integrations: IntegrationSettings.default({}),
  
  // Usage tracking
  onboarding_completed: z.boolean().default(false),
  last_active: z.date().optional(),
  signal_views: z.number().default(0),
  actions_taken: z.number().default(0),
  
  // Account status
  subscription_plan: z.enum(['trial', 'individual', 'team', 'enterprise']).default('trial'),
  trial_ends_at: z.date().optional(),
  is_active: z.boolean().default(true),
  
  // System metadata
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
  last_login: z.date().optional()
});

// Derived schemas
const UserProfileSchema = UserSchema.pick({
  id: true,
  email: true,
  name: true,
  avatar_url: true,
  context: true,
  team_id: true,
  company_id: true,
  subscription_plan: true
});

const UserPreferencesSchema = UserSchema.pick({
  notifications: true,
  work_schedule: true,
  integrations: true
});

const UserCreateSchema = UserSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  last_login: true,
  learning_profile: true,
  signal_views: true,
  actions_taken: true
});

const UserUpdateSchema = UserCreateSchema.partial();

// Helper functions
class UserHelpers {
  static generateId() {
    return crypto.randomUUID();
  }
  
  static isInWorkHours(user, timestamp = new Date()) {
    if (!user.work_schedule.respect_schedule) return true;
    
    const userTime = new Date(timestamp.toLocaleString("en-US", {
      timeZone: user.work_schedule.timezone
    }));
    
    const dayOfWeek = userTime.getDay();
    const currentTime = userTime.getHours() * 100 + userTime.getMinutes();
    
    // Check if it's a work day
    if (!user.work_schedule.work_days.includes(dayOfWeek)) {
      return false;
    }
    
    // Parse work hours
    const [startHour, startMin] = user.work_schedule.start_time.split(':').map(Number);
    const [endHour, endMin] = user.work_schedule.end_time.split(':').map(Number);
    const startTime = startHour * 100 + startMin;
    const endTime = endHour * 100 + endMin;
    
    return currentTime >= startTime && currentTime <= endTime;
  }
  
  static getRelevanceThreshold(user, channel) {
    return user.notifications[channel]?.threshold || 0.5;
  }
  
  static shouldReceiveSignal(user, signal, channel) {
    const threshold = this.getRelevanceThreshold(user, channel);
    const channelEnabled = user.notifications[channel]?.enabled || false;
    
    if (!channelEnabled) return false;
    if (signal.relevance_score < threshold) return false;
    
    // Always deliver critical signals regardless of work hours
    if (signal.priority === 'critical') return true;
    
    // Respect work hours for non-critical signals
    if (user.notifications[channel]?.work_hours_only) {
      return this.isInWorkHours(user);
    }
    
    return true;
  }
  
  static updateLearningProfile(user, feedback) {
    const profile = user.learning_profile;
    profile.total_feedback_count++;
    
    if (feedback.helpful) {
      profile.positive_feedback_count++;
    }
    
    profile.feedback_accuracy = profile.positive_feedback_count / profile.total_feedback_count;
    
    // Update category preferences
    const category = feedback.signal_category;
    const currentWeight = profile.category_preferences[category] || 0;
    const adjustment = feedback.helpful ? 0.1 : -0.1;
    profile.category_preferences[category] = Math.max(-1, Math.min(1, currentWeight + adjustment));
    
    // Update source trust
    const source = feedback.source_id;
    const currentTrust = profile.source_adjustments[source] || 0;
    profile.source_adjustments[source] = Math.max(-1, Math.min(1, currentTrust + adjustment));
    
    user.learning_profile = profile;
    return user;
  }
  
  static getPersonalizedScore(user, signal) {
    let score = signal.relevance_score || 0.5;
    const profile = user.learning_profile;
    
    // Adjust based on category preference
    const categoryAdjustment = profile.category_preferences[signal.category] || 0;
    score += categoryAdjustment * 0.2;
    
    // Adjust based on source trust
    const sourceAdjustment = profile.source_adjustments[signal.source_id] || 0;
    score += sourceAdjustment * 0.1;
    
    // Adjust based on keyword weights
    for (const keyword of signal.keywords || []) {
      const weight = profile.keyword_weights[keyword] || 1;
      score *= weight;
    }
    
    return Math.max(0, Math.min(1, score));
  }
}

module.exports = {
  UserSchema,
  UserProfileSchema,
  UserPreferencesSchema,
  UserCreateSchema,
  UserUpdateSchema,
  UserRole,
  NotificationPreferences,
  WorkSchedule,
  UserContext,
  LearningProfile,
  IntegrationSettings,
  UserHelpers
};
